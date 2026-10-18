import { Command } from 'commander';
import { handleAccountAdd } from './commands/account-add.js';
import { handleAccountList } from './commands/account-list.js';
import { handleClone } from './commands/clone.js';
import { handleRemoteAdd } from './commands/remote-add.js';
import { ConfigStore } from './config/config-store.js';
import type { CredentialStore } from './credentials/credential-store.js';

export interface CliDependencies {
  configStore?: ConfigStore;
  credentialStore?: CredentialStore;
  handleAccountAdd?: typeof handleAccountAdd;
  handleAccountList?: typeof handleAccountList;
  handleClone?: typeof handleClone;
  handleRemoteAdd?: typeof handleRemoteAdd;
  logger?: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export function createCli(deps?: CliDependencies): Command {
  const program = new Command();
  const logger = deps?.logger ?? console;

  const addFn = deps?.handleAccountAdd ?? handleAccountAdd;
  const listFn = deps?.handleAccountList ?? handleAccountList;
  const cloneFn = deps?.handleClone ?? handleClone;
  const remoteAddFn = deps?.handleRemoteAdd ?? handleRemoteAdd;

  program
    .name('ghx')
    .description('A secure GitHub account manager and clone CLI')
    .version('0.1.0');

  const accountCmd = program
    .command('account')
    .description('Manage configured GitHub accounts');

  accountCmd
    .command('add <alias>')
    .description('Add or update a GitHub account')
    .action(async (alias: string) => {
      try {
        await addFn(alias, {
          configStore: deps?.configStore,
          credentialStore: deps?.credentialStore,
          logger,
        });
      } catch (err: any) {
        logger.error(`Error: ${err?.message || String(err)}`);
        process.exitCode = 1;
      }
    });

  accountCmd
    .command('list')
    .description('List all configured GitHub accounts')
    .action(async () => {
      try {
        await listFn({
          configStore: deps?.configStore,
          logger,
        });
      } catch (err: any) {
        logger.error(`Error: ${err?.message || String(err)}`);
        process.exitCode = 1;
      }
    });

  program
    .command('clone <url> [destination]')
    .description('Clone a GitHub repository securely using a selected account')
    .action(async (url: string, destination?: string) => {
      try {
        await cloneFn(url, destination, {
          configStore: deps?.configStore,
          credentialStore: deps?.credentialStore,
          logger,
        });
      } catch (err: any) {
        logger.error(`Error: ${err?.message || String(err)}`);
        process.exitCode = 1;
      }
    });

  program
    .command('git <args...>')
    .description(
      'Run a pasted git command with a selected account (supported: remote add <name> <url>)',
    )
    .action(async (args: string[]) => {
      try {
        const [sub, action, name, url, ...rest] = args;
        if (
          sub !== 'remote' ||
          action !== 'add' ||
          !name ||
          !url ||
          rest.length
        ) {
          throw new Error(
            'Unsupported git command. Supported: ghx git remote add <name> <url>',
          );
        }
        await remoteAddFn(name, url, {
          configStore: deps?.configStore,
          credentialStore: deps?.credentialStore,
          logger,
        });
      } catch (err: any) {
        logger.error(`Error: ${err?.message || String(err)}`);
        process.exitCode = 1;
      }
    });

  return program;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const cli = createCli();
  await cli.parseAsync(argv);
}
