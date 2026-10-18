import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { ConfigStore } from '../../src/config/config-store.js';
import { MemoryCredentialStore } from '../../src/credentials/memory-credential-store.js';
import { handleRemoteAdd } from '../../src/commands/remote-add.js';
import { addRemote } from '../../src/git/add-remote.js';

describe('ghx remote add command', () => {
  let tmpDir: string;
  let configStore: ConfigStore;
  let credentialStore: MemoryCredentialStore;
  const logger = { log: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghx-remote-test-'));
    configStore = new ConfigStore(path.join(tmpDir, 'config'));
    credentialStore = new MemoryCredentialStore();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('fails if no accounts are configured', async () => {
    await expect(
      handleRemoteAdd('origin', 'https://github.com/o/r.git', {
        configStore,
        credentialStore,
        logger,
      }),
    ).rejects.toThrow(/No accounts configured/i);
  });

  it('adds a remote URL with username and PAT while previewing it masked', async () => {
    configStore.setAccount('work', {
      username: 'company-user',
      credentialRef: 'ghx-work',
    });
    await credentialStore.setSecret('ghx-work', 'ghp_work_token');
    const confirm = vi.fn().mockResolvedValue(true);
    const add = vi.fn().mockReturnValue({ success: true });

    await handleRemoteAdd(
      'origin',
      'https://github.com/company-org/my-project.git',
      {
        configStore,
        credentialStore,
        logger,
        promptAccountSelection: vi.fn().mockResolvedValue('work'),
        promptCloneConfirmation: confirm,
        addRemote: add,
      },
    );

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'git remote add origin',
        maskedUrl:
          'https://company-user:********@github.com/company-org/my-project.git',
      }),
    );
    expect(add).toHaveBeenCalledWith({
      name: 'origin',
      url: 'https://company-user:ghp_work_token@github.com/company-org/my-project.git',
      token: 'ghp_work_token',
    });
  });

  it('does not run git when declined', async () => {
    configStore.setAccount('work', {
      username: 'company-user',
      credentialRef: 'ghx-work',
    });
    const add = vi.fn();

    await handleRemoteAdd('origin', 'https://github.com/o/r.git', {
      configStore,
      credentialStore,
      logger,
      promptAccountSelection: vi.fn().mockResolvedValue('work'),
      promptCloneConfirmation: vi.fn().mockResolvedValue(false),
      addRemote: add,
    });

    expect(add).not.toHaveBeenCalled();
  });

  it('addRemote sets origin in a real repo and fails on a duplicate', () => {
    spawnSync('git', ['init'], { cwd: tmpDir });
    const url = 'https://github.com/o/r.git';

    expect(addRemote({ name: 'origin', url, cwd: tmpDir })).toEqual({
      success: true,
    });
    const out = spawnSync('git', ['remote', 'get-url', 'origin'], {
      cwd: tmpDir,
      encoding: 'utf-8',
    });
    expect(out.stdout.trim()).toBe(url);
    expect(addRemote({ name: 'origin', url, cwd: tmpDir }).success).toBe(false);
  });
});
