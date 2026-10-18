export interface CredentialStoreAvailability {
  available: boolean;
  error?: string;
}

export interface CredentialStore {
  getSecret(credentialRef: string): Promise<string | null>;
  setSecret(credentialRef: string, secret: string): Promise<void>;
  deleteSecret(credentialRef: string): Promise<boolean>;
  isAvailable(): Promise<CredentialStoreAvailability>;
}

export class CredentialStoreError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CredentialStoreError';
  }
}
