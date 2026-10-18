import { input, password } from '@inquirer/prompts';
import type { AccountConfig } from '../config/types.js';

export interface PromptAccountDetailsDependencies {
  input?: typeof input;
  password?: typeof password;
}

export interface PromptAccountDetailsOptions {
  existingUsername?: string;
  existingName?: string;
  existingEmail?: string;
}

const validateUsername = (val: string) =>
  !val || val.trim().length === 0 ? 'Username cannot be empty.' : true;

async function promptGitIdentity(
  inputFn: typeof input,
  options?: PromptAccountDetailsOptions,
): Promise<{ name?: string; email?: string }> {
  const name = (
    await inputFn({
      message: 'Git author name (optional, set as local user.name):',
      default: options?.existingName,
    })
  ).trim();
  const email = (
    await inputFn({
      message: 'Git author email (optional, set as local user.email):',
      default: options?.existingEmail,
    })
  ).trim();
  return { ...(name && { name }), ...(email && { email }) };
}

export async function promptAccountProfile(
  deps?: PromptAccountDetailsDependencies,
  options?: PromptAccountDetailsOptions,
): Promise<{ username: string; name?: string; email?: string }> {
  const inputFn = deps?.input ?? input;
  const username = await inputFn({
    message: 'GitHub username:',
    default: options?.existingUsername,
    validate: validateUsername,
  });
  return {
    username: username.trim(),
    ...(await promptGitIdentity(inputFn, options)),
  };
}

export async function promptAccountDetails(
  deps?: PromptAccountDetailsDependencies,
  options?: PromptAccountDetailsOptions,
): Promise<{
  username: string;
  pat: string;
  name?: string;
  email?: string;
}> {
  const inputFn = deps?.input ?? input;
  const passwordFn = deps?.password ?? password;

  const username = await inputFn({
    message: 'GitHub username:',
    default: options?.existingUsername,
    validate: (val: string) => {
      if (!val || val.trim().length === 0) {
        return 'Username cannot be empty.';
      }
      return true;
    },
  });

  const pat = await passwordFn({
    message: 'GitHub Personal Access Token (PAT):',
    mask: '*',
    validate: (val: string) => {
      if (!val || val.trim().length === 0) {
        return 'Personal Access Token cannot be empty.';
      }
      return true;
    },
  });

  const identity = await promptGitIdentity(inputFn, options);

  return {
    username: username.trim(),
    pat: pat.trim(),
    ...identity,
  };
}

export interface PromptAccountSelectionDependencies {
  select?: <T>(config: any) => Promise<T>;
}

export async function promptAccountSelection(
  accounts: Record<string, Pick<AccountConfig, 'username'>>,
  defaultAlias?: string,
  deps?: PromptAccountSelectionDependencies,
): Promise<string> {
  const aliases = Object.keys(accounts);
  if (aliases.length === 0) {
    throw new Error(
      'No accounts configured. Run "ghx account add <alias>" to configure a GitHub account first.',
    );
  }

  const maxAliasLen = Math.max(...aliases.map((a) => a.length));

  const choices = aliases.map((alias) => {
    const acc = accounts[alias];
    const paddedAlias = alias.padEnd(maxAliasLen, ' ');
    return {
      name: `${paddedAlias} (${acc.username})`,
      value: alias,
    };
  });

  let selectFn = deps?.select;
  if (!selectFn) {
    const inquirer = await import('@inquirer/prompts');
    selectFn = inquirer.select;
  }

  const selected = await selectFn<string>({
    message: 'Select a GitHub account:',
    choices,
    default: defaultAlias && accounts[defaultAlias] ? defaultAlias : aliases[0],
  });

  return selected;
}
