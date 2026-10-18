import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigStore } from '../../src/config/config-store.js';

describe('ConfigStore', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghx-config-test-'));
    configPath = path.join(tmpDir, 'config');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('alias validation', () => {
    it('accepts valid alphanumeric aliases with hyphens and underscores', () => {
      const store = new ConfigStore(configPath);
      expect(store.validateAlias('personal')).toEqual({ valid: true });
      expect(store.validateAlias('work-2')).toEqual({ valid: true });
      expect(store.validateAlias('client_corp')).toEqual({ valid: true });
    });

    it('rejects invalid aliases containing spaces or special characters', () => {
      const store = new ConfigStore(configPath);
      expect(store.validateAlias('')).toEqual({ valid: false, error: 'Alias cannot be empty.' });
      expect(store.validateAlias(' ')).toEqual({ valid: false, error: 'Alias cannot be empty.' });
      expect(store.validateAlias('work account')).toEqual({
        valid: false,
        error: 'Alias must contain only alphanumeric characters, hyphens, and underscores.',
      });
      expect(store.validateAlias('work.personal')).toEqual({
        valid: false,
        error: 'Alias must contain only alphanumeric characters, hyphens, and underscores.',
      });
      expect(store.validateAlias('[work]')).toEqual({
        valid: false,
        error: 'Alias must contain only alphanumeric characters, hyphens, and underscores.',
      });
    });
  });

  describe('empty / missing config', () => {
    it('returns empty config if file does not exist', () => {
      const store = new ConfigStore(configPath);
      const config = store.load();
      expect(config.accounts).toEqual({});
      expect(config.ownerMapping).toEqual({});
      expect(store.listAccounts()).toEqual({});
      expect(store.getAccount('personal')).toBeUndefined();
    });
  });

  describe('saving and loading accounts', () => {
    it('saves account metadata and reads it back in INI format', () => {
      const store = new ConfigStore(configPath);
      store.setAccount('personal', {
        username: 'personal-account',
        credentialRef: 'ghx-personal',
      });

      expect(fs.existsSync(configPath)).toBe(true);
      const rawContent = fs.readFileSync(configPath, 'utf-8');
      expect(rawContent).toMatch(/username\s*=\s*personal-account/);
      expect(rawContent).toMatch(/credential_ref\s*=\s*ghx-personal/);

      const reloadedStore = new ConfigStore(configPath);
      const account = reloadedStore.getAccount('personal');
      expect(account).toEqual({
        username: 'personal-account',
        credentialRef: 'ghx-personal',
      });
      expect(reloadedStore.listAccounts()).toEqual({
        personal: {
          username: 'personal-account',
          credentialRef: 'ghx-personal',
        },
      });
    });

    it('ensures configuration file never contains PAT or secret tokens', () => {
      const store = new ConfigStore(configPath);
      store.setAccount('work', {
        username: 'work-user',
        credentialRef: 'ghx-work',
      });

      const rawContent = fs.readFileSync(configPath, 'utf-8');
      expect(rawContent.toLowerCase()).not.toContain('pat');
      expect(rawContent.toLowerCase()).not.toContain('token');
      expect(rawContent.toLowerCase()).not.toContain('ghp_');
    });

    it('supports updating existing account', () => {
      const store = new ConfigStore(configPath);
      store.setAccount('work', {
        username: 'initial-user',
        credentialRef: 'ghx-work',
      });
      store.setAccount('work', {
        username: 'updated-user',
        credentialRef: 'ghx-work',
      });

      const account = store.getAccount('work');
      expect(account?.username).toBe('updated-user');
    });
  });

  describe('owner mapping', () => {
    it('saves and resolves owner mapping (case-insensitive for GitHub owners)', () => {
      const store = new ConfigStore(configPath);
      store.setAccount('personal', {
        username: 'personal-user',
        credentialRef: 'ghx-personal',
      });
      store.setAccount('work', {
        username: 'work-user',
        credentialRef: 'ghx-work',
      });

      store.setOwnerMapping('Personal-User', 'personal');
      store.setOwnerMapping('company-org', 'work');

      expect(store.getAccountForOwner('personal-user')).toBe('personal');
      expect(store.getAccountForOwner('PERSONAL-USER')).toBe('personal');
      expect(store.getAccountForOwner('company-org')).toBe('work');
      expect(store.getAccountForOwner('unknown-org')).toBeUndefined();
    });
  });

  describe('file and directory permissions', () => {
    it('creates configuration directory with restricted permissions 0o700 and file with 0o600', () => {
      const customSubdir = path.join(tmpDir, 'nested', 'ghx');
      const nestedConfigPath = path.join(customSubdir, 'config');
      const store = new ConfigStore(nestedConfigPath);

      store.setAccount('personal', {
        username: 'test-user',
        credentialRef: 'ghx-personal',
      });

      const dirStat = fs.statSync(customSubdir);
      const fileStat = fs.statSync(nestedConfigPath);

      // On Unix, mode & 0o777 gives the permission bits
      if (process.platform !== 'win32') {
        expect(dirStat.mode & 0o777).toBe(0o700);
        expect(fileStat.mode & 0o777).toBe(0o600);
      }
    });
  });
});
