import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ini from 'ini';
import type { AccountConfig, GhxConfig } from './types.js';

export class ConfigStore {
  private readonly configPath: string;

  constructor(customConfigPath?: string) {
    if (customConfigPath) {
      this.configPath = customConfigPath;
    } else if (process.env.GHX_CONFIG_PATH) {
      this.configPath = process.env.GHX_CONFIG_PATH;
    } else {
      const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
      this.configPath = path.join(configHome, 'ghx', 'config');
    }
  }

  getConfigPath(): string {
    return this.configPath;
  }

  validateAlias(alias: string): { valid: boolean; error?: string } {
    if (!alias || alias.trim().length === 0) {
      return { valid: false, error: 'Alias cannot be empty.' };
    }
    const trimmed = alias.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return {
        valid: false,
        error: 'Alias must contain only alphanumeric characters, hyphens, and underscores.',
      };
    }
    return { valid: true };
  }

  load(): GhxConfig {
    if (!fs.existsSync(this.configPath)) {
      return { accounts: {}, ownerMapping: {} };
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = ini.parse(content);

      const accounts: Record<string, AccountConfig> = {};
      const ownerMapping: Record<string, string> = {};

      if (parsed && typeof parsed === 'object') {
        const rawAccount = parsed.account;
        if (rawAccount && typeof rawAccount === 'object') {
          for (const [alias, data] of Object.entries(rawAccount)) {
            if (data && typeof data === 'object') {
              const accountData = data as Record<string, unknown>;
              const username = typeof accountData.username === 'string' ? accountData.username : '';
              const credentialRef =
                typeof accountData.credential_ref === 'string'
                  ? accountData.credential_ref
                  : typeof accountData.credentialRef === 'string'
                    ? accountData.credentialRef
                    : `ghx-${alias}`;

              if (username) {
                accounts[alias] = {
                  username,
                  credentialRef,
                };
              }
            }
          }
        }

        const rawMapping = parsed['owner-mapping'] || parsed.ownerMapping;
        if (rawMapping && typeof rawMapping === 'object') {
          for (const [owner, alias] of Object.entries(rawMapping)) {
            if (typeof alias === 'string' && alias.trim()) {
              ownerMapping[owner] = alias.trim();
            }
          }
        }
      }

      return { accounts, ownerMapping };
    } catch {
      return { accounts: {}, ownerMapping: {} };
    }
  }

  save(config: GhxConfig): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    } else {
      try {
        fs.chmodSync(dir, 0o700);
      } catch {
        // Ignore if chmod is not supported
      }
    }

    const iniObj: Record<string, unknown> = {};

    if (Object.keys(config.accounts).length > 0) {
      const accountSection: Record<string, { username: string; credential_ref: string }> = {};
      for (const [alias, acc] of Object.entries(config.accounts)) {
        accountSection[alias] = {
          username: acc.username,
          credential_ref: acc.credentialRef,
        };
      }
      iniObj.account = accountSection;
    }

    if (Object.keys(config.ownerMapping).length > 0) {
      iniObj['owner-mapping'] = { ...config.ownerMapping };
    }

    const serialized = ini.stringify(iniObj);
    fs.writeFileSync(this.configPath, serialized, { mode: 0o600, encoding: 'utf-8' });

    try {
      fs.chmodSync(this.configPath, 0o600);
    } catch {
      // Ignore if chmod fails
    }
  }

  getAccount(alias: string): AccountConfig | undefined {
    const config = this.load();
    return config.accounts[alias];
  }

  listAccounts(): Record<string, AccountConfig> {
    const config = this.load();
    return config.accounts;
  }

  setAccount(alias: string, account: AccountConfig): void {
    const config = this.load();
    config.accounts[alias] = account;
    this.save(config);
  }

  getAccountForOwner(owner: string): string | undefined {
    const config = this.load();
    const normalizedOwner = owner.toLowerCase();
    for (const [mappedOwner, alias] of Object.entries(config.ownerMapping)) {
      if (mappedOwner.toLowerCase() === normalizedOwner) {
        return alias;
      }
    }
    return undefined;
  }

  setOwnerMapping(owner: string, alias: string): void {
    const config = this.load();
    config.ownerMapping[owner] = alias;
    this.save(config);
  }
}
