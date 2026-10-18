import { ConfigStore } from '../config/config-store.js';
import { promptAccountProfile } from '../prompts/account-prompts.js';

export interface HandleAccountUpdateDependencies {
  configStore?: ConfigStore;
  promptAccountProfile?: typeof promptAccountProfile;
  logger?: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export async function handleAccountUpdate(
  alias: string,
  deps?: HandleAccountUpdateDependencies,
): Promise<void> {
  const configStore = deps?.configStore ?? new ConfigStore();
  const promptFn = deps?.promptAccountProfile ?? promptAccountProfile;
  const logger = deps?.logger ?? console;

  const existing = configStore.getAccount(alias);
  if (!existing) {
    throw new Error(
      `Account "${alias}" not found. Add it first using: ghx account add ${alias}`,
    );
  }

  const profile = await promptFn(undefined, {
    existingUsername: existing.username,
    existingName: existing.name,
    existingEmail: existing.email,
  });

  // credentialRef is derived from the alias, so the stored PAT stays valid as-is.
  configStore.setAccount(alias, {
    username: profile.username,
    credentialRef: existing.credentialRef,
    ...(profile.name && { name: profile.name }),
    ...(profile.email && { email: profile.email }),
  });

  if (!configStore.getAccountForOwner(profile.username)) {
    configStore.setOwnerMapping(profile.username, alias);
  }

  logger.log(`✓ Account "${alias}" (${profile.username}) updated.`);
}
