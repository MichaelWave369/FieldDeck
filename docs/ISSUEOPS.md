# FieldDeck v0.2: authenticated GitHub IssueOps

This is a practical intermediate execution gateway that works with a **static GitHub Pages front end** and does not require OAuth application setup, a hosted API server, or browser-side access tokens.

## Operator flow

1. Choose a ready workflow tile in FieldDeck, then select **REQUEST VIA GITHUB**.
2. A prefilled GitHub issue opens. GitHub authentication is required to submit it.
3. Review the exact task ID and select **Submit new issue**.
4. Workflow `.github/workflows/issueops.yml` receives the `issues:opened` event.
5. Gate validates the exact title, task ID and task-specific marker, then queries actual GitHub repository permissions of the issue author.
6. **Only admin / maintain / write permissions are accepted.** Read/triage/public users cannot dispatch jobs.
7. The fixed Python executor runs in GitHub Actions, writes a JSON receipt, uploads an artifact, and comments a link to its run on the issue.

This is **not** a background execution triggered by merely opening FieldDeck or clicking its button. The operator must submit the issue in GitHub.

## Agent protocol

Agents may read `/FieldDeck/fielddeck.manifest.json` without credentials. An agent with authorization to create a GitHub issue may generate the exact title and body described by `scripts/issue_gate.mjs`.

Creating a syntactically valid issue **never grants authorization**. The workflow checks the issue author's repository permission against the GitHub API. Agents should not fake success, and should wait for the workflow receipt before reporting completion.

## Constraints

- Only these side-effect-free tasks are allowed in v0.2: `catalog-health`, `script-smoke`, `macro-demo`.
- GitHub issue submissions and execution comments are public. **Never put secrets or personal data in them.**
- Public issue creation may generate trivial gate checks; a hosted authenticated gateway is a later option if request volume becomes large.
- A GitHub Actions token scoped to `contents: read` and `issues: write` is used only by the trusted workflow, never sent to the browser.
- GitHub Actions receipts are artifacts retained for 30 days by default, not permanent immutable records.
- The approval decision here is **repository-write permission plus explicit issue submission**, not a full multiparty approval system.
- If GitHub Actions is disabled or permission lookup fails, execution denies by default.
- There is no arbitrary script, shell, file system, browser macro, or local device execution.

## Verification

```sh
npm test
npm run build
```

Then manually test an authorized GitHub account opening a prefilled request issue, waiting for the workflow comment and checking the receipt artifact. Also test an unauthorized account to verify the runner does not execute.

A future backend can replace the IssueOps handoff while retaining the same action catalog and permission model.
