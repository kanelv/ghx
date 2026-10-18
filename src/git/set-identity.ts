import { spawnSync } from 'node:child_process';

export interface SetIdentityOptions {
  name?: string;
  email?: string;
  cwd: string;
}

export interface SetIdentityResult {
  success: boolean;
  error?: string;
}

export function identityConfigArgs(opts: {
  name?: string;
  email?: string;
}): string[][] {
  const args: string[][] = [];
  if (opts.name) args.push(['config', '--local', 'user.name', opts.name]);
  if (opts.email) args.push(['config', '--local', 'user.email', opts.email]);
  return args;
}

export function setLocalIdentity(opts: SetIdentityOptions): SetIdentityResult {
  for (const args of identityConfigArgs(opts)) {
    const result = spawnSync('git', args, { cwd: opts.cwd, encoding: 'utf-8' });
    if (result.error || result.status !== 0) {
      return {
        success: false,
        error: result.stderr?.trim() || 'git config failed.',
      };
    }
  }
  return { success: true };
}
