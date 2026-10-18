import type {
  CredentialStore,
  CredentialStoreAvailability,
} from './credential-store.js';

export class MemoryCredentialStore implements CredentialStore {
  private readonly storage = new Map<string, string>();

  async getSecret(credentialRef: string): Promise<string | null> {
    return this.storage.get(credentialRef) ?? null;
  }

  async setSecret(credentialRef: string, secret: string): Promise<void> {
    this.storage.set(credentialRef, secret);
  }

  async deleteSecret(credentialRef: string): Promise<boolean> {
    return this.storage.delete(credentialRef);
  }

  async isAvailable(): Promise<CredentialStoreAvailability> {
    return { available: true };
  }
}
