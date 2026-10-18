# Task: Implement `ghx` — A Secure GitHub Account Manager and Clone CLI

## 1. Objective

Build a small CLI tool named `ghx` that makes it easy to clone GitHub repositories using different GitHub accounts, such as personal and work accounts.

The goal is to avoid manually switching credentials whenever I clone a repository or set up a new project.

The CLI must support macOS and Linux.

Prioritize simplicity, security, maintainability, and a working MVP. Avoid unnecessary abstractions and features.

## 2. Required Technology Stack

Use the following stack unless the repository already has a suitable implementation that should be preserved:

- **Language:** TypeScript
- **Runtime:** Node.js
- **CLI framework:** Commander.js
- **Interactive prompts:** `@inquirer/prompts`
- **Testing:** Follow existing repository conventions; otherwise use Vitest
- **Formatting and linting:** Follow existing repository conventions; otherwise choose a lightweight TypeScript-compatible setup

Use Commander.js for command parsing, arguments, options, and help output.

Use `@inquirer/prompts` for interactive account selection and Yes/No confirmation.

Do not introduce a larger CLI framework such as oclif or a server framework such as NestJS. This MVP does not need them.

For OS credential storage, evaluate maintained solutions compatible with macOS Keychain and Linux Secret Service. Verify native dependencies, current compatibility, maintenance status, and error handling before choosing a library. Keep credential-store integration behind a small interface so it can be tested independently.

## 3. Inspect the Repository First

Before modifying code:

1. Inspect the current repository, project structure, dependencies, and coding conventions.
2. Determine which requirements are already implemented.
3. Identify existing security issues or credential-handling risks.
4. Reuse working code where appropriate.
5. Present a concise implementation plan, including the credential-storage and secure Git authentication approach.

If the repository is empty, initialize a minimal TypeScript CLI project with a suitable package manager and build configuration.

Do not replace working functionality unnecessarily.

After presenting the plan, continue with implementation and verification unless blocked by a decision that genuinely requires my input.

## 4. Account Management

Support these commands:

```bash
ghx account add personal
ghx account add work
ghx account list
```

### Add an account

Collect:

- Account alias, such as `personal` or `work`.
- GitHub username.
- GitHub Personal Access Token (PAT).

The PAT must be entered using a masked input prompt.

Store the PAT in the operating system's credential store:

- macOS: Keychain.
- Linux: Secret Service-compatible credential store, such as GNOME Keyring.

Never store PATs in plaintext configuration files.

The configuration file should contain only non-secret metadata and a credential reference.

Example:

```ini
[account.personal]
username = personal-account
credential_ref = ghx-personal

[account.work]
username = company-user
credential_ref = ghx-work

[owner-mapping]
personal-account = personal
company-org = work
```

This format is illustrative; choose a simple configuration format and library appropriate for the project.

Requirements:

- Validate account aliases and handle duplicate aliases.
- Support updating an existing account's username or PAT.
- Do not display PATs in terminal output.
- Do not silently fall back to plaintext credential storage.
- If the OS credential store is unavailable, fail safely and explain how to resolve the issue.
- Handle missing, inaccessible, or deleted credentials gracefully.

### List accounts

Example:

```text
Configured GitHub accounts:

  personal  (personal-account)
  work      (company-user)
```

Display accounts vertically, including their aliases and usernames. Never display PATs.

## 5. Clone Command and Interactive Workflow

Support:

```bash
ghx clone https://github.com/company-org/my-project.git
```

Optionally support an explicit destination:

```bash
ghx clone https://github.com/company-org/my-project.git ./custom-directory
```

### Step 1: Validate the repository URL

- Accept standard HTTPS GitHub repository URLs.
- Extract the repository owner and name.
- Reject malformed URLs and unsupported hosts with actionable errors.
- Do not assume the repository owner is the same as the authenticated GitHub username.
- Do not delete or overwrite an existing destination.

### Step 2: Select the GitHub account

If the repository owner matches an owner-to-account mapping, preselect the corresponding account.

Otherwise, prompt the user to choose an account using `@inquirer/prompts`.

Example:

```text
Select a GitHub account:

  personal (personal-account)
> work     (company-user)
```

Allow the user to change the selection.

If no accounts are configured, explain how to add one.

An inferred or preselected account must never trigger an automatic clone.

### Step 3: Show the command preview

After account selection, display the selected account, repository, destination, and a masked command preview.

Example:

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

The preview is for display only. The masked URL must never be executed literally with a real PAT substituted into it.

Use `@inquirer/prompts` for the Yes/No confirmation.

Requirements:

- Show both Yes and No.
- Default to No.
- Wait for explicit confirmation before cloning.
- If the user chooses No, presses Escape, or interrupts the prompt, cancel without cloning.
- Never run Git before confirmation.
- If the user presses Enter without changing the default, cancel the operation.

### Step 4: Execute the clone securely

Only after the user explicitly confirms Yes:

1. Retrieve the selected account's PAT from the OS credential store.
2. Run Git using the selected account's credentials through a secure, scoped credential-helper mechanism or another equally secure approach.
3. Wait for the Git process to complete.
4. Report success or failure clearly.
5. Clean up temporary authentication resources when the process finishes, fails, or is interrupted.

Example success:

```text
Cloning repository...
✓ Repository cloned successfully.
Location: ./my-project
```

Example cancellation:

```text
Clone cancelled.
```

The implementation must ensure that the selected account is used for this clone, even if the user's global Git configuration contains credentials for another GitHub account.

Prefer a temporary, operation-scoped Git credential helper or another established mechanism that does not expose secrets. Do not build a general-purpose Git credential-helper framework for all Git commands in this MVP.

## 6. Security Requirements

Treat the PAT as a secret throughout the entire application.

