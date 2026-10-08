# FieldDeck v0.8: review evidence and stale-proposal protection

v0.8 makes the Review Board reconcile a **current GitHub issue body** against existing GitHub Actions validation and reviewer-decision comments. It does not grant authority to execute or implement proposed workflows.

## Review Board verification

1. Select an existing `FD PROPOSE:` issue.
2. Click **CHECK CURRENT EVIDENCE**.
3. FieldDeck reads the **current** issue body and first 100 comments from GitHub's public API (no browser token).
4. It parses the strict blueprint schema, derives its canonical SHA-256 locally, then compares it to validator and reviewer-action comments authored by `github-actions[bot]`.
5. The Board shows one of: `AWAITING_VALIDATION`, `AWAITING_HUMAN_REVIEW`, `ACCEPTED_FOR_IMPLEMENTATION_REVIEW`, `DECLINED`, `STALE_VALIDATION`, `STALE_DECISION`, or `INVALID_PROPOSAL`.
6. Copy commands stay disabled unless validation evidence matches the **current** proposal and the issue is open. The operator still must read the actual proposal, copy the command, and post it manually in GitHub as a repository writer.

The review-decision workflow now requires actual prior `VALID FOR HUMAN REVIEW` evidence from a GitHub Actions bot comment with the **same current canonical SHA-256**, not merely a correctly formatted `/fielddeck review` command. It checks current author permission and issue status through GitHub. A submitted issue, a validation fingerprint, and an accepted-for-implementation-review decision are three separate facts.

## Important boundaries

- The interface is a read-only evidence projection and not a guaranteed exhaustive historical ledger. The first 100 public comments are read. When API access is restricted, it fails visibly.
- `STALE_VALIDATION` means the proposal body changed. The v0.6 validator only runs on issue creation, so submit a new review issue rather than claiming the old validation still applies.
- An accepted decision is a **recommendation to consider a separately reviewed code change**, not a new executable capability, approval to merge, or permission to run.
- GitHub Actions run artifacts are finite-retention evidence, not permanent immutable signatures.
- Commands never bypass GitHub identity verification, authorization checks, or runtime allowlists.
- GitHub issues are public; never put secrets, personal details, private endpoints, or device identifiers into a proposal.

## Acceptance

- `npm test` and `npm run build` pass.
- Open Review Board: a new valid proposal is awaiting validation until the validator comment appears.
- Once the bot comments on a matching fingerprint, the proposal becomes `AWAITING_HUMAN_REVIEW`.
- Post a reviewer command as an authorized GitHub writer. The separate workflow must report an evidence-only decision; the board then displays that decision after refresh.
- Edit the proposal issue body: old validation must become stale, and copyable reviewer commands must be disabled.
- Confirm the IssueOps execution runner never ran as a consequence of proposing or reviewing the blueprint.
