import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { ConfigStore } from '../../src/config/config-store.js';
import { MemoryCredentialStore } from '../../src/credentials/memory-credential-store.js';
import { handleRemoteAdd } from '../../src/commands/remote-add.js';
import { addRemote, checkRemoteTarget } from '../../src/git/add-remote.js';

describe('ghx remote add command', () => {
  let tmpDir: string;
  let configStore: ConfigStore;
  let credentialStore: MemoryCredentialStore;
  const noCheck = () => undefined;
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
        checkRemoteTarget: noCheck,
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
        checkRemoteTarget: noCheck,
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
      checkRemoteTarget: noCheck,
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

  describe('SSH and protocol handling', () => {
    const setup = () => {
      configStore.setAccount('a', {
        username: 'user-a',
        credentialRef: 'ghx-a',
        sshHost: 'gh.a',
      });
      configStore.setAccount('b', {
        username: 'user-b',
        credentialRef: 'ghx-b',
        sshHost: 'gh.b',
      });
      const getSecret = vi.spyOn(credentialStore, 'getSecret');
      const add = vi.fn().mockReturnValue({ success: true });
      const confirm = vi.fn().mockResolvedValue(true);
      const run = (url: string, alias = 'a', confirmFn = confirm) =>
        handleRemoteAdd('origin', url, {
          configStore,
          credentialStore,
          logger,
          promptAccountSelection: vi.fn().mockResolvedValue(alias),
          promptCloneConfirmation: confirmFn,
          addRemote: add,
          checkRemoteTarget: noCheck,
        });
      return { getSecret, add, confirm, run };
    };

    it('rewrites a default-host SSH URL to the selected alias, no PAT', async () => {
      const { getSecret, add, confirm, run } = setup();
      await run('git@github.com:customer-b/project.git', 'b');
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          protocol: 'ssh',
          maskedUrl: 'git@gh.b:customer-b/project.git',
        }),
      );
      expect(add).toHaveBeenCalledWith({
        name: 'origin',
        url: 'git@gh.b:customer-b/project.git',
      });
      expect(getSecret).not.toHaveBeenCalled();
    });

    it('keeps the ssh:// form', async () => {
      const { add, run } = setup();
      await run('ssh://git@github.com/o/r.git');
      expect(add).toHaveBeenCalledWith({
        name: 'origin',
        url: 'ssh://git@gh.a/o/r.git',
      });
    });

    it('errors when the selected account has no ssh_host, before confirming', async () => {
      configStore.setAccount('https-only', {
        username: 'u',
        credentialRef: 'ghx-h',
      });
      const { add, confirm, run } = setup();
      await expect(run('git@gh.a:o/r.git', 'https-only')).rejects.toThrow(
        /no ssh_host configured/i,
      );
      expect(confirm).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    });

    it('rejects an invalid ssh_host such as a key path or option', async () => {
      configStore.setAccount('bad', {
        username: 'u',
        credentialRef: 'ghx-bad',
        sshHost: '-oProxyCommand=x',
      });
      const { run } = setup();
      await expect(run('git@gh.a:o/r.git', 'bad')).rejects.toThrow(
        /invalid ssh_host/i,
      );
    });

    it('HTTPS stays HTTPS even if the account has ssh_host', async () => {
      const { add, run } = setup();
      await credentialStore.setSecret('ghx-a', 'tok');
      await run('https://github.com/o/r.git');
      expect(add.mock.calls[0][0].url).toBe(
        'https://user-a:tok@github.com/o/r.git',
      );
    });

    it('does not add when SSH confirmation is declined', async () => {
      const { add, run } = setup();
      await run('git@gh.a:o/r.git', 'a', vi.fn().mockResolvedValue(false));
      expect(add).not.toHaveBeenCalled();
    });

    it('fails before prompting when the target check fails', async () => {
      const { confirm } = setup();
      await expect(
        handleRemoteAdd('origin', 'git@gh.a:o/r.git', {
          configStore,
          credentialStore,
          logger,
          promptCloneConfirmation: confirm,
          checkRemoteTarget: () => 'Remote "origin" already exists.',
        }),
      ).rejects.toThrow(/already exists/);
      expect(confirm).not.toHaveBeenCalled();
    });
  });

  describe('checkRemoteTarget', () => {
    it('reports a non-Git directory', () => {
      expect(checkRemoteTarget('origin', tmpDir)).toMatch(
        /not a Git repository/,
      );
    });

    it('allows a repo without the remote and rejects an existing one', () => {
      spawnSync('git', ['init'], { cwd: tmpDir });
      expect(checkRemoteTarget('origin', tmpDir)).toBeUndefined();
      addRemote({ name: 'origin', url: 'git@gh.a:o/r.git', cwd: tmpDir });
      const err = checkRemoteTarget('origin', tmpDir);
      expect(err).toMatch(/already exists/);
      expect(err).toMatch(/set-url/);
    });
  });
});
