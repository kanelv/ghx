import type { AccountConfig } from '../config/types.js';
import {
  buildSshUrl,
  isValidSshHost,
  type ParsedRepoUrl,
} from './url-parser.js';

export interface ResolvedTarget {
  protocol: 'https' | 'ssh';
  /** Shown in the preview. HTTPS: PAT masked. SSH: the exact URL git runs. */
  displayUrl: string;
  /** SSH only: URL passed to git. HTTPS never carries a PAT here. */
  sshUrl?: string;
}

/** Protocol comes from the URL; the selected account only supplies the SSH host alias. */
export function resolveTarget(
  parsed: ParsedRepoUrl,
  alias: string,
  account: AccountConfig,
): ResolvedTarget {
  if (parsed.protocol === 'https') {
    return {
      protocol: 'https',
      displayUrl: `https://${account.username}:********@github.com/${parsed.owner}/${parsed.repo}.git`,
    };
  }
  if (!account.sshHost) {
    throw new Error(
      `Account "${alias}" has no ssh_host configured, which is required for SSH URLs. Set it with: ghx account update ${alias} (ssh_host is a Host alias from ~/.ssh/config)`,
    );
  }
  if (!isValidSshHost(account.sshHost)) {
    throw new Error(
      `Account "${alias}" has an invalid ssh_host "${account.sshHost}". Use a Host alias from ~/.ssh/config (letters, digits, ".", "_", "-"), not a key path.`,
    );
  }
  const sshUrl = buildSshUrl(parsed, account.sshHost);
  return { protocol: 'ssh', displayUrl: sshUrl, sshUrl };
}
