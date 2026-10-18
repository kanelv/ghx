# Contributing

## Setup

```bash
npm install
npm run build
```

Requires Node.js 24+ and Git.

## Before opening a PR

```bash
npm run lint && npm run typecheck && npm test && npm run format:check
```

## Guidelines

- Never write PATs to argv, config, logs, or `.git/config` (sole exception: `ghx git remote add`).
- Inject dependencies (stores, prompts, `logger`) into `createCli` and `handle*` functions. Tests use fakes, not the real keychain.
- Add tests under `tests/` mirroring the `src/` path.
- Relative imports use `.js` extensions (ESM).
- Keep PRs small and focused.

## Commits

[Conventional Commits](https://www.conventionalcommits.org): `feat(git): ...`, `fix(clone): ...`, `docs: ...`, `chore: ...`.

## Security issues

Report privately to cuonglvrepvn@gmail.com. Do not open a public issue.

## License

Contributions are licensed under [MIT](LICENSE).
