import { describe, it, expect, vi } from 'vitest';
import { createCli } from '../../src/cli.js';

describe('CLI argument parsing and command dispatch', () => {
  it('registers expected commands and displays help', async () => {
    const cli = createCli();
    const helpInformation = cli.helpInformation();

    expect(helpInformation).toContain('ghx');
    expect(helpInformation).toContain('account');
    expect(helpInformation).toContain('clone');
  });

  it('dispatches account list command', async () => {
    const mockList = vi.fn().mockResolvedValue(undefined);
    const cli = createCli({
      handleAccountList: mockList,
    });

    await cli.parseAsync(['node', 'ghx', 'account', 'list']);
    expect(mockList).toHaveBeenCalled();
  });

  it('dispatches account add command with alias', async () => {
    const mockAdd = vi.fn().mockResolvedValue(undefined);
    const cli = createCli({
      handleAccountAdd: mockAdd,
    });

    await cli.parseAsync(['node', 'ghx', 'account', 'add', 'personal']);
    expect(mockAdd).toHaveBeenCalledWith('personal', expect.anything(), {
      sshOnly: undefined,
    });
  });

  it('dispatches account update command with alias', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const cli = createCli({ handleAccountUpdate: mockUpdate });

    await cli.parseAsync(['node', 'ghx', 'account', 'update', 'work']);
    expect(mockUpdate).toHaveBeenCalledWith('work', expect.anything());
  });

  it('dispatches clone command with url and optional destination', async () => {
    const mockClone = vi.fn().mockResolvedValue(undefined);
    const cli = createCli({
      handleClone: mockClone,
    });

    await cli.parseAsync([
      'node',
      'ghx',
      'clone',
      'https://github.com/org/repo.git',
      './custom-dir',
    ]);
    expect(mockClone).toHaveBeenCalledWith(
      'https://github.com/org/repo.git',
      './custom-dir',
      expect.anything(),
    );
  });

  it('dispatches remote add and the legacy git remote add', async () => {
    const mockRemote = vi.fn().mockResolvedValue(undefined);
    const cli = createCli({ handleRemoteAdd: mockRemote });
    await cli.parseAsync([
      'node',
      'ghx',
      'remote',
      'add',
      'origin',
      'git@gh.a:o/r.git',
    ]);
    await cli.parseAsync([
      'node',
      'ghx',
      'git',
      'remote',
      'add',
      'origin',
      'git@gh.a:o/r.git',
    ]);
    expect(mockRemote).toHaveBeenCalledTimes(2);
    expect(mockRemote).toHaveBeenCalledWith(
      'origin',
      'git@gh.a:o/r.git',
      expect.anything(),
    );
  });

  it('passes --ssh-only to account add', async () => {
    const mockAdd = vi.fn().mockResolvedValue(undefined);
    const cli = createCli({ handleAccountAdd: mockAdd });
    await cli.parseAsync(['node', 'ghx', 'account', 'add', 'x', '--ssh-only']);
    expect(mockAdd).toHaveBeenCalledWith('x', expect.anything(), {
      sshOnly: true,
    });
  });
});
