# FieldDeck v0.7 Review Board

The Review Board discovers public `FD PROPOSE:` issues from the repository. It shows a read-only inbox, fetches GitHub Actions **validation evidence** for a selected proposal, and helps a human reviewer copy an exact comment command for GitHub.

## Human process

1. Open FieldDeck and visit **Review Board**. Select a proposal issue.
2. Choose **Load validation fingerprint**. The page reads public issue comments, accepting evidence only from `github-actions[bot]` containing the v0.6 validation marker and fingerprint.
3. Read the blueprint and its validation evidence **on GitHub**. Verify the actual proposed steps. A fingerprint merely identifies data, it is not endorsement.
4. Copy either `/fielddeck review accept <sha256>` or `/fielddeck review decline <sha256>`. Paste it as a comment on the same proposal issue while signed in as a repository writer, maintainer or admin.
5. The new `FieldDeck human review decision` workflow confirms the commenter's **current repository permission** using GitHub, loads the **current issue body** from GitHub, validates its exact canonical blueprint, and verifies the command fingerprint.
6. For a valid authorized decision, GitHub Actions uploads a non-execution receipt and posts a public comment linking the run.

## Review vs execution

- `VALID FOR HUMAN REVIEW` is a schema validation only. It is not a review decision or executable approval.
- `ACCEPTED FOR IMPLEMENTATION REVIEW` is a recommendation to consider implementing a proposal. It is **not** permission to run, create tasks, alter allowlists, or change repository code.
- `DECLINED` records a human review decision, but does not delete or alter the issue.
- FieldDeck never executes user-submitted blueprints and never handles a GitHub PAT in public Pages.
- Every review decision includes `execution_authorized:false`, `implementation_authorized:false`, and `auto_promoted:false` in its JSON artifact.

## Threat model

- Issue and comment bodies are untrusted. They cannot supply shell code or change worker permissions.
- A malformed or altered proposal, spoofed SHA, nonwriter, or PR comment cannot pass the decision gate.
- SHA-256 binds a decision to the **canonical current blueprint** at check time. A later edit changes its fingerprint and requires another decision.
- GitHub Actions artifacts are finite-retention records, **not immutable signatures**. GitHub permissions may change; authority is checked at the time the decision runs.
- The browser inbox and comment display are untrusted **read-only context**, not proof of completed human review.
- Public GitHub API rate limits may require using the issue link manually.
- This workflow cannot automatically execute, schedule, or install any proposal.

## Verification

CI: `npm test` and `npm run build`, with negative controls for privilege spoofing, modified issues, wrong fingerprints, copied validation text from non-bot authors, and unsafe commands.

Post-merge test: submit the first `FD PROPOSE:` issue, verify its validation comment, open it in Review Board, copy a decision and submit it as a signed-in repository writer. Check the separate review decision workflow receipt. Confirm the existing IssueOps executor did **not** run.
