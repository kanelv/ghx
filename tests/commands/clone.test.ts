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

    await handleClone('https://github.com/company-org/my-project.git', undefined, {
      configStore,
      credentialStore,
      logger: mockLogger,
      promptAccountSelection: mockSelect,
      promptCloneConfirmation: mockConfirm,
      cloneRepository: mockCloneRunner,
    });

    // Account selection called with preselected 'work'
    expect(mockSelect).toHaveBeenCalledWith(
      expect.anything(),
      'work',
    );

    // Confirmation called with masked preview
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        alias: 'work',
        repository: 'company-org/my-project',
        maskedUrl: 'https://company-user:********@github.com/company-org/my-project.git',
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

    await handleClone('https://github.com/personal-org/sample.git', './custom-dest', {
      configStore,
      credentialStore,
      logger: mockLogger,
      promptAccountSelection: mockSelect,
      promptCloneConfirmation: mockConfirm,
      cloneRepository: mockCloneRunner,
    });

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
    ).rejects.toThrow(/Personal Access Token for account "work" could not be found/i);

    expect(mockCloneRunner).not.toHaveBeenCalled();
  });
});
