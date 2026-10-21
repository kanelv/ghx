# ghx

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24+-5FA04E?logo=nodedotjs&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?logo=git&logoColor=white)
![Commander](https://img.shields.io/badge/CLI-Commander-000000)
![Keychain](https://img.shields.io/badge/Credentials-OS%20Keychain-555555)
![tsup](https://img.shields.io/badge/Build-tsup-FFD43B)
![Vitest](https://img.shields.io/badge/Test-Vitest-6E9F18?logo=vitest&logoColor=white)
![ESLint](https://img.shields.io/badge/Lint-ESLint-4B32C3?logo=eslint&logoColor=white)
![Prettier](https://img.shields.io/badge/Format-Prettier-F7B93E?logo=prettier&logoColor=black)
![License: MIT](https://img.shields.io/badge/License-MIT-blue)
[![npm](https://img.shields.io/npm/v/@cahgnexx/ghx)](https://www.npmjs.com/package/@cahgnexx/ghx)

Clone GitHub repos with the right account. Per-alias PATs live in the OS keychain, never in config, argv, URLs, or `.git/config`.

## Requirements

- Node.js 24+, Git in `$PATH`
- macOS 12+ (Keychain) or Linux with a Secret Service daemon (GNOME Keyring, KWallet, KeePassXC) and D-Bus

## Install

```bash
npm i -g @cahgnexx/ghx
```

From source:

```bash
npm install && npm run build
npm link            # optional: puts `ghx` on PATH
npm unlink -g @cahgnexx/ghx   # undo the link
node dist/bin/ghx.js --help   # without linking
```

## Usage

```bash
ghx account add work      # prompts for username, masked PAT, git name + email, optional ssh host; re-run to update
ghx account add work --ssh-only   # SSH-only account: no PAT prompted or stored
ghx account update work   # edit username, git name + email, ssh host (current values as defaults); PAT untouched
ghx account list          # aliases, usernames and ssh hosts, never tokens
ghx clone https://github.com/company-org/my-project.git [destination]
ghx clone git@gh.work:company-org/my-project.git [destination]      # SSH
ghx remote add origin https://github.com/company-org/my-project.git   # run in an existing repo
ghx remote add origin git@gh.work:company-org/my-project.git
ghx git remote add origin <url>   # same as `ghx remote add`
```

Clone flow:

1. Validate URL and destination (must not exist or be empty).
2. Pick an account in a vertical menu. The owner mapping preselects one.
3. Review the preview, then confirm. The default is **No**.

```text
Selected account: work
Repository:       company-org/my-project
Destination:      ./my-project

Command preview (PAT masked):
  git clone https://company-user:********@github.com/company-org/my-project.git
  git -C ./my-project config --local user.name "Work Me"
  git -C ./my-project config --local user.email me@company.co.jp

Do you want me to run this command now?
  Yes
> No
```

- The preview is display-only. The real PAT is never in a URL (except HTTPS `remote add`, below).
- If the account has a git name/email, they are set as local `user.name`/`user.email` in the cloned repo, so work and personal commits never share an author. Without them, global git config applies.
- No, Enter on the default, Escape, or Ctrl+C cancels without running Git.

`ghx remote add <name> <url>` uses the same account selection and confirmation, then runs `git remote add` in the current directory:

- HTTPS: `git remote add <name> https://user:PAT@github.com/owner/repo.git`. The PAT is masked in git error output.
- SSH: `git remote add <name> git@<ssh_host>:owner/repo.git`. No PAT.
- Fails before prompting if the directory is not a Git repo or `<name>` already exists. ghx never overwrites a remote; change one yourself with `git remote set-url <name> <url>`.
- Also sets the account's local `user.name`/`user.email` in that repo (overwrites existing local values). Names starting with `-` are rejected.

## HTTPS and SSH

The protocol comes from the URL you pass; the selected account decides the credentials.

| URL | Accepted forms | Auth |
|---|---|---|
| HTTPS | `https://github.com/owner/repo[.git]` | PAT from keychain via credential helper |
| SSH | `git@<host>:owner/repo.git`, `ssh://git@<host>/owner/repo.git` (`<host>` = `github.com` or an alias) | ssh-agent / `~/.ssh/config` identity |

Transformation rules:

- HTTPS stays HTTPS, SSH stays SSH. ghx never switches protocol.
- SSH: the host is replaced with the selected account's `ssh_host`; form (`scp` or `ssh://`), owner and repo are kept.
  - `git@github.com:acme/app.git` + account `ssh_host = gh.work` -> `git@gh.work:acme/app.git`
  - `ssh://git@gh.other/acme/app.git` + `gh.work` -> `ssh://git@gh.work/acme/app.git`
- An SSH URL with an account lacking `ssh_host` fails with instructions; no other account's host is used.
- The owner is never changed to match the account's username.

SSH preview (no PAT is fetched):

```text
Selected account: work
Repository:       acme/app
Protocol:         SSH

Command preview (SSH):
  git clone git@gh.work:acme/app.git
```

### Setting up `ssh_host`

`ssh_host` is a `Host` alias from `~/.ssh/config`, not a key path. ghx never reads keys.

```sshconfig
# ~/.ssh/config
Host gh.work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
    IdentitiesOnly yes
```

```bash
ghx account add work --ssh-only   # or `ghx account update work` to add ssh_host to an existing account
ssh -T git@gh.work                # verify the identity
```

An account may have a PAT, an `ssh_host`, or both.

## Configuration

`~/.config/ghx/config` (or `$XDG_CONFIG_HOME/ghx/config`), INI, mode 0600. Holds no secrets.

```ini
[account.work]
username = company-user
credential_ref = ghx-work
name = Work Me                ; optional, becomes local user.name
email = me@company.co.jp      ; optional, becomes local user.email
ssh_host = gh.work            ; optional, Host alias in ~/.ssh/config; needed for SSH URLs

[owner-mapping]
company-user = work
company-org = work    ; add orgs by hand
```

- `account add` and `account update` map the account's own username automatically (if unmapped).
- `credential_ref` is derived from the alias and never prompted.
- Owner lookup is case-insensitive. It only preselects; it never skips confirmation.

## Credential handling

- PATs are read from the keychain only after you confirm.
- Exception: HTTPS `ghx remote add` writes `https://user:PAT@github.com/...` into `.git/config` (plaintext) and argv, by design.
- ghx starts a temp dir (0700) with a Unix socket (0600) and a helper script, then runs:

  ```bash
  git -c credential.helper= -c credential.helper=<tmp>/helper.cjs clone <url> <dest>
  ```

- `credential.helper=` clears global/system helpers so another account's credentials are never used.
- `GIT_TERMINAL_PROMPT=0` prevents prompts. The helper answers only for `https` + `github.com`.
- Git runs via an argument array, no shell. TLS verification is untouched.
- The temp dir is removed on success, failure, SIGINT, SIGTERM and SIGHUP.
- If the keychain is unavailable ghx fails. There is no plaintext fallback.
- SSH: ghx fetches no PAT and starts no credential helper. It runs plain `git clone git@<ssh_host>:...`; ssh-agent, `~/.ssh/config` and host-key checks apply unchanged. ghx never reads, copies or disables checks on keys or `known_hosts`.
- `ssh_host` is validated (`[A-Za-z0-9][A-Za-z0-9._-]*`) so it can never be parsed as an ssh option.

## Troubleshooting

| Error | Fix |
|---|---|
| `Cannot access OS credential store` (Linux) | Install and unlock a Secret Service daemon: `sudo apt-get install gnome-keyring dbus-x11`, then `eval $(gnome-keyring-daemon --start)`. For KeePassXC, enable Secret Service integration. |
| `GitHub authentication failed for account "<user>"` | PAT expired or lacks `repo` scope. Create a new one, then `ghx account add <alias>`. |
| `Repository not found or insufficient permissions` | Check the URL and that the selected account has access. |
| `Destination path ... already exists and is not empty` | Pass a different destination. |
| `Unsupported git command` | Only `ghx git remote add <name> <url>` is supported (or use `ghx remote add`). |
| `Account "<alias>" has no ssh_host configured` | `ghx account update <alias>` and enter the `~/.ssh/config` Host alias. |
| `Permission denied (publickey)` | The alias's `IdentityFile` is wrong or not authorized on GitHub. Test with `ssh -T git@<ssh_host>`. |
| `Remote "origin" already exists` | ghx won't overwrite. Use `git remote set-url origin <url>`. |
| `Current directory is not a Git repository` | `cd` into the repo or `git init`. |
| `No accounts configured` | Run `ghx account add <alias>`. |
| `Personal Access Token ... could not be found` | Keychain entry was removed. Re-run `ghx account add <alias>`. |

## Development

```bash
npm test              # vitest
npm run typecheck
npm run lint          # eslint
npm run format        # prettier
npm run format:check
npm run build
```

## Publishing

Published to npm as `@cahgnexx/ghx`. Users install with `npm i -g @cahgnexx/ghx`.

A "version" is a fixed snapshot on npm. Once published, a version is immutable: you cannot edit or reuse it, so every change needs a new number.

Versions follow semver `MAJOR.MINOR.PATCH`:

| Bump | When | Example |
|---|---|---|
| `patch` | Bug fix, no behavior change | 0.1.0 -> 0.1.1 |
| `minor` | New backward-compatible feature | 0.1.0 -> 0.2.0 |
| `major` | Breaking change | 0.1.0 -> 1.0.0 |

Release steps:

```bash
git switch main && git status        # 1. clean tree on main
npm run lint && npm run typecheck && npm test && npm run format:check   # 2. all green
npm version patch                    # 3. bumps package.json + lockfile, commits, tags v0.1.1
npm pack --dry-run                   # 4. check the files that will ship (dist, README, LICENSE)
npm publish                          # 5. prepublishOnly builds + tests, then uploads (asks 2FA code)
git push --follow-tags               # 6. push the commit and tag
gh release create v0.1.1 --generate-notes   # 7. GitHub release for the tag (use the version from step 3)
npm view @cahgnexx/ghx version       # 8. confirm the new version is live
```

First release: skip step 3 and publish the current version as is (`0.1.0` is not on npm yet). Step 3 is needed from the second release on, because npm rejects a version number it already has.

First time only: `npm login` as `cahgnexx`. The `@cahgnexx` scope is your npm username, so no extra setup is needed.

- `publishConfig.access = public` is set, otherwise scoped packages publish as private.
- Published a bad version? Within 72 hours `npm unpublish @cahgnexx/ghx@<version>`. After that, `npm deprecate @cahgnexx/ghx@<version> "reason"` and publish a fixed one.
- Never put secrets in the repo; `files: ["dist"]` limits what ships.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Author

Kane Le <cuonglvrepvn@gmail.com>

## License

MIT, see [LICENSE](LICENSE).
