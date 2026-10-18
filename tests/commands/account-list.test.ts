import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigStore } from '../../src/config/config-store.js';
import { handleAccountList } from '../../src/commands/account-list.js';

describe('ghx account list command', () => {
  let tmpDir: string;
  let configStore: ConfigStore;
  let logs: string[];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghx-list-test-'));
    configStore = new ConfigStore(path.join(tmpDir, 'config'));
    logs = [];
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const mockLogger = {
    log: (msg: string) => logs.push(msg),
    error: (msg: string) => logs.push(`ERROR: ${msg}`),
  };

  it('prints helpful instructions when no accounts are configured', async () => {
    await handleAccountList({
      configStore,
      logger: mockLogger,
    });

    const output = logs.join('\n');
    expect(output).toContain('No accounts configured');
    expect(output).toContain('ghx account add <alias>');
  });

  it('lists configured accounts vertically with aliases and usernames and without tokens', async () => {
    configStore.setAccount('personal', {
      username: 'personal-account',
      credentialRef: 'ghx-personal',
    });
    configStore.setAccount('work', {
      username: 'company-user',
      credentialRef: 'ghx-work',
    });

    await handleAccountList({
      configStore,
      logger: mockLogger,
    });

    const output = logs.join('\n');
    expect(output).toContain('Configured GitHub accounts:');
    expect(output).toContain('personal');
    expect(output).toContain('(personal-account)');
    expect(output).toContain('work');
    expect(output).toContain('(company-user)');

    // Ensure tokens / credential refs are never displayed
    expect(output).not.toContain('ghx-personal');
    expect(output).not.toContain('ghx-work');
  });
});
