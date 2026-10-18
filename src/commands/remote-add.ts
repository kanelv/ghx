import { ConfigStore } from '../config/config-store.js';
import type { CredentialStore } from '../credentials/credential-store.js';
import { OsCredentialStore } from '../credentials/os-credential-store.js';
import { parseGitHubUrl } from '../git/url-parser.js';
import { addRemote } from '../git/add-remote.js';
import { promptAccountSelection } from '../prompts/account-prompts.js';
import { promptCloneConfirmation } from '../prompts/clone-prompts.js';

export interface HandleRemoteAddDependencies {
  configStore?: ConfigStore;
  credentialStore?: CredentialStore;
  promptAccountSelection?: typeof promptAccountSelection;
  promptCloneConfirmation?: typeof promptCloneConfirmation;
  addRemote?: typeof addRemote;
  logger?: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export async function handleRemoteAdd(
  name: string,
  rawUrl: string,
  deps?: HandleRemoteAddDependencies,
): Promise<void> {
  const configStore = deps?.configStore ?? new ConfigStore();
  const credentialStore = deps?.credentialStore ?? new OsCredentialStore();
  const promptSelectionFn =
    deps?.promptAccountSelection ?? promptAccountSelection;
  const promptConfirmationFn =
    deps?.promptCloneConfirmation ?? promptCloneConfirmation;
  const addRemoteFn = deps?.addRemote ?? addRemote;
  const logger = deps?.logger ?? console;

  if (name.startsWith('-')) {
    throw new Error(`Invalid remote name "${name}".`);
  }

  const parsed = parseGitHubUrl(rawUrl);

  const accounts = configStore.listAccounts();
  if (Object.keys(accounts).length === 0) {
    throw new Error(
      'No accounts configured. Please add an account first using: ghx account add <alias>',
    );
  }

  const preselected = configStore.getAccountForOwner(parsed.owner);
  const selectedAlias = await promptSelectionFn(accounts, preselected);
  const selectedAccount = accounts[selectedAlias];
  if (!selectedAccount) {
    throw new Error(`Account "${selectedAlias}" not found in configuration.`);
  }

  const confirmed = await promptConfirmationFn({
    alias: selectedAlias,
    repository: `${parsed.owner}/${parsed.repo}`,
    command: `git remote add ${name}`,
    maskedUrl: `https://${selectedAccount.username}:********@github.com/${parsed.owner}/${parsed.repo}.git`,
  });

  if (!confirmed) {
    logger.log('Remote add cancelled.');
    return;
  }

  const pat = await credentialStore.getSecret(selectedAccount.credentialRef);
  if (!pat) {
    throw new Error(
      `Personal Access Token for account "${selectedAlias}" could not be found in the credential store. Please re-add it using: ghx account add ${selectedAlias}`,
    );
  }

  const user = encodeURIComponent(selectedAccount.username);
  const token = encodeURIComponent(pat);
  const result = addRemoteFn({
    name,
    url: `https://${user}:${token}@github.com/${parsed.owner}/${parsed.repo}.git`,
    token: pat,
  });
  if (!result.success) {
    throw new Error(result.error || 'git remote add failed.');
  }

  logger.log(`✓ Remote "${name}" set for ${parsed.owner}/${parsed.repo}`);
}
