# FieldDeck FCW-02 — Cloud observation bridge

This adapter reads **only** the public, allowlisted FieldCloudWorker v0.2 status and history and correlates the latest record with the real GitHub Actions run metadata.

## Contract

- Source: \`https://michaelwave369.github.io/FieldCloudWorker/status.json\`, \`history.jsonl\`.
- Exact source repository: \`MichaelWave369/FieldCloudWorker\`.
- Exact workflow: \`.github/workflows/worker.yml\`.
- Accepted tasks: heartbeat, repo_layout, github_repo_metrics.
- Receipt kind: observation_not_authorization.
- History: 1 to 30 sanitized records; only last 10 displayed.
- Freshness: 8 hours. A stale green run never means "healthy now".
- Run correlation: GitHub REST run ID, repository, path, name, branch, event, commit prefix, result, URL and loose timestamp window must match.
- Fail closed: malformed, future-dated, missing, inconsistent, or unverifiable observations display UNCONFIRMED; nothing is unlocked.
- No script execution, polling background service, tokens, writing to GitHub, IssueOps dispatch, approvals, or training/memory admission.

**Trust limit:** GitHub workflow run metadata is more trustworthy than an arbitrary Pages JSON claim, but matching that metadata does **not** cryptographically authenticate measurement content or operator identity. Records are visibly labeled observations, not authorization.

## Acceptance

Run \`npm test\` and \`npm run build\`. Review the separate FCW-02 Cloud Workers panel on the published FieldDeck GitHub Pages site. Verify stale, failed, and network-denied states. Check browser CORS and that the page never asks for an API token.

If the upstream schema or workflow changes, do not silently widen the parser. Require a separate reviewed implementation PR.
