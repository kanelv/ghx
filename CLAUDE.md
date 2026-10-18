# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`ghx`: TypeScript ESM CLI (Commander) for cloning GitHub repos with per-alias PATs stored in the OS keychain. See README.md for user-facing behavior.

## Commands

```bash
npm run build          # tsup -> dist/, chmod +x dist/bin/ghx.js
npm run typecheck
npm test               # vitest run
npx vitest run tests/git/url-parser.test.ts   # single file
npx vitest run -t "name"                      # single test by name
npm run lint           # eslint (src + tests)
npm run format         # prettier, singleQuote (src + tests)
npm run format:check
```

## Architecture

Flow for `ghx clone`: `src/cli.ts` -> `commands/clone.ts` -> validate URL/destination -> select account (preselected via owner mapping) -> masked preview + confirm (default No) -> fetch PAT from credential store -> `git/clone-repository.ts`.

Flow for `ghx git remote add <name> <url>`: `src/cli.ts` (`git <args...>`, only `remote add` accepted) -> `commands/remote-add.ts` -> same URL parse/account select/confirm -> `git/add-remote.ts` (`spawnSync`, argument array; PAT masked in error output). Remote names starting with `-` are rejected.

- **Dependency injection everywhere**: `createCli(deps)` and each `handle*` take optional deps (stores, prompt fns, `cloneRepository`, `logger`) defaulting to real implementations. Tests inject fakes; follow this pattern for new commands.
- **Secrets never touch argv/config/.git/config** (sole exception: `ghx git remote add` embeds the PAT in the remote URL by user request): PATs live only in `CredentialStore` (`OsCredentialStore` via `@napi-rs/keyring`; `MemoryCredentialStore` for tests). `ConfigStore` (INI at `$XDG_CONFIG_HOME/ghx/config` or `~/.config/ghx/config`, mode 0600) holds only username, `credential_ref`, and `[owner-mapping]`.
- **Clone auth**: `git/credential-helper-server.ts` creates a 0700 temp dir with a 0600 Unix socket and a generated helper script; git runs with `-c credential.helper= -c credential.helper=<helper>` and `GIT_TERMINAL_PROMPT=0`. The server only answers for `https` + `github.com`. Temp dir/socket must be cleaned up on exit and on SIGINT/SIGTERM/SIGHUP. Signal handlers clean up, then `process.exit(128+n)` (handlers suppress default termination); `clone-repository.ts` kills the git child on `exit`.
- The masked URL in the preview is display-only; it is never executed.
- `git/url-parser.ts` is the trust boundary for repo URLs.

## Conventions

- Before finishing: `npm run lint && npm run typecheck && npm test && npm run format:check`.
- Relative imports use `.js` extensions (ESM).
- Tests mirror `src/` under `tests/` (vitest, globals enabled).
- `docs/superpowers/` holds design/plan docs.
