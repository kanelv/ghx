import { ConfigStore } from '../config/config-store.js';
import type { CredentialStore } from '../credentials/credential-store.js';
import { OsCredentialStore } from '../credentials/os-credential-store.js';
import { promptAccountDetails } from '../prompts/account-prompts.js';

export interface HandleAccountAddOptions {
  /** SSH-only account: no PAT is prompted or stored. */
  sshOnly?: boolean;
}

export interface HandleAccountAddDependencies {
  configStore?: ConfigStore;
  credentialStore?: CredentialStore;
  promptAccountDetails?: typeof promptAccountDetails;
  logger?: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export async function handleAccountAdd(
  alias: string,
  deps?: HandleAccountAddDependencies,
  options?: HandleAccountAddOptions,
): Promise<void> {
  const configStore = deps?.configStore ?? new ConfigStore();
  const credentialStore = deps?.credentialStore ?? new OsCredentialStore();
  const promptDetailsFn = deps?.promptAccountDetails ?? promptAccountDetails;
  const logger = deps?.logger ?? console;

  const validation = configStore.validateAlias(alias);
  if (!validation.valid) {
    throw new Error(`Invalid account alias "${alias}": ${validation.error}`);
  }

  const existing = configStore.getAccount(alias);
  if (existing) {
    logger.log(`Existing account "${alias}" found. Updating credentials...`);
  }

  if (!options?.sshOnly) {
    const credAvailability = await credentialStore.isAvailable();
    if (!credAvailability.available) {
      throw new Error(
        `Cannot access OS credential store: ${credAvailability.error || 'Credential store is unavailable.'}`,
      );
    }
  }

  const details = await promptDetailsFn(undefined, {
    existingUsername: existing?.username,
    existingName: existing?.name,
    existingEmail: existing?.email,
    existingSshHost: existing?.sshHost,
    skipPat: options?.sshOnly,
  });

  const credentialRef = existing?.credentialRef ?? `ghx-${alias}`;

  if (details.pat !== undefined) {
    await credentialStore.setSecret(credentialRef, details.pat);
  }

  configStore.setAccount(alias, {
    username: details.username,
    credentialRef,
    ...(details.name && { name: details.name }),
    ...(details.email && { email: details.email }),
    ...(details.sshHost && { sshHost: details.sshHost }),
  });

  // Automatically map the GitHub username to this account alias if not already mapped
  const existingOwnerMapping = configStore.getAccountForOwner(details.username);
  if (!existingOwnerMapping) {
    configStore.setOwnerMapping(details.username, alias);
  }

  logger.log(
    `✓ Account "${alias}" (${details.username}) configured successfully.`,
  );
}
