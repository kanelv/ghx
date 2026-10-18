import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryCredentialStore } from '../../src/credentials/memory-credential-store.js';
import { OsCredentialStore } from '../../src/credentials/os-credential-store.js';

describe('CredentialStore', () => {
  describe('MemoryCredentialStore', () => {
    let store: MemoryCredentialStore;

    beforeEach(() => {
      store = new MemoryCredentialStore();
    });

    it('sets and retrieves secrets', async () => {
      await store.setSecret('ghx-personal', 'ghp_secret_123');
      const retrieved = await store.getSecret('ghx-personal');
      expect(retrieved).toBe('ghp_secret_123');
    });

    it('returns null for missing secrets', async () => {
      const retrieved = await store.getSecret('non-existent');
      expect(retrieved).toBeNull();
    });

    it('deletes secrets and returns true if deleted, false if not found', async () => {
      await store.setSecret('ghx-work', 'ghp_work_456');
      const deleted = await store.deleteSecret('ghx-work');
      expect(deleted).toBe(true);
      expect(await store.getSecret('ghx-work')).toBeNull();

      const deletedAgain = await store.deleteSecret('ghx-work');
      expect(deletedAgain).toBe(false);
    });

    it('reports available status', async () => {
      const status = await store.isAvailable();
      expect(status.available).toBe(true);
    });
  });

  describe('OsCredentialStore with mocked @napi-rs/keyring', () => {
    it('sets, gets, and deletes password using Entry', async () => {
      const mockSetPassword = vi.fn();
      const mockGetPassword = vi.fn().mockReturnValue('ghp_os_secret_789');
      const mockDeletePassword = vi.fn().mockReturnValue(true);

      class MockEntry {
        constructor(public service: string, public user: string) {}
        setPassword = mockSetPassword;
        getPassword = mockGetPassword;
        deletePassword = mockDeletePassword;
      }
      const mockEntryClass = vi.fn().mockImplementation((service: string, user: string) => {
        return new MockEntry(service, user);
      });

      const store = new OsCredentialStore('ghx-test', {
        EntryClass: MockEntry as any,
      });

      await store.setSecret('ghx-personal', 'ghp_os_secret_789');
      expect(mockSetPassword).toHaveBeenCalledWith('ghp_os_secret_789');

      const retrieved = await store.getSecret('ghx-personal');
      expect(retrieved).toBe('ghp_os_secret_789');

      const deleted = await store.deleteSecret('ghx-personal');
      expect(deleted).toBe(true);
    });

    it('returns null when password is not found (null or NoEntry error)', async () => {
      class MockMissingEntry {
        getPassword() {
          const err: any = new Error('No such password');
          err.code = 'NoEntry';
          throw err;
        }
      }

      const store = new OsCredentialStore('ghx-test', {
        EntryClass: MockMissingEntry as any,
      });

      const secret = await store.getSecret('missing');
      expect(secret).toBeNull();
    });

    it('handles store unavailability with clear actionable resolution message', async () => {
      class MockUnavailableEntry {
        constructor() {
          throw new Error('D-Bus daemon not running or secret service unreachable');
        }
      }

      const store = new OsCredentialStore('ghx-test', {
        EntryClass: MockUnavailableEntry as any,
      });

      const status = await store.isAvailable();
      expect(status.available).toBe(false);
      expect(status.error).toContain('secret service');

      await expect(store.setSecret('ref', 'secret')).rejects.toThrow(
        /credential store is unavailable|D-Bus|secret service/i,
      );
    });
  });
});
