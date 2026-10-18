import { spawnSync } from 'node:child_process';

export interface AddRemoteOptions {
  name: string;
  url: string;
  token?: string;
  cwd?: string;
}

export interface AddRemoteResult {
  success: boolean;
  error?: string;
}

// ponytail: url may embed the PAT, so it is stored in plaintext in .git/config and visible in argv; credential helper if that matters.
export function addRemote(options: AddRemoteOptions): AddRemoteResult {
  const result = spawnSync(
    'git',
    ['remote', 'add', options.name, options.url],
    {
      cwd: options.cwd,
      encoding: 'utf-8',
    },
  );
  if (result.error) {
    return {
      success: false,
      error:
        'Git is not installed or not found in PATH. Please install Git to use ghx.',
    };
  }
  if (result.status !== 0) {
    let error = result.stderr.trim() || 'git remote add failed.';
    if (options.token) {
      error = error.replaceAll(options.token, '********');
    }
    return { success: false, error };
  }
  return { success: true };
}
