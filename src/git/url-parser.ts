export interface ParsedRepoUrl {
  owner: string;
  repo: string;
  cloneUrl: string;
  defaultDestination: string;
}

export function parseGitHubUrl(rawUrl: string): ParsedRepoUrl {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('Invalid URL: Repository URL cannot be empty.');
  }

  const trimmed = rawUrl.trim();

  // Detect SSH format
  if (trimmed.startsWith('git@') || (trimmed.includes(':') && !trimmed.includes('://'))) {
    throw new Error(
      `Only HTTPS GitHub repository URLs are supported (received SSH-style URL: "${trimmed}"). Please use "https://github.com/...".`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid URL: Unable to parse "${trimmed}". Please provide a valid HTTPS GitHub repository URL.`);
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
      `Only HTTPS GitHub repository URLs are supported (received protocol "${parsed.protocol}"). Please use https://.`,
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
    owner,
    repo,
    cloneUrl,
    defaultDestination: repo,
  };
}
