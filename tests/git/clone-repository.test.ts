import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { cloneRepository } from '../../src/git/clone-repository.js';

describe('cloneRepository', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghx-clone-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects if destination directory exists and is not empty', async () => {
    const existingDest = path.join(tmpDir, 'existing-project');
    fs.mkdirSync(existingDest);
    fs.writeFileSync(path.join(existingDest, 'file.txt'), 'content');

    const result = await cloneRepository({
      url: 'https://github.com/org/repo.git',
      destination: existingDest,
      username: 'test-user',
      token: 'ghp_secret_123',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists and is not empty');
  });

  it('spawns git with argument array and resets global credential helpers', async () => {
    const spawnedCalls: any[] = [];
    const mockSpawn = vi.fn().mockImplementation((command, args, options) => {
      spawnedCalls.push({ command, args, options });
      return {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: (event: string, callback: any) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        },
      };
    });

    const dest = path.join(tmpDir, 'new-project');
    const result = await cloneRepository({
      url: 'https://github.com/org/repo.git',
      destination: dest,
      username: 'company-user',
      token: 'ghp_secret_456',
      spawnGit: mockSpawn as any,
      skipGitCheck: true,
    });

    expect(result.success).toBe(true);
    expect(mockSpawn).toHaveBeenCalled();

    const call = spawnedCalls[0];
    expect(call.command).toBe('git');
    expect(call.args).toContain('-c');
    expect(call.args).toContain('credential.helper='); // Clears global helper
    expect(call.args).toEqual(
      expect.arrayContaining([
        '-c',
        'credential.helper=',
        'clone',
        'https://github.com/org/repo.git',
        dest,
      ]),
    );

    // Verify PAT is NEVER in process arguments or URL
    const allArgsString = call.args.join(' ');
    expect(allArgsString).not.toContain('ghp_secret_456');

    // Verify environment sets GIT_TERMINAL_PROMPT=0
    expect(call.options.env.GIT_TERMINAL_PROMPT).toBe('0');
  });

  it('translates git authentication failures into secret-safe actionable messages', async () => {
    const mockSpawn = vi.fn().mockImplementation(() => {
      let stderrCallback: any;
      return {
        stdout: { on: vi.fn() },
        stderr: {
          on: (event: string, cb: any) => {
            if (event === 'data') {
              stderrCallback = cb;
            }
          },
        },
        on: (event: string, callback: any) => {
          if (event === 'close') {
            setTimeout(() => {
              stderrCallback?.(
                Buffer.from(
                  'fatal: Authentication failed for "https://github.com/org/repo.git/"',
                ),
              );
              callback(128);
            }, 10);
          }
        },
      };
    });

    const dest = path.join(tmpDir, 'fail-project');
    const result = await cloneRepository({
      url: 'https://github.com/org/repo.git',
      destination: dest,
      username: 'company-user',
      token: 'ghp_invalid_token',
      spawnGit: mockSpawn as any,
      skipGitCheck: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain(
      'GitHub authentication failed for account "company-user"',
    );
    expect(result.error).not.toContain('ghp_invalid_token');
  });

  it('translates repository not found errors safely', async () => {
    const mockSpawn = vi.fn().mockImplementation(() => {
      let stderrCallback: any;
      return {
        stdout: { on: vi.fn() },
        stderr: {
          on: (event: string, cb: any) => {
            if (event === 'data') {
              stderrCallback = cb;
            }
          },
        },
        on: (event: string, callback: any) => {
          if (event === 'close') {
            setTimeout(() => {
              stderrCallback?.(
                Buffer.from(
                  'ERROR: Repository not found. fatal: Could not read from remote repository.',
                ),
              );
              callback(128);
            }, 10);
          }
        },
      };
    });

    const dest = path.join(tmpDir, 'notfound-project');
    const result = await cloneRepository({
      url: 'https://github.com/org/nonexistent.git',
      destination: dest,
      username: 'personal-user',
      token: 'ghp_token',
      spawnGit: mockSpawn as any,
      skipGitCheck: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain(
      'Repository not found or insufficient permissions',
    );
  });

  it('SSH: runs plain git clone with no credential helper and keeps ssh errors', async () => {
    const calls: any[] = [];
    const mockSpawn = vi.fn().mockImplementation((command, args, options) => {
      calls.push({ command, args, options });
      let errCb: any;
      return {
        stdout: { on: vi.fn() },
        stderr: {
          on: (e: string, cb: any) => {
            if (e === 'data') errCb = cb;
          },
        },
        on: (event: string, callback: any) => {
          if (event === 'close') {
            setTimeout(() => {
              errCb?.(Buffer.from('git@gh.a: Permission denied (publickey).'));
              callback(128);
            }, 5);
          }
        },
      };
    });

    const dest = path.join(tmpDir, 'ssh-project');
    const result = await cloneRepository({
      url: 'git@gh.a:org/repo.git',
      destination: dest,
      spawnGit: mockSpawn as any,
      skipGitCheck: true,
    });

    expect(calls[0].args).toEqual(['clone', 'git@gh.a:org/repo.git', dest]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Permission denied (publickey)');
  });
});
