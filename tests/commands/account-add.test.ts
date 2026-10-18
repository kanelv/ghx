import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigStore } from '../../src/config/config-store.js';
import { MemoryCredentialStore } from '../../src/credentials/memory-credential-store.js';
import { handleAccountAdd } from '../../src/commands/account-add.js';

describe('ghx account add command', () => {
  let tmpDir: string;
  let configStore: ConfigStore;
  let credentialStore: MemoryCredentialStore;
  let logs: string[];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghx-cmd-test-'));
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

  it('adds a new account and securely stores PAT in credential store', async () => {
    const mockPrompts = vi.fn().mockResolvedValue({
      username: 'personal-user',
      pat: 'ghp_secret_token_123',
    });

    await handleAccountAdd('personal', {
      configStore,
      credentialStore,
      promptAccountDetails: mockPrompts,
      logger: mockLogger,
    });

    const account = configStore.getAccount('personal');
    expect(account).toEqual({
      username: 'personal-user',
      credentialRef: 'ghx-personal',
    });

    const secret = await credentialStore.getSecret('ghx-personal');
    expect(secret).toBe('ghp_secret_token_123');

    // Verify config file contains NO secret
    const rawConfig = fs.readFileSync(configStore.getConfigPath(), 'utf-8');
    expect(rawConfig).not.toContain('ghp_secret_token_123');

    expect(logs.some((l) => l.includes('personal') && l.includes('configured successfully'))).toBe(true);
  });

  it('rejects invalid aliases with validation error', async () => {
    await expect(
      handleAccountAdd('invalid alias with spaces', {
        configStore,
        credentialStore,
        promptAccountDetails: vi.fn(),
        logger: mockLogger,
      }),
    ).rejects.toThrow(/alphanumeric/i);
  });

  it('handles credential store unavailability cleanly', async () => {
    const unavailableStore = {
      isAvailable: vi.fn().mockResolvedValue({
        available: false,
        error: 'Secret service daemon not running',
      }),
      getSecret: vi.fn(),
      setSecret: vi.fn(),
      deleteSecret: vi.fn(),
    };

    await expect(
      handleAccountAdd('work', {
        configStore,
        credentialStore: unavailableStore as any,
        promptAccountDetails: vi.fn().mockResolvedValue({
          username: 'company-user',
          pat: 'ghp_token',
        }),
        logger: mockLogger,
      }),
    ).rejects.toThrow(/Secret service daemon not running/i);
  });
});
