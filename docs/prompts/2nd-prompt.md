# Task: Continue the `ghx` Implementation Using Agy's Existing Plan

## Objective

Implement `ghx`, a secure GitHub account manager and clone CLI, using the implementation plan previously created by Agy.

I already asked Agy to analyze this task and create an implementation plan, but I reached my usage quota before completing the implementation.

**Do not discard Agy's plan or start from scratch without reviewing it first.** Treat the existing plan and repository changes as the starting point.

## 1. Review Existing Work

Before making changes:

1. Inspect the Git working tree, including modified, staged, and untracked files.
2. Locate and read Agy's existing implementation plan and any related notes or artifacts in the repository or current project context.
3. Inspect the existing source code, configuration, dependencies, tests, and documentation.
4. Determine which parts of the plan have already been implemented, if any.
5. Identify incomplete work, unresolved decisions, security risks, and inconsistencies with the requirements below.

Preserve useful work and existing decisions when they are sound.

Do not overwrite, reset, or discard existing changes simply to create a clean starting point. Do not assume that Agy's plan was fully implemented.

If the plan cannot be located, report that briefly and inspect the repository for evidence of the intended design before deciding how to proceed.

## 2. Requirements to Follow

The intended MVP is a small CLI with the following technology stack:

- TypeScript and Node.js
- Commander.js for command parsing
- `@inquirer/prompts` for interactive selection and confirmation
- An appropriate test framework, preferably the existing one or Vitest
- OS credential storage for macOS Keychain and Linux Secret Service-compatible stores

Preserve an existing suitable implementation if it already meets these requirements. Do not rewrite working code just to match a different preferred structure.

### Account management

Support commands such as:

```bash
ghx account add personal
ghx account add work
ghx account list
```

Allow users to configure account aliases, GitHub usernames, and Personal Access Tokens (PATs).

Store PATs in the OS credential store, never as plaintext in configuration files. Configuration should contain only non-secret metadata and credential references.

The account list must display usernames but never PATs.

### Clone workflow

Support:

```bash
ghx clone https://github.com/company-org/my-project.git
```

The expected workflow is:

1. Parse and validate the repository URL.
2. Resolve the account from an owner-to-account mapping, or ask the user to select an account through a vertical interactive menu.
3. Display the selected account, repository, destination, and a masked command preview.
4. Ask whether to run the clone operation now.
5. Default the confirmation to **No**.
6. Clone only after the user explicitly selects **Yes**.
7. If the user selects No, presses Escape, or interrupts the prompt, cancel without invoking Git.
8. Wait for Git to finish and report the result.

Example preview:

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

The preview is illustrative only. Never execute a URL containing the real PAT.

### Security requirements

- Retrieve PATs from the OS credential store.
- Execute Git using a secure, operation-scoped credential mechanism.
- Never put the real PAT in the Git URL, process arguments, shell history, logs, terminal output, or persisted repository configuration.
- Avoid accidentally using credentials from another GitHub account's global Git configuration.
- Use a child-process API with an argument array rather than shell interpolation.
- Clean up temporary authentication resources on success, failure, and interruption.
- Do not silently fall back to plaintext credential storage.
- Do not disable TLS verification or other Git security checks.

### Testing and documentation

Preserve and extend existing tests. Verify account management, credential-store failures, account selection, masked preview, default-No confirmation, cancellation, secure Git execution, cleanup, and failure handling.

Update the README with installation, configuration, usage, credential storage, and troubleshooting instructions.

## 3. Implementation Approach

Use Agy's plan as the primary implementation guide.

1. Compare the plan with the actual repository state.
2. Identify which planned steps remain incomplete.
3. Check whether the plan's technology choices and security decisions remain appropriate.
4. Make only necessary adjustments, and briefly explain significant deviations.
5. Continue implementation from the existing state instead of repeating completed work.
6. Follow the repository's conventions and keep the design appropriate for a small CLI.

If Superpowers planning, implementation, or verification skills are available, use the relevant skills where useful, but do not unnecessarily repeat planning that Agy has already completed.

Do not introduce unnecessary frameworks, a web UI, a background service, or a general-purpose Git wrapper.

## 4. Verification

After implementation:

1. Run formatting and linting.
2. Run TypeScript type checking and automated tests.
3. Build the CLI.
4. Verify the confirmation defaults to No and cancellation never invokes Git.
5. Review credential handling for leaks in URLs, process arguments, logs, and `.git/config`.
6. Review the final diff without discarding unrelated user changes.

If the environment or usage constraints prevent a test from running, report that limitation honestly instead of claiming it passed.

## 5. Final Report

Summarize:

- What Agy had already planned or implemented.
- What you preserved, changed, and completed.
- Important security decisions.
- Commands to install, build, test, and run `ghx`.
- Actual test and build results.
- Any remaining limitations or work requiring my input.

Do not stop after reviewing the plan or producing another plan. Continue with implementation and verification unless a genuine blocker requires my input.