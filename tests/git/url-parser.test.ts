import { describe, it, expect } from 'vitest';
import { parseGitHubUrl } from '../../src/git/url-parser.js';

describe('parseGitHubUrl', () => {
  it('parses valid HTTPS GitHub URLs with .git', () => {
    const result = parseGitHubUrl('https://github.com/company-org/my-project.git');
    expect(result).toEqual({
      owner: 'company-org',
      repo: 'my-project',
      cloneUrl: 'https://github.com/company-org/my-project.git',
      defaultDestination: 'my-project',
    });
  });

  it('parses valid HTTPS GitHub URLs without .git', () => {
    const result = parseGitHubUrl('https://github.com/personal-account/sample-repo');
    expect(result).toEqual({
      owner: 'personal-account',
      repo: 'sample-repo',
      cloneUrl: 'https://github.com/personal-account/sample-repo.git',
      defaultDestination: 'sample-repo',
    });
  });

  it('handles trailing slashes', () => {
    const result = parseGitHubUrl('https://github.com/company/repo/');
    expect(result).toEqual({
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

  it('rejects SSH URLs and instructs the user to use HTTPS', () => {
    expect(() => parseGitHubUrl('git@github.com:owner/repo.git')).toThrow(
      /Only HTTPS GitHub repository URLs are supported/i,
    );
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
    expect(() => parseGitHubUrl('https://bitbucket.org/owner/repo.git')).toThrow(
      /Only github\.com repositories are supported/i,
    );
  });

  it('rejects malformed URLs', () => {
    expect(() => parseGitHubUrl('not-a-url')).toThrow(/Invalid URL/i);
    expect(() => parseGitHubUrl('https://github.com/')).toThrow(/Invalid repository path/i);
    expect(() => parseGitHubUrl('https://github.com/owner')).toThrow(/Invalid repository path/i);
  });
});