Never:

- Put the real PAT in the Git URL passed to Git.
- Include the real PAT in command-line arguments or shell commands.
- Write the PAT to shell history, logs, error messages, or terminal output.
- Persist the PAT in `.git/config`, `.git-credentials`, the `ghx` configuration file, or repository files.
- Disable TLS verification or Git security checks.
- Use shell interpolation to construct or execute Git commands.
- Leave temporary credential files or authentication helpers behind.
- Silently use credentials belonging to another account.

Use `spawn` or an equivalent child-process API with an argument array rather than invoking a shell.

Where a temporary credential helper is required:

- Restrict its scope and lifetime to the clone operation.
- Return credentials only for the intended GitHub host and selected account.
- Avoid exposing the PAT through process arguments or inherited environment variables when a safer supported approach is available.
- Ensure temporary files, if unavoidable, have restrictive permissions and are reliably removed.
- Handle interruption and cleanup without logging secrets.

If the selected credential cannot be retrieved securely, abort the operation before running Git.

The preview may display the username and `********`, but the actual PAT must never be part of the displayed or executed URL.

## 7. Implementation Structure

Follow the repository's existing conventions. If starting from scratch, use a small modular structure similar to:

```text
src/
  cli.ts
  commands/
    account-add.ts
    account-list.ts
    clone.ts
  config/
    config-store.ts
  credentials/
    credential-store.ts
    os-credential-store.ts
  git/
    clone-repository.ts
  prompts/
    account-selection.ts
    clone-confirmation.ts
```

Adjust the structure if a simpler design is more appropriate.

Responsibilities:

- `cli.ts`: Register Commander.js commands.
- `commands/`: Implement command workflows.
- `config/`: Store and retrieve non-secret configuration.
- `credentials/`: Integrate with the OS credential store.
- `git/`: Execute Git securely and handle the process lifecycle.
- `prompts/`: Implement interactive selection and confirmation.

Keep business logic independent of the interactive prompt library wherever practical, so it can be unit-tested.

Do not introduce dependency injection frameworks, complex plugin architectures, or unnecessary layers.

## 8. Error Handling

Handle these cases with useful, secret-safe messages:

- No configured accounts.
- Invalid repository URL.
- Unsupported Git hosting provider.
- Duplicate or invalid account alias.
- Missing PAT in the credential store.
- Credential-store unavailable or inaccessible.
- Git not installed.
- Authentication failure.
- Repository not found or insufficient permissions.
- Destination directory already exists.
- User cancellation.
- Git process interruption or failure.

Do not include tokens or other sensitive credential details in error messages.

## 9. Automated Tests

Use the existing test framework or Vitest if the repository has no test setup.

At minimum, test:

### Account management

- Adding and listing accounts.
- Handling duplicate aliases and account updates.
- Masking PAT input.
- Ensuring the configuration file contains no PAT values.
- Credential-store read/write failures.
- Missing credentials.

### Clone workflow

- Parsing valid and invalid GitHub URLs.
- Resolving owner-to-account mappings.
- Prompting when no mapping exists.
- Displaying a masked preview.
- Confirming Yes invokes the clone operation.
- Choosing No does not invoke Git.
- Enter defaults to No.
- Cancellation does not invoke Git.
- Explicit destination handling.
- Git failures and destination conflicts.
- Correct account selection when global Git credentials exist.
- No real PAT in Git process arguments or persisted Git configuration.
- Cleanup of temporary authentication resources after success, failure, and interruption.

Mock the credential store and Git process in unit tests. Add integration tests where practical without requiring real GitHub credentials.

Never include a real PAT in test fixtures or committed files.

## 10. Documentation

Update the README with:

- Project purpose and supported operating systems.
- Prerequisites.
- Installation, build, and usage instructions.
- How to add and list accounts.
- How owner-to-account mapping works.
- The clone selection, preview, and confirmation workflow.
- How credentials are stored.
- Linux credential-store requirements.
- Troubleshooting for missing credentials and Git authentication failures.

Include this example:

```bash
ghx account add personal
ghx account add work
ghx account list

ghx clone https://github.com/company-org/my-project.git
```

Document that the displayed command is a masked preview, not the command used to transmit the actual credentials.

## 11. Acceptance Criteria

The MVP is complete when:

1. The project uses TypeScript, Node.js, Commander.js, and `@inquirer/prompts`, unless an existing equivalent should be preserved.
2. Users can configure multiple GitHub accounts.
3. PATs are stored in macOS Keychain or a Linux Secret Service-compatible credential store.
4. The account list displays usernames but never PATs.
5. The clone command can select or infer an account.
6. The CLI displays a masked command preview.
7. The CLI asks for explicit confirmation and defaults to No.
8. No clone occurs unless the user confirms Yes.
9. The repository is cloned using the selected account's credentials.
10. The real PAT is never embedded in the Git URL or exposed in process arguments, logs, shell history, or persisted repository configuration.
11. Errors, cancellations, and cleanup are handled correctly.
12. Automated tests pass.
13. The README documents installation, configuration, and usage.

## 12. Final Verification

After implementation:

1. Run formatting and linting.
2. Run TypeScript type checking and automated tests.
3. Build the CLI.
4. Test the account-management and clone workflows with mocked credentials.
5. Review the final diff for security issues and unnecessary complexity.
6. Fix issues found during verification.

Provide a final summary containing:

- Implemented features.
- Key design decisions, especially secure Git authentication.
- Commands to install, build, and run `ghx`.
- Test and build results.
- Any remaining limitations or platform-specific setup requirements.

Use available Superpowers planning, implementation, and verification skills if they are installed. Do not stop after creating the plan; implement and verify the solution unless blocked by a genuine issue requiring my input.