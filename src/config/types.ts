export interface AccountConfig {
  username: string;
  credentialRef: string;
}

export interface GhxConfig {
  accounts: Record<string, AccountConfig>;
  ownerMapping: Record<string, string>;
}
