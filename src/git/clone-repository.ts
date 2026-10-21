import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createScopedCredentialSession } from './credential-helper-server.js';

export interface CloneOptions {
  url: string;
  destination: string;
  /** username + token: HTTPS via credential helper. Omit both for SSH. */
  username?: string;
  token?: string;
  spawnGit?: typeof spawn;
  skipGitCheck?: boolean;
}

export interface CloneResult {
  success: boolean;
  location: string;
  error?: string;
}

export function isGitInstalled(): boolean {
  try {
    const result = spawnSync('git', ['--version'], { encoding: 'utf-8' });
    return result.status === 0;
  } catch {
    return false;
  }
}

export function validateDestination(destination: string): {
  valid: boolean;
  error?: string;
} {
  if (fs.existsSync(destination)) {
    const stat = fs.statSync(destination);
    if (!stat.isDirectory()) {
      return {
        valid: false,
        error: `Destination path "${destination}" already exists and is a file.`,
      };
    }
    const files = fs.readdirSync(destination);
    if (files.length > 0) {
      return {
        valid: false,
        error: `Destination path "${destination}" already exists and is not empty.`,
      };
    }
  }
  return { valid: true };
}

export async function cloneRepository(
  options: CloneOptions,
): Promise<CloneResult> {
  const {
    url,
    destination,
    username,
    token,
    spawnGit = spawn,
    skipGitCheck = false,
  } = options;

  if (!skipGitCheck && !isGitInstalled()) {
    return {
      success: false,
      location: destination,
      error:
        'Git is not installed or not found in PATH. Please install Git to use ghx.',
    };
  }

  const destValidation = validateDestination(destination);
  if (!destValidation.valid) {
    return {
      success: false,
      location: destination,
      error: destValidation.error,
    };
  }

  let session:
    Awaited<ReturnType<typeof createScopedCredentialSession>> | undefined;
  try {
    if (username && token) {
      session = await createScopedCredentialSession(username, token);
    }
  } catch (err: any) {
    return {
      success: false,
      location: destination,
      error: `Failed to initialize secure authentication session: ${err?.message || String(err)}`,
    };
  }

  try {
    const gitArgs = [
      ...(session
        ? [
            '-c',
            'credential.helper=',
            '-c',
            `credential.helper=${session.helperScriptPath}`,
          ]
        : []),
      'clone',
      url,
      destination,
    ];

    const childEnv = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    };

    let failureReason: string | undefined;

    const exitCode = await new Promise<number>((resolve, reject) => {
      let stderrOutput = '';

      const child = spawnGit('git', gitArgs, {
        env: childEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const killChild = () => child.kill();
      process.once('exit', killChild);
      child.on('close', () => process.off('exit', killChild));

      child.stdout?.on('data', () => {});

      child.stderr?.on('data', (chunk) => {
        stderrOutput += chunk.toString('utf-8');
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(0);
        } else {
          let translatedError = stderrOutput.trim();

          const lower = stderrOutput.toLowerCase();
          if (!session) {
            // SSH: keep git/ssh's own message (e.g. "Permission denied (publickey)").
          } else if (
            lower.includes('authentication failed') ||
            lower.includes('401') ||
            lower.includes('403')
          ) {
            translatedError = `GitHub authentication failed for account "${username}". Please verify your Personal Access Token has the necessary repository permissions.`;
          } else if (
            lower.includes('repository not found') ||
            lower.includes('could not read from remote repository')
          ) {
            translatedError = `Repository not found or insufficient permissions. Please verify the URL and account access rights.`;
          }

          if (token && translatedError.includes(token)) {
            translatedError = translatedError.replaceAll(token, '********');
          }

          failureReason = translatedError || 'Git clone failed.';
          resolve(code ?? 1);
        }
      });
    });

    if (exitCode === 0) {
      return {
        success: true,
        location: destination,
      };
    } else {
      return {
        success: false,
        location: destination,
        error: failureReason || 'Git clone failed.',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      location: destination,
      error: `Git clone execution error: ${err?.message || String(err)}`,
    };
  } finally {
    if (session) {
      await session.cleanup();
    }
  }
}
