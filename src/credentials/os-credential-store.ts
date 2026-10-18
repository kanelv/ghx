import { Entry } from '@napi-rs/keyring';
import type {
  CredentialStore,
  CredentialStoreAvailability,
} from './credential-store.js';
import { CredentialStoreError } from './credential-store.js';

export interface OsCredentialStoreOptions {
  EntryClass?: typeof Entry;
}

export class OsCredentialStore implements CredentialStore {
  private readonly serviceName: string;
  private readonly EntryClass: typeof Entry;

  constructor(serviceName: string = 'ghx', options?: OsCredentialStoreOptions) {
    this.serviceName = serviceName;
    this.EntryClass = options?.EntryClass ?? Entry;
  }

  private createEntry(credentialRef: string): Entry {
    try {
      if (process.platform === 'linux') {
        // On Linux, use Secret Service
        return new this.EntryClass(this.serviceName, credentialRef, {
          linux: { store: 'secret-service' },
        });
      }
      return new this.EntryClass(this.serviceName, credentialRef);
    } catch (err: any) {
      throw this.wrapError(err, 'Failed to initialize OS credential store');
    }
  }

  private wrapError(err: any, context: string): CredentialStoreError {
    const rawMsg = err?.message || String(err);
    let resolution = '';

    if (process.platform === 'linux') {
      resolution =
        ' On Linux, please verify that a Secret Service provider (such as gnome-keyring, KWallet, or KeePassXC) is installed and active in your desktop/D-Bus session.';
    } else if (process.platform === 'darwin') {
      resolution = ' On macOS, please ensure your Keychain is unlocked.';
    }

    return new CredentialStoreError(`${context}: ${rawMsg}.${resolution}`, err);
  }

  async isAvailable(): Promise<CredentialStoreAvailability> {
    try {
      // Test creating a temporary test entry
      const testRef = '__ghx_store_probe__';
      const entry = this.createEntry(testRef);
      // Attempting to read (will either succeed, return null, or throw NoEntry)
      try {
        entry.getPassword();
      } catch (err: any) {
        const msg = String(err?.message || err).toLowerCase();
        // If it's just "not found" / "noentry", the store is functional!
        if (
          msg.includes('not found') ||
          msg.includes('noentry') ||
          msg.includes('no such') ||
          err?.code === 'NoEntry'
        ) {
          return { available: true };
        }
        throw err;
      }
      return { available: true };
    } catch (err: any) {
      const wrapped = this.wrapError(err, 'OS credential store is unavailable');
      return { available: false, error: wrapped.message };
    }
  }

  async getSecret(credentialRef: string): Promise<string | null> {
    try {
      const entry = this.createEntry(credentialRef);
      try {
        const pass = entry.getPassword();
        return pass ?? null;
      } catch (err: any) {
        const msg = String(err?.message || err).toLowerCase();
        if (
          msg.includes('not found') ||
          msg.includes('noentry') ||
          msg.includes('no such') ||
          msg.includes('item not found') ||
          err?.code === 'NoEntry'
        ) {
          return null;
        }
        throw err;
      }
    } catch (err: any) {
      if (err instanceof CredentialStoreError) {
        throw err;
      }
      throw this.wrapError(
        err,
        `Failed to retrieve credential "${credentialRef}"`,
      );
    }
  }

  async setSecret(credentialRef: string, secret: string): Promise<void> {
    try {
      const entry = this.createEntry(credentialRef);
      entry.setPassword(secret);
    } catch (err: any) {
      if (err instanceof CredentialStoreError) {
        throw err;
      }
      throw this.wrapError(
        err,
        `Failed to store credential "${credentialRef}"`,
      );
    }
  }

  async deleteSecret(credentialRef: string): Promise<boolean> {
    try {
      const entry = this.createEntry(credentialRef);
      try {
        const result = entry.deletePassword();
        return result ?? true;
      } catch (err: any) {
        const msg = String(err?.message || err).toLowerCase();
        if (
          msg.includes('not found') ||
          msg.includes('noentry') ||
          msg.includes('no such') ||
          err?.code === 'NoEntry'
        ) {
          return false;
        }
        throw err;
      }
    } catch (err: any) {
      if (err instanceof CredentialStoreError) {
        throw err;
      }
      throw this.wrapError(
        err,
        `Failed to delete credential "${credentialRef}"`,
      );
    }
  }
}
