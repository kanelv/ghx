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

Clone GitHub repos with the right account. Per-alias PATs live in the OS keychain, never in config, argv, URLs, or `.git/config`.

## Requirements

- Node.js 24+, Git in `$PATH`
- macOS 12+ (Keychain) or Linux with a Secret Service daemon (GNOME Keyring, KWallet, KeePassXC) and D-Bus

## Install

```bash
npm install && npm run build
npm link            # optional: puts `ghx` on PATH
npm unlink -g @cahgnexx/ghx   # undo the link
node dist/bin/ghx.js --help   # without linking
```

## Usage

```bash
ghx account add work      # prompts for username + masked PAT; re-run to update
ghx account list          # aliases and usernames only, never tokens
ghx clone https://github.com/company-org/my-project.git [destination]
ghx git remote add origin https://github.com/company-org/my-project.git   # paste from GitHub; run in an existing repo
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

Do you want me to run this command now?
  Yes
> No
```

- The preview is display-only. The real PAT is never in a URL (except `git remote add`, below).
- No, Enter on the default, Escape, or Ctrl+C cancels without running Git.

`ghx git remote add <name> <url>` uses the same account selection and confirmation, then runs `git remote add <name> https://user:PAT@github.com/owner/repo.git` in the current directory. Remote names starting with `-` are rejected; the PAT is masked in any git error output.

## Configuration

`~/.config/ghx/config` (or `$XDG_CONFIG_HOME/ghx/config`), INI, mode 0600. Holds no secrets.

```ini
[account.work]
username = company-user
credential_ref = ghx-work

[owner-mapping]
company-user = work
company-org = work    ; add orgs by hand
```

- `account add` maps the account's own username automatically.
- Owner lookup is case-insensitive. It only preselects; it never skips confirmation.

## Credential handling

- PATs are read from the keychain only after you confirm.
- Exception: `ghx git remote add` writes `https://user:PAT@github.com/...` into `.git/config` (plaintext) and argv, by design.
- ghx starts a temp dir (0700) with a Unix socket (0600) and a helper script, then runs:

  ```bash
  git -c credential.helper= -c credential.helper=<tmp>/helper.cjs clone <url> <dest>
  ```

- `credential.helper=` clears global/system helpers so another account's credentials are never used.
- `GIT_TERMINAL_PROMPT=0` prevents prompts. The helper answers only for `https` + `github.com`.
- Git runs via an argument array, no shell. TLS verification is untouched.
- The temp dir is removed on success, failure, SIGINT, SIGTERM and SIGHUP.
- If the keychain is unavailable ghx fails. There is no plaintext fallback.

## Troubleshooting

| Error | Fix |
|---|---|
| `Cannot access OS credential store` (Linux) | Install and unlock a Secret Service daemon: `sudo apt-get install gnome-keyring dbus-x11`, then `eval $(gnome-keyring-daemon --start)`. For KeePassXC, enable Secret Service integration. |
| `GitHub authentication failed for account "<user>"` | PAT expired or lacks `repo` scope. Create a new one, then `ghx account add <alias>`. |
| `Repository not found or insufficient permissions` | Check the URL and that the selected account has access. |
| `Destination path ... already exists and is not empty` | Pass a different destination. |
| `Unsupported git command` | Only `ghx git remote add <name> <url>` is supported. |
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
npm view @cahgnexx/ghx version       # 7. confirm the new version is live
```

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
