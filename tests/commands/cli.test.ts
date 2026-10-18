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
    expect(mockAdd).toHaveBeenCalledWith('personal', expect.anything());
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
});
