import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigStore } from '../../src/config/config-store.js';
import { MemoryCredentialStore } from '../../src/credentials/memory-credential-store.js';
import { handleClone } from '../../src/commands/clone.js';

describe('ghx clone command', () => {
  let tmpDir: string;
  let configStore: ConfigStore;
  let credentialStore: MemoryCredentialStore;
  let logs: string[];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghx-clone-cmd-test-'));
    configStore = new ConfigStore(path.join(tmpDir, 'config'));
    credentialStore = new MemoryCredentialStore();
    logs = [];
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const mockLogger = {
    log: (msg: string) => logs.push(msg),
    error: (msg: string) => logs.push(`ERROR: ${msg}`),
  };

  it('fails if no accounts are configured', async () => {
    await expect(
      handleClone('https://github.com/company-org/my-project.git', undefined, {
        configStore,
        credentialStore,
        logger: mockLogger,
      }),
    ).rejects.toThrow(/No accounts configured/i);
  });

  it('preselects mapped account from owner-mapping and asks for confirmation', async () => {
    configStore.setAccount('personal', {
      username: 'personal-user',
      credentialRef: 'ghx-personal',
    });
    configStore.setAccount('work', {
      username: 'company-user',
      credentialRef: 'ghx-work',
    });
    configStore.setOwnerMapping('company-org', 'work');
    await credentialStore.setSecret('ghx-work', 'ghp_work_token');

    const mockSelect = vi.fn().mockResolvedValue('work');
    const mockConfirm = vi.fn().mockResolvedValue(true);
    const mockCloneRunner = vi.fn().mockResolvedValue({
      success: true,
      location: './my-project',
    });

    await handleClone(
      'https://github.com/company-org/my-project.git',
      undefined,
      {
        configStore,
        credentialStore,
        logger: mockLogger,
        promptAccountSelection: mockSelect,
        promptCloneConfirmation: mockConfirm,
        cloneRepository: mockCloneRunner,
      },
    );

    // Account selection called with preselected 'work'
    expect(mockSelect).toHaveBeenCalledWith(expect.anything(), 'work');

    // Confirmation called with masked preview
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        alias: 'work',
        repository: 'company-org/my-project',
        maskedUrl:
          'https://company-user:********@github.com/company-org/my-project.git',
      }),
    );

    // Clone executed with token
    expect(mockCloneRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/company-org/my-project.git',
        destination: 'my-project',
        username: 'company-user',
        token: 'ghp_work_token',
      }),
    );

    const output = logs.join('\n');
    expect(output).toContain('Repository cloned successfully');
  });

  it('cancels clone when confirmation is No and never invokes Git', async () => {
    configStore.setAccount('personal', {
      username: 'personal-user',
      credentialRef: 'ghx-personal',
    });
    await credentialStore.setSecret('ghx-personal', 'ghp_personal_token');

    const mockSelect = vi.fn().mockResolvedValue('personal');
    const mockConfirm = vi.fn().mockResolvedValue(false); // User chose No
    const mockCloneRunner = vi.fn();

    await handleClone(
      'https://github.com/personal-org/sample.git',
      './custom-dest',
      {
        configStore,
        credentialStore,
        logger: mockLogger,
        promptAccountSelection: mockSelect,
        promptCloneConfirmation: mockConfirm,
        cloneRepository: mockCloneRunner,
      },
    );

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockCloneRunner).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes('Clone cancelled'))).toBe(true);
  });

  it('fails safely if PAT is missing from credential store', async () => {
    configStore.setAccount('work', {
      username: 'company-user',
      credentialRef: 'ghx-work',
    });
    // Do NOT add secret to credentialStore

    const mockSelect = vi.fn().mockResolvedValue('work');
    const mockConfirm = vi.fn().mockResolvedValue(true);
    const mockCloneRunner = vi.fn();

    await expect(
      handleClone('https://github.com/company-org/repo.git', undefined, {
        configStore,
        credentialStore,
        logger: mockLogger,
        promptAccountSelection: mockSelect,
        promptCloneConfirmation: mockConfirm,
        cloneRepository: mockCloneRunner,
      }),
    ).rejects.toThrow(
      /Personal Access Token for account "work" could not be found/i,
    );

    expect(mockCloneRunner).not.toHaveBeenCalled();
  });

  it('previews and applies the account git identity after clone', async () => {
    configStore.setAccount('work', {
      username: 'company-user',
      credentialRef: 'ghx-work',
      name: 'Work Me',
      email: 'me@company.co.jp',
    });
    await credentialStore.setSecret('ghx-work', 'ghp_work_token');

    const mockConfirm = vi.fn().mockResolvedValue(true);
    const mockSetIdentity = vi.fn().mockReturnValue({ success: true });

    await handleClone(
      'https://github.com/company-org/my-project.git',
      undefined,
      {
        configStore,
        credentialStore,
        promptAccountSelection: vi.fn().mockResolvedValue('work'),
        promptCloneConfirmation: mockConfirm,
        cloneRepository: vi
          .fn()
          .mockResolvedValue({ success: true, location: './my-project' }),
        setLocalIdentity: mockSetIdentity,
        logger: mockLogger,
      },
    );

    expect(mockConfirm.mock.calls[0][0].extraCommands).toEqual([
      'git -C ./my-project config --local user.name "Work Me"',
      'git -C ./my-project config --local user.email me@company.co.jp',
    ]);
    expect(mockSetIdentity).toHaveBeenCalledWith({
      name: 'Work Me',
      email: 'me@company.co.jp',
      cwd: 'my-project',
    });
  });

  describe('SSH', () => {
    const sshSetup = () => {
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
      const clone = vi
        .fn()
        .mockResolvedValue({ success: true, location: './project' });
      const confirm = vi.fn().mockResolvedValue(true);
      const run = (url: string, alias = 'a', confirmFn = confirm) =>
        handleClone(url, undefined, {
          configStore,
          credentialStore,
          logger: mockLogger,
          promptAccountSelection: vi.fn().mockResolvedValue(alias),
          promptCloneConfirmation: confirmFn,
          cloneRepository: clone,
        });
      return { getSecret, clone, confirm, run };
    };

    it('clones via the selected alias without credentials', async () => {
      const { getSecret, clone, confirm, run } = sshSetup();
      await run('git@gh.a:customer-a/project.git');
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          protocol: 'ssh',
          maskedUrl: 'git@gh.a:customer-a/project.git',
        }),
      );
      expect(clone).toHaveBeenCalledWith({
        url: 'git@gh.a:customer-a/project.git',
        destination: 'project',
      });
      expect(getSecret).not.toHaveBeenCalled();
    });

    it('swaps the default host for the selected profile alias, keeping owner/repo', async () => {
      const { clone, run } = sshSetup();
      await run('git@github.com:customer-a/project.git', 'b');
      expect(clone.mock.calls[0][0].url).toBe(
        'git@gh.b:customer-a/project.git',
      );
    });

    it('keeps ssh:// form and uses the selected alias over the URL alias', async () => {
      const { clone, run } = sshSetup();
      await run('ssh://git@gh.a/customer-a/project.git', 'b');
      expect(clone.mock.calls[0][0].url).toBe(
        'ssh://git@gh.b/customer-a/project.git',
      );
    });

    it('errors with guidance when the account has no ssh_host', async () => {
      configStore.setAccount('https-only', {
        username: 'u',
        credentialRef: 'ghx-h',
      });
      const { clone, confirm, run } = sshSetup();
      await expect(run('git@gh.a:o/r.git', 'https-only')).rejects.toThrow(
        /ssh_host.*ghx account update https-only/s,
      );
      expect(confirm).not.toHaveBeenCalled();
      expect(clone).not.toHaveBeenCalled();
    });

    it('does not clone when declined', async () => {
      const { clone, getSecret, run } = sshSetup();
      await run('git@gh.a:o/r.git', 'a', vi.fn().mockResolvedValue(false));
      expect(clone).not.toHaveBeenCalled();
      expect(getSecret).not.toHaveBeenCalled();
    });

    it('HTTPS URL is never converted to SSH', async () => {
      const { clone, run } = sshSetup();
      await credentialStore.setSecret('ghx-a', 'tok');
      await run('https://github.com/o/r.git');
      expect(clone.mock.calls[0][0]).toMatchObject({
        url: 'https://github.com/o/r.git',
        username: 'user-a',
        token: 'tok',
      });
    });
  });
});
