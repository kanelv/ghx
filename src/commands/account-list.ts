import { ConfigStore } from '../config/config-store.js';

export interface HandleAccountListDependencies {
  configStore?: ConfigStore;
  logger?: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export async function handleAccountList(deps?: HandleAccountListDependencies): Promise<void> {
  const configStore = deps?.configStore ?? new ConfigStore();
  const logger = deps?.logger ?? console;

  const accounts = configStore.listAccounts();
  const aliases = Object.keys(accounts);

  if (aliases.length === 0) {
    logger.log('No accounts configured. Run "ghx account add <alias>" to add an account.');
    return;
  }

  const maxAliasLen = Math.max(...aliases.map((a) => a.length));

  logger.log('Configured GitHub accounts:\n');
  for (const alias of aliases) {
    const acc = accounts[alias];
    const paddedAlias = alias.padEnd(maxAliasLen, ' ');
    logger.log(`  ${paddedAlias}  (${acc.username})`);
  }
  logger.log('');
}
