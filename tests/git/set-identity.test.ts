import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  identityConfigArgs,
  setLocalIdentity,
} from '../../src/git/set-identity.js';

describe('set-identity', () => {
  it('builds no args when identity is empty', () => {
    expect(identityConfigArgs({})).toEqual([]);
  });

  it('writes local user.name and user.email', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghx-ident-'));
    try {
      spawnSync('git', ['init'], { cwd: dir });
      const r = setLocalIdentity({ name: 'A B', email: 'a@b.co', cwd: dir });
      expect(r.success).toBe(true);
      const get = (k: string) =>
        spawnSync('git', ['config', '--local', k], {
          cwd: dir,
          encoding: 'utf-8',
        }).stdout.trim();
      expect(get('user.name')).toBe('A B');
      expect(get('user.email')).toBe('a@b.co');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
