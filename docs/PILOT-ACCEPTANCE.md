# FieldDeck v0.9: pilot acceptance console

This rung closes an important gap: CI unit tests do not prove the real GitHub `FD PROPOSE` validation and reviewer workflows have been exercised end to end.

## What the console does

1. **Open Pilot Issue Draft**: opens a prefilled GitHub issue. Nothing is submitted until a human reviews and clicks Submit on GitHub.
2. **Verify Issue / Verify Latest**: reads the public GitHub issue and comments, recomputes the canonical blueprint fingerprint, checks GitHub Actions validation and reviewer-bot comments, then fetches the linked workflow runs via the public GitHub Actions API.
3. The console only displays **VALIDATION VERIFIED** or **HUMAN REVIEW RECORDED** when the linked run matches the right repository, workflow filename, event type, success conclusion and run ID.
4. Export the report as a **read-only acceptance observation**. It carries `execution_authorized:false`, `tasks_executed_by_pilot:false`, and `is_execution_receipt:false`.

## First live pilot

After merging PR #10:
1. Visit the live FieldDeck Pages site. Scroll to **Review Pilot Console**.
2. Click **Open Pilot Issue Draft**, inspect the harmless two-step blueprint and explicitly submit the GitHub issue. No secrets in public issues.
3. Return to FieldDeck, click **Verify Latest** (or paste issue number and **Verify Issue**).
4. Once the validation workflow has commented, verify **VALIDATION VERIFIED**. If not, open the issue/Actions links and inspect failures.
5. Open **Review Board** and check evidence for that issue. Copy an exact human review command and post it on the issue as a repository writer. This is a recommendation only, never permission to run.
6. Return to Pilot Console and verify the issue again. A genuine successful review-decision workflow will show **HUMAN REVIEW RECORDED**.

## Boundaries

- The browser holds no GitHub credentials or secret tokens; explicit issue submission and review comments happen on GitHub.
- The pilot is a **non-executing proposal**, not the `FD RUN` chain. No new tasks are installed or run.
- The linked public run verification does not replace reading the workflow artifacts and runner logs; it confirms the run references are genuine within the selected repository and workflow family.
- This view reads at most the 100 GitHub issue comments available from the selected REST endpoint; very long discussions require deeper pagination.
- A public API rate limit or missing/failed workflow stays visible as an error or unverified state, never simulated success.
- `HUMAN REVIEW RECORDED` does not mean the proposal has been authorized for implementation or execution.
- This PR does not itself constitute a live pilot. The first human-submitted issue and subsequent GitHub-run receipts are necessary.

## Automated tests

Run `npm test` and `npm run build`. Negative controls include wrong workflow, failed runs, wrong repository, arbitrary run links, modified blueprints, non-bot comments and missing live evidence.
