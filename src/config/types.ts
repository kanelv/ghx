export interface AccountConfig {
  username: string;
  credentialRef: string;
  name?: string;
  email?: string;
  /** Host alias from ~/.ssh/config (not a key path). */
  sshHost?: string;
}

export interface GhxConfig {
  accounts: Record<string, AccountConfig>;
  ownerMapping: Record<string, string>;
}
