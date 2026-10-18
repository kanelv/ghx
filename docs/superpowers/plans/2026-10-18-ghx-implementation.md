# `ghx` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure, cross-platform CLI tool named `ghx` to manage multiple GitHub accounts and clone repositories using account-specific credentials stored in macOS Keychain or Linux Secret Service, ensuring the Personal Access Token (PAT) is never leaked or persisted in Git configs.

**Architecture:** A modular TypeScript CLI application built on Commander.js and `@inquirer/prompts`. Non-secret metadata and owner-to-account mappings are stored in an INI config file (`~/.config/ghx/config`), while secrets are stored exclusively in the OS vault via `@napi-rs/keyring`. During `git clone`, a temporary, scoped credential helper communicates with a parent Unix domain socket server to supply authentication in-memory without exposing PATs in arguments, disk files, or environment variables.

**Tech Stack:** TypeScript, Node.js (>=18), Commander.js, `@inquirer/prompts`, `@napi-rs/keyring`, `ini`, Vitest, tsup.

**Spec:** `docs/prompts/init-prompt.md`

## Global Constraints

- **Language & Runtime:** TypeScript compiled to Node.js executable.
- **OS Support:** macOS (Keychain) and Linux (Secret Service API / libsecret / GNOME Keyring / KWallet).
- **No Plaintext Tokens:** PATs must never be stored in plain text configuration files, committed files, logs, error messages, shell command arguments, or Git URLs.
- **Git Credential Isolation:** Clone operations must use `-c credential.helper= -c credential.helper=<scoped-helper>` to prevent falling back to global git credentials or persisting credentials in `.git/config`.
- **Destructive Operation Protection:** Never overwrite or delete existing non-empty destination directories.
- **Interactive Safety:** Clone confirmation defaults to `No` (`default: false`). Pressing Enter without selecting Yes must cancel the operation.
- **No Shell Interpolation:** Git and child processes must be spawned using argument arrays (`child_process.spawn`).

## Review Focus

1. **Linux headless / missing Secret Service daemon:** If D-Bus or Secret Service daemon is unavailable, `ghx` must fail gracefully with instructions on how to start/install a keyring service rather than crashing with an unhandled rejection.
2. **Global Git credentials interference:** The clone helper override `-c credential.helper=` must cleanly neutralize any global `credential.helper` configured in the user's system/global git config.
3. **Cancellation or abnormal process termination during clone:** If the clone process is interrupted via SIGINT/SIGTERM or unhandled error, the temporary credential helper socket and helper script must be cleaned up reliably without leaving credentials behind.
4. **URL parsing edge cases:** Reject URLs with embedded credentials (`https://user:pass@github.com/...`), non-HTTPS protocols (ssh, git, http), and non-GitHub hosts with clear, actionable error messages.
5. **Masked display vs execution separation:** Ensure the masked preview URL (`https://user:********@github.com/...`) is strictly a formatted display string and never passed to Git or child processes.

---

### Task 1: Project Scaffolding & Tooling Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/index.ts`
- Test: `tests/sanity.test.ts`

**Interfaces:**
- Produces: Project build (`npm run build`), test suite (`npm test`), and typechecking (`npm run typecheck`).

- [ ] **Step 1: Initialize git repository and write package.json, tsconfig.json, tsup.config.ts, vitest.config.ts, .gitignore**
- [ ] **Step 2: Install dependencies: `commander`, `@inquirer/prompts`, `@napi-rs/keyring`, `ini`, and devDependencies: `typescript`, `tsup`, `vitest`, `@types/node`, `@types/ini`**
- [ ] **Step 3: Write a failing sanity test in `tests/sanity.test.ts`**
- [ ] **Step 4: Run `npx vitest run tests/sanity.test.ts` to verify test runner fails or passes as expected**
- [ ] **Step 5: Implement minimal `src/index.ts` export**
- [ ] **Step 6: Run `npm run typecheck` and `npm run build` to verify scaffolding works**
- [ ] **Step 7: Commit scaffolding**

```bash
git add .
git commit -m "chore: scaffold TypeScript CLI project with vitest and tsup"
```

---

### Task 2: Configuration Store (`src/config/`)

**Files:**
- Create: `src/config/types.ts`
- Create: `src/config/config-store.ts`
- Test: `tests/config/config-store.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface AccountConfig {
    username: string;
    credentialRef: string;
  }
  export interface GhxConfig {
    accounts: Record<string, AccountConfig>;
    ownerMapping: Record<string, string>;
  }
  export class ConfigStore {
    constructor(customConfigPath?: string);
    getConfigPath(): string;
    load(): GhxConfig;
    save(config: GhxConfig): void;
    getAccount(alias: string): AccountConfig | undefined;
    listAccounts(): Record<string, AccountConfig>;
    setAccount(alias: string, account: AccountConfig): void;
    getAccountForOwner(owner: string): string | undefined;
    setOwnerMapping(owner: string, alias: string): void;
    validateAlias(alias: string): { valid: boolean; error?: string };
  }
  ```

