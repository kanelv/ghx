export interface ParsedRepoUrl {
  protocol: 'https' | 'ssh';
  owner: string;
  repo: string;
  /** Canonical URL as given (https, or ssh with the original host). */
  cloneUrl: string;
  defaultDestination: string;
  /** ssh only: scp-like (`git@host:o/r.git`) or `ssh://git@host/o/r.git`. */
  sshForm?: 'scp' | 'url';
  /** ssh only: host or ~/.ssh/config alias from the URL. */
  sshHost?: string;
}

// Must start alphanumeric: a leading "-" would be parsed by ssh/git as an option.
const SSH_HOST_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

export function isValidSshHost(host: string): boolean {
  return SSH_HOST_RE.test(host);
}

/** Effective SSH URL for `parsed` using `host`; keeps the URL form and path. */
export function buildSshUrl(parsed: ParsedRepoUrl, host: string): string {
  const path = `${parsed.owner}/${parsed.repo}.git`;
  return parsed.sshForm === 'url'
    ? `ssh://git@${host}/${path}`
    : `git@${host}:${path}`;
}

function parseSshUrl(trimmed: string): ParsedRepoUrl {
  const bad = (why: string) =>
    new Error(
      `Invalid SSH URL "${trimmed}": ${why}. Expected git@<host>:<owner>/<repo>.git or ssh://git@<host>/<owner>/<repo>.git`,
    );

  let sshForm: 'scp' | 'url';
  let host: string;
  let repoPath: string;

  if (trimmed.startsWith('ssh://')) {
    sshForm = 'url';
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw bad('unable to parse');
    }
    if (url.username !== 'git' || url.password) {
      throw bad('the SSH user must be "git"');
    }
    if (url.port) throw bad('custom ports are not supported');
    host = url.hostname;
    repoPath = url.pathname.replace(/^\//, '');
  } else {
    sshForm = 'scp';
    const m = /^git@([^:/]+):(.+)$/.exec(trimmed);
    if (!m)
      throw bad('the SSH user must be "git" and the host followed by ":"');
    host = m[1];
    repoPath = m[2];
  }

  if (!isValidSshHost(host)) throw bad(`invalid host "${host}"`);

  const parts = repoPath.replace(/\/+$/, '').split('/');
  if (parts.length !== 2 || !parts.every((p) => SEGMENT_RE.test(p))) {
    throw bad('invalid repository path');
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, '');
  if (!repo) throw bad('invalid repository path');

  const parsed: ParsedRepoUrl = {
    protocol: 'ssh',
    owner,
    repo,
    cloneUrl: '',
    defaultDestination: repo,
    sshForm,
    sshHost: host,
  };
  parsed.cloneUrl = buildSshUrl(parsed, host);
  return parsed;
}

export function parseGitHubUrl(rawUrl: string): ParsedRepoUrl {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('Invalid URL: Repository URL cannot be empty.');
  }

  const trimmed = rawUrl.trim();

  if (
    trimmed.startsWith('ssh://') ||
    trimmed.startsWith('git@') ||
    (trimmed.includes(':') && !trimmed.includes('://'))
  ) {
    return parseSshUrl(trimmed);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      `Invalid URL: Unable to parse "${trimmed}". Please provide a valid HTTPS or SSH GitHub repository URL.`,
    );
  }

  // Reject embedded credentials
  if (parsed.username || parsed.password) {
    throw new Error(
      'Repository URL must not contain embedded credentials (username or password). ghx securely manages credentials through OS keychain.',
    );
  }

  // Enforce HTTPS
  if (parsed.protocol !== 'https:') {
    throw new Error(
      `Only HTTPS and SSH GitHub repository URLs are supported (received protocol "${parsed.protocol}"). Please use https:// or ssh://.`,
    );
  }

  // Enforce github.com host
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'github.com') {
    throw new Error(
      `Only github.com repositories are supported (received host "${parsed.hostname}").`,
    );
  }

  // Path format: /<owner>/<repo>[.git][/]
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  if (pathParts.length < 2) {
    throw new Error(
      `Invalid repository path in URL "${trimmed}". Expected format: https://github.com/<owner>/<repo>`,
    );
  }

  const owner = pathParts[0];
  let repo = pathParts[1];

  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  if (!repo || !owner) {
    throw new Error(
      `Invalid repository path in URL "${trimmed}". Expected format: https://github.com/<owner>/<repo>`,
    );
  }

  const cloneUrl = `https://github.com/${owner}/${repo}.git`;

  return {
    protocol: 'https',
    owner,
    repo,
    cloneUrl,
    defaultDestination: repo,
  };
}
