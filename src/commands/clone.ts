import { ConfigStore } from '../config/config-store.js';
import type { CredentialStore } from '../credentials/credential-store.js';
import { OsCredentialStore } from '../credentials/os-credential-store.js';
import { parseGitHubUrl } from '../git/url-parser.js';
import {
  cloneRepository,
  validateDestination,
} from '../git/clone-repository.js';
import { resolveTarget } from '../git/resolve-target.js';
import { identityConfigArgs, setLocalIdentity } from '../git/set-identity.js';
import { promptAccountSelection } from '../prompts/account-prompts.js';
import { promptCloneConfirmation } from '../prompts/clone-prompts.js';

export interface HandleCloneDependencies {
  configStore?: ConfigStore;
  credentialStore?: CredentialStore;
  promptAccountSelection?: typeof promptAccountSelection;
  promptCloneConfirmation?: typeof promptCloneConfirmation;
  cloneRepository?: typeof cloneRepository;
  setLocalIdentity?: typeof setLocalIdentity;
  logger?: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export const quoteArg = (a: string) =>
  /^[\w.@/:=-]+$/.test(a) ? a : JSON.stringify(a);

export async function handleClone(
  rawUrl: string,
  explicitDestination?: string,
  deps?: HandleCloneDependencies,
): Promise<void> {
  const configStore = deps?.configStore ?? new ConfigStore();
  const credentialStore = deps?.credentialStore ?? new OsCredentialStore();
  const promptSelectionFn =
    deps?.promptAccountSelection ?? promptAccountSelection;
  const promptConfirmationFn =
    deps?.promptCloneConfirmation ?? promptCloneConfirmation;
  const cloneRepoFn = deps?.cloneRepository ?? cloneRepository;
  const setIdentityFn = deps?.setLocalIdentity ?? setLocalIdentity;
  const logger = deps?.logger ?? console;

  // Step 1: Validate repository URL
  const parsed = parseGitHubUrl(rawUrl);
  const destination = explicitDestination ?? parsed.defaultDestination;

  // Validate destination does not conflict with existing files/folders
  const destCheck = validateDestination(destination);
  if (!destCheck.valid) {
    throw new Error(destCheck.error);
  }

  // Step 2: Select GitHub account
  const accounts = configStore.listAccounts();
  const aliases = Object.keys(accounts);

  if (aliases.length === 0) {
    throw new Error(
      'No accounts configured. Please add an account first using: ghx account add <alias>',
    );
  }

  // Check if repository owner matches an owner-to-account mapping
  const preselected = configStore.getAccountForOwner(parsed.owner);

  const selectedAlias = await promptSelectionFn(accounts, preselected);
  const selectedAccount = accounts[selectedAlias];
  if (!selectedAccount) {
    throw new Error(`Account "${selectedAlias}" not found in configuration.`);
  }

  // Step 3: Show command preview & ask for confirmation
  const formattedDest =
    destination.startsWith('.') || destination.startsWith('/')
      ? destination
      : `./${destination}`;

  // Throws before any prompt/secret access if an SSH URL has no usable ssh_host.
  const target = resolveTarget(parsed, selectedAlias, selectedAccount);

  const confirmed = await promptConfirmationFn({
    alias: selectedAlias,
    repository: `${parsed.owner}/${parsed.repo}`,
    destination: formattedDest,
    maskedUrl: target.displayUrl,
    protocol: target.protocol,
    extraCommands: identityConfigArgs(selectedAccount).map(
      (a) => `git -C ${formattedDest} ${a.map(quoteArg).join(' ')}`,
    ),
  });

  if (!confirmed) {
    logger.log('Clone cancelled.');
    return;
  }

  // Step 4: HTTPS fetches the PAT from the credential store; SSH never does.
  let auth: { username: string; token: string } | undefined;
  if (target.protocol === 'https') {
    const pat = await credentialStore.getSecret(selectedAccount.credentialRef);
    if (!pat) {
      throw new Error(
        `Personal Access Token for account "${selectedAlias}" could not be found in the credential store. Please re-add it using: ghx account add ${selectedAlias}`,
      );
    }
    auth = { username: selectedAccount.username, token: pat };
  }

  // Step 5: Execute clone securely
  logger.log('Cloning repository...');
  const result = await cloneRepoFn({
    url: target.sshUrl ?? parsed.cloneUrl,
    destination,
    ...auth,
  });

  if (!result.success) {
    throw new Error(result.error || 'Git clone failed.');
  }

  const identity = setIdentityFn({
    name: selectedAccount.name,
    email: selectedAccount.email,
    cwd: destination,
  });
  if (!identity.success) {
    throw new Error(
      `Repository cloned, but setting local git identity failed: ${identity.error}`,
    );
  }

  logger.log('✓ Repository cloned successfully.');
  logger.log(`Location: ${formattedDest}`);
}