- [ ] **Step 1: Write unit tests in `tests/config/config-store.test.ts` testing alias validation, config loading/saving (INI format), updating existing accounts, owner-to-account mapping, and verifying no secret tokens are stored in the config file**
- [ ] **Step 2: Run `npx vitest run tests/config/config-store.test.ts` and verify failures**
- [ ] **Step 3: Implement `src/config/types.ts` and `src/config/config-store.ts` with INI serialization, directory creation with mode `0o700`, and file permissions `0o600`**
- [ ] **Step 4: Run `npx vitest run tests/config/config-store.test.ts` and verify all pass**
- [ ] **Step 5: Commit config store**

```bash
git add src/config tests/config
git commit -m "feat(config): implement INI-based non-secret configuration store"
```

---

### Task 3: Credential Store Interface & Native OS Implementation (`src/credentials/`)

**Files:**
- Create: `src/credentials/credential-store.ts`
- Create: `src/credentials/os-credential-store.ts`
- Create: `src/credentials/memory-credential-store.ts`
- Test: `tests/credentials/credential-store.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface CredentialStore {
    getSecret(credentialRef: string): Promise<string | null>;
    setSecret(credentialRef: string, secret: string): Promise<void>;
    deleteSecret(credentialRef: string): Promise<boolean>;
    isAvailable(): Promise<{ available: boolean; error?: string }>;
  }
  export class OsCredentialStore implements CredentialStore {
    constructor(serviceName?: string);
  }
  export class MemoryCredentialStore implements CredentialStore {
    // In-memory mock store for unit testing
  }
  ```

- [ ] **Step 1: Write unit tests in `tests/credentials/credential-store.test.ts` testing `MemoryCredentialStore` and `OsCredentialStore` mocking `@napi-rs/keyring` for macOS Keychain and Linux Secret Service (including unavailable/error scenarios)**
- [ ] **Step 2: Run `npx vitest run tests/credentials/credential-store.test.ts` and verify tests fail**
- [ ] **Step 3: Implement `CredentialStore` interface, `OsCredentialStore` (wrapping `@napi-rs/keyring.Entry` with graceful error handling and troubleshooting hints), and `MemoryCredentialStore`**
- [ ] **Step 4: Run `npx vitest run tests/credentials/credential-store.test.ts` and verify all tests pass**
- [ ] **Step 5: Commit credential store implementation**

```bash
git add src/credentials tests/credentials
git commit -m "feat(credentials): implement OS credential store with @napi-rs/keyring"
```

---

### Task 4: Interactive Prompts Module (`src/prompts/`)

**Files:**
- Create: `src/prompts/account-prompts.ts`
- Create: `src/prompts/clone-prompts.ts`
- Test: `tests/prompts/prompts.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export async function promptAccountDetails(existing?: { username?: string }): Promise<{ username: string; pat: string }>;
  export async function promptAccountSelection(accounts: Record<string, { username: string }>, defaultAlias?: string): Promise<string>;
  export async function promptCloneConfirmation(previewDetails: {
    alias: string;
    repository: string;
    destination: string;
    maskedUrl: string;
  }): Promise<boolean>;
  ```

- [ ] **Step 1: Write tests in `tests/prompts/prompts.test.ts` mocking `@inquirer/prompts` (`password`, `select`, `confirm`) verifying default `false` for confirmation, masked input handling, and account selection choices**
- [ ] **Step 2: Run `npx vitest run tests/prompts/prompts.test.ts` and verify failures**
- [ ] **Step 3: Implement `account-prompts.ts` and `clone-prompts.ts` using `@inquirer/prompts` with masked PAT input, default No for confirmation, and proper display formatting**
- [ ] **Step 4: Run `npx vitest run tests/prompts/prompts.test.ts` and verify all tests pass**
- [ ] **Step 5: Commit prompt module**

```bash
git add src/prompts tests/prompts
git commit -m "feat(prompts): add interactive prompts for account setup, selection, and confirmation"
```

---

### Task 5: Git Authentication & Clone Runner (`src/git/`)

