export interface AccountConfig {
  username: string;
  credentialRef: string;
  name?: string;
  email?: string;
}

export interface GhxConfig {
  accounts: Record<string, AccountConfig>;
  ownerMapping: Record<string, string>;
}
