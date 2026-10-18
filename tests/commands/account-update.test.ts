import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigStore } from '../../src/config/config-store.js';
import { handleAccountUpdate } from '../../src/commands/account-update.js';

describe('ghx account update command', () => {
  let tmpDir: string;
  let configStore: ConfigStore;
  const logger = { log: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghx-upd-test-'));
    configStore = new ConfigStore(path.join(tmpDir, 'config'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('fails for unknown account', async () => {
    await expect(
      handleAccountUpdate('nope', { configStore, logger }),
    ).rejects.toThrow(/not found/i);
  });

  it('prefills current values, keeps credentialRef, saves new ones', async () => {
    configStore.setAccount('work', {
      username: 'old',
      credentialRef: 'ghx-work',
      name: 'Old',
    });
    const prompt = vi.fn().mockResolvedValue({
      username: 'new',
      name: 'New Name',
      email: 'n@c.co',
    });

    await handleAccountUpdate('work', {
      configStore,
      promptAccountProfile: prompt,
      logger,
    });

    expect(prompt).toHaveBeenCalledWith(undefined, {
      existingUsername: 'old',
      existingName: 'Old',
      existingEmail: undefined,
    });
    expect(configStore.getAccount('work')).toEqual({
      username: 'new',
      credentialRef: 'ghx-work',
      name: 'New Name',
      email: 'n@c.co',
    });
    expect(configStore.getAccountForOwner('new')).toBe('work');
  });
});
