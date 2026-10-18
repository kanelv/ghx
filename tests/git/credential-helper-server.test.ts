import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createScopedCredentialSession } from '../../src/git/credential-helper-server.js';

function runHelper(
  scriptPath: string,
  args: string[],
  input: string,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(scriptPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf-8');
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

describe('Scoped Credential Helper Server', () => {
  it('creates helper script and serves credentials over Unix domain socket for github.com', async () => {
    const session = await createScopedCredentialSession(
      'company-user',
      'ghp_secret_token_abc',
    );
    try {
      expect(fs.existsSync(session.helperScriptPath)).toBe(true);

      if (process.platform !== 'win32') {
        const stat = fs.statSync(session.helperScriptPath);
        expect(stat.mode & 0o777).toBe(0o700);
      }

      const query = 'protocol=https\nhost=github.com\n\n';
      const result = await runHelper(session.helperScriptPath, ['get'], query);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('username=company-user');
      expect(result.stdout).toContain('password=ghp_secret_token_abc');
    } finally {
      await session.cleanup();
    }

    expect(fs.existsSync(session.helperScriptPath)).toBe(false);
  });

  it('refuses to return credentials for non-GitHub hosts or non-HTTPS protocol', async () => {
    const session = await createScopedCredentialSession(
      'company-user',
      'ghp_secret_token_abc',
    );
    try {
      const gitlabQuery = 'protocol=https\nhost=gitlab.com\n\n';
      const resultGitlab = await runHelper(
        session.helperScriptPath,
        ['get'],
        gitlabQuery,
      );
      expect(resultGitlab.stdout.trim()).toBe('');

      const httpQuery = 'protocol=http\nhost=github.com\n\n';
      const resultHttp = await runHelper(
        session.helperScriptPath,
        ['get'],
        httpQuery,
      );
      expect(resultHttp.stdout.trim()).toBe('');
    } finally {
      await session.cleanup();
    }
  });

  it('no-ops on store and erase actions', async () => {
    const session = await createScopedCredentialSession(
      'company-user',
      'ghp_secret_token_abc',
    );
    try {
      const storeResult = await runHelper(
        session.helperScriptPath,
        ['store'],
        'protocol=https\nhost=github.com\nusername=company-user\n\n',
      );
      expect(storeResult.status).toBe(0);

      const eraseResult = await runHelper(
        session.helperScriptPath,
        ['erase'],
        'protocol=https\nhost=github.com\nusername=company-user\n\n',
      );
      expect(eraseResult.status).toBe(0);
    } finally {
      await session.cleanup();
    }
  });
});
