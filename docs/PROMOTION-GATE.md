# FieldDeck v1.0: governed implementation handoff

## Pilot completion and scope

The v0.9.1 live pilot issue #13 was successfully validated by GitHub Actions, and the repository writer's review comment produced an **ACCEPTED FOR IMPLEMENTATION REVIEW** decision with a separate workflow receipt. The IssueOps execution jobs stayed skipped.

**That decision does NOT authorize implementation or execution.** FieldDeck v1.0 explicitly treats the next phase as a *candidate* that can be presented for separate code review.

## Workflow

1. Open Pilot Console and verify the accepted proposal's current GitHub issue, comments, and two real GitHub Actions runs.
2. A successful accepted result enables the **Promotion Gate** section.
3. Select **Prepare Implementation Candidate**. FieldDeck recomputes the current canonical blueprint SHA-256, checks matching issue number, both workflow IDs and decisions, and constructs a versioned default-deny candidate.
4. Export candidate JSON for review or open a prefilled **FD IMPLEMENT:** planning issue on GitHub. This creates a draft URL only; it does not submit anything.
5. A maintainer must prepare a separate, explicit code pull request to implement any fixed chain. Tests, repository approval, explicit allowlist changes, and deployment checks are all required. Nothing auto-installs.

## Candidate security model

- `schema_version: 1.0.0`, `kind: fielddeck.implementation.candidate`, `status: CANDIDATE_NOT_EXECUTABLE`.
- `policy.execution: denied` and `policy.implementation: not_authorized`.
- `runner: none`, `enabled: false`, `execution_authorized: false`, `implementation_authorized: false`.
- A candidate includes the source issue, exact blueprint SHA-256, validation run and reviewer-decision run URLs and a fixed implementation checklist.
- Importing or exporting the JSON **does not verify GitHub authenticity**. Live verification remains necessary and cannot be replaced with a candidate file.
- No secrets are used by the Pages frontend. All proposal details and planning issues are public.
- The runtime allowlist, workflows, and executor are untouched by this rung.

## Required gates

1. Freeze the fingerprint in an independently reviewed code change.
2. Implement the fixed allowlisted executor sequence, not arbitrary JSON interpretation.
3. Include positive/negative/fail-fast/authorization boundary tests.
4. Update IssueOps router and catalog in code review.
5. Merge after human code review and green CI.
6. Verify real execution receipts and default-deny behavior after deployment.

## Smoke test

- For issue #13, click **Verify Issue** and then **Prepare Implementation Candidate**. Export the pack and inspect `execution_authorized:false`.
- Try a pending, declined, failed, stale, or mismatched proposal. Promotion must remain disabled.
- Verify malformed imports, elevated-policy JSON, wrong repo, mismatched SHA, missing or failed review runs all fail closed in `npm test`.
- Do **not** claim a feature is implemented merely because the proposal was reviewed or the candidate pack exists.
