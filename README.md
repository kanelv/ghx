# ghx

Clone GitHub repos with the right account. Per-alias PATs live in the OS keychain, never in config, argv, URLs, or `.git/config`.

## Requirements

- Node.js 24+, Git in `$PATH`
- macOS 12+ (Keychain) or Linux with a Secret Service daemon (GNOME Keyring, KWallet, KeePassXC) and D-Bus

## Install

```bash
npm install && npm run build
npm link            # optional: puts `ghx` on PATH
npm unlink -g ghx   # undo the link
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

- The preview is display-only. The real PAT is never in a URL.
- No, Enter on the default, Escape, or Ctrl+C cancels without running Git.

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
| `No accounts configured` | Run `ghx account add <alias>`. |
| `Personal Access Token ... could not be found` | Keychain entry was removed. Re-run `ghx account add <alias>`. |

## Development

```bash
npm test              # vitest
npm run typecheck
npm run lint          # eslint
npm run format        # prettier
npm run build
```

## License

MIT