**Files:**
- Create: `src/git/url-parser.ts`
- Create: `src/git/credential-helper-server.ts`
- Create: `src/git/clone-repository.ts`
- Test: `tests/git/url-parser.test.ts`
- Test: `tests/git/credential-helper-server.test.ts`
- Test: `tests/git/clone-repository.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface ParsedRepoUrl {
    owner: string;
    repo: string;
    cloneUrl: string; // Sanitized standard HTTPS URL
    defaultDestination: string;
  }
  export function parseGitHubUrl(rawUrl: string): ParsedRepoUrl;

  export interface ScopedCredentialSession {
    helperScriptPath: string;
    cleanup: () => Promise<void>;
  }
  export function createScopedCredentialSession(username: string, token: string): Promise<ScopedCredentialSession>;

  export interface CloneOptions {
    url: string;
    destination: string;
    username: string;
    token: string;
    spawnGit?: typeof child_process.spawn;
  }
  export interface CloneResult {
    success: boolean;
    location: string;
    error?: string;
  }
  export function cloneRepository(options: CloneOptions): Promise<CloneResult>;
  ```

- [ ] **Step 1: Write URL parser tests in `tests/git/url-parser.test.ts` covering valid HTTPS URLs, URLs with `.git`, URLs without `.git`, rejecting SSH (`git@github.com:...`), rejecting URLs with embedded credentials (`https://foo:bar@github.com/...`), rejecting non-GitHub hosts, and extracting owner/repo/destination**
- [ ] **Step 2: Write tests for `credential-helper-server.test.ts` verifying Unix domain socket IPC, restricting responses only to `protocol=https` and `host=github.com`, setting file modes `0o700`/`0o600`, and ensuring clean resource teardown**
- [ ] **Step 3: Write tests for `clone-repository.test.ts` verifying Git arguments array (no shell), `-c credential.helper=` resetting global helpers, checking destination directory existence, and secret-safe error reporting**
- [ ] **Step 4: Run vitest for git tests and verify failures**
- [ ] **Step 5: Implement `src/git/url-parser.ts`, `src/git/credential-helper-server.ts`, and `src/git/clone-repository.ts`**
- [ ] **Step 6: Run vitest for all git tests and verify all pass**
- [ ] **Step 7: Commit git cloning and credential helper engine**

```bash
git add src/git tests/git
git commit -m "feat(git): implement URL validation, scoped credential helper IPC, and secure clone execution"
```

---

### Task 6: CLI Commands & CLI Entry Point (`src/commands/` & `src/cli.ts`)

**Files:**
- Create: `src/commands/account-add.ts`
- Create: `src/commands/account-list.ts`
- Create: `src/commands/clone.ts`
- Create: `src/cli.ts`
- Create: `bin/ghx.ts`
- Test: `tests/commands/account-add.test.ts`
- Test: `tests/commands/account-list.test.ts`
- Test: `tests/commands/clone.test.ts`
- Test: `tests/commands/cli.test.ts`

**Interfaces:**
- Produces: Full Commander.js CLI with commands:
  - `ghx account add <alias>`
  - `ghx account list`
  - `ghx clone <url> [destination]`

- [ ] **Step 1: Write tests for `account-add`, `account-list`, and `clone` command workflows in `tests/commands/`**
- [ ] **Step 2: Run command tests and verify failures**
- [ ] **Step 3: Implement `account-add.ts`, `account-list.ts`, `clone.ts`, `cli.ts`, and `bin/ghx.ts`**
- [ ] **Step 4: Run command tests and verify all pass**
- [ ] **Step 5: Run full test suite `npm test` and build `npm run build`**
- [ ] **Step 6: Commit CLI commands and entry point**

```bash
git add src/commands src/cli.ts bin/ tests/commands
git commit -m "feat(cli): wire Commander CLI commands for account add, account list, and clone"
```

---

### Task 7: Comprehensive Documentation, Verification, & Polish

**Files:**
- Create: `README.md`
- Test: Full Vitest suite & build
- Lint: Prettier & TypeScript check

- [ ] **Step 1: Write comprehensive `README.md` containing purpose, prerequisites, installation, build, usage examples, masked preview details, credential storage, Linux Secret Service requirements, and troubleshooting**
- [ ] **Step 2: Run `npm run typecheck` and `npm test` across the entire codebase**
- [ ] **Step 3: Test end-to-end CLI workflow using the built distribution `dist/bin/ghx.js` or `bin/ghx.ts`**
- [ ] **Step 4: Inspect final git diff for any potential credential leaks, unnecessary complexity, or broken constraints**
- [ ] **Step 5: Commit documentation and any final cleanup**

```bash
git add README.md
git commit -m "docs: add comprehensive README with setup, architecture, and security details"
```
