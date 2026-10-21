import { describe, it, expect } from 'vitest';
import { buildSshUrl, parseGitHubUrl } from '../../src/git/url-parser.js';

describe('parseGitHubUrl', () => {
  it('parses valid HTTPS GitHub URLs with .git', () => {
    const result = parseGitHubUrl(
      'https://github.com/company-org/my-project.git',
    );
    expect(result).toEqual({
      protocol: 'https',
      owner: 'company-org',
      repo: 'my-project',
      cloneUrl: 'https://github.com/company-org/my-project.git',
      defaultDestination: 'my-project',
    });
  });

  it('parses valid HTTPS GitHub URLs without .git', () => {
    const result = parseGitHubUrl(
      'https://github.com/personal-account/sample-repo',
    );
    expect(result).toEqual({
      protocol: 'https',
      owner: 'personal-account',
      repo: 'sample-repo',
      cloneUrl: 'https://github.com/personal-account/sample-repo.git',
      defaultDestination: 'sample-repo',
    });
  });

  it('handles trailing slashes', () => {
    const result = parseGitHubUrl('https://github.com/company/repo/');
    expect(result).toEqual({
      protocol: 'https',
      owner: 'company',
      repo: 'repo',
      cloneUrl: 'https://github.com/company/repo.git',
      defaultDestination: 'repo',
    });
  });

  it('rejects URLs with embedded credentials for security', () => {
    expect(() =>
      parseGitHubUrl('https://user:password@github.com/owner/repo.git'),
    ).toThrow(/embedded credentials/i);
  });

  it('parses scp-style SSH URLs with github.com and aliases', () => {
    expect(parseGitHubUrl('git@github.com:owner/repo.git')).toEqual({
      protocol: 'ssh',
      owner: 'owner',
      repo: 'repo',
      cloneUrl: 'git@github.com:owner/repo.git',
      defaultDestination: 'repo',
      sshForm: 'scp',
      sshHost: 'github.com',
    });
    const a = parseGitHubUrl('git@gh.a:customer-a/project');
    expect(a).toMatchObject({
      protocol: 'ssh',
      sshHost: 'gh.a',
      cloneUrl: 'git@gh.a:customer-a/project.git',
    });
    expect(parseGitHubUrl('git@gh.b:customer-b/project.git').sshHost).toBe(
      'gh.b',
    );
  });

  it('parses ssh:// URLs', () => {
    expect(parseGitHubUrl('ssh://git@gh.a/owner/repo.git')).toMatchObject({
      protocol: 'ssh',
      sshForm: 'url',
      sshHost: 'gh.a',
      owner: 'owner',
      repo: 'repo',
      cloneUrl: 'ssh://git@gh.a/owner/repo.git',
    });
    expect(parseGitHubUrl('ssh://git@github.com/o/r').cloneUrl).toBe(
      'ssh://git@github.com/o/r.git',
    );
  });

  it('builds SSH URLs with a replacement host, keeping form and path', () => {
    expect(buildSshUrl(parseGitHubUrl('git@github.com:o/r.git'), 'gh.a')).toBe(
      'git@gh.a:o/r.git',
    );
    expect(
      buildSshUrl(parseGitHubUrl('ssh://git@github.com/o/r.git'), 'gh.a'),
    ).toBe('ssh://git@gh.a/o/r.git');
  });

  it('rejects malformed or unsafe SSH URLs', () => {
    for (const bad of [
      'git@gh.a:owner',
      'git@gh.a:owner/repo/extra',
      'git@gh.a:',
      'git@-oProxyCommand=x:o/r.git',
      'user@gh.a:o/r.git',
      'ssh://user@gh.a/o/r.git',
      'ssh://git@gh.a:2222/o/r.git',
      'ssh://git@gh.a/owner',
      'ssh://git:pw@gh.a/o/r.git',
      'git@gh.a:o/r r.git',
    ]) {
      expect(() => parseGitHubUrl(bad), bad).toThrow(/SSH|Invalid/i);
    }
  });

  it('rejects non-HTTPS protocols (such as http:// or git://)', () => {
    expect(() => parseGitHubUrl('http://github.com/owner/repo.git')).toThrow(
      /HTTPS/i,
    );
    expect(() => parseGitHubUrl('git://github.com/owner/repo.git')).toThrow(
      /HTTPS/i,
    );
  });

  it('rejects non-GitHub hosts with clear message', () => {
    expect(() => parseGitHubUrl('https://gitlab.com/owner/repo.git')).toThrow(
      /Only github\.com repositories are supported/i,
    );
    expect(() =>
      parseGitHubUrl('https://bitbucket.org/owner/repo.git'),
    ).toThrow(/Only github\.com repositories are supported/i);
  });

  it('rejects malformed URLs', () => {
    expect(() => parseGitHubUrl('not-a-url')).toThrow(/Invalid URL/i);
    expect(() => parseGitHubUrl('https://github.com/')).toThrow(
      /Invalid repository path/i,
    );
    expect(() => parseGitHubUrl('https://github.com/owner')).toThrow(
      /Invalid repository path/i,
    );
  });
});
