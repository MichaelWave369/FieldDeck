# FieldDeck v0.4: governed chain composer

FieldDeck now has a visual, keyboard-accessible sequential chain composer. It uses a fixed registry of the three *side-effect-free* demo tasks already supported by the Python runner.

## Operator procedure

1. Open **Chain Lab** in the sidebar, or scroll to the Chain Composer.
2. Drag-and-drop is **not yet implemented**. Use the Up, Down and Remove controls to reorder steps, plus Add Step to extend the draft.
3. Custom sequences are **draft-only**. Export them as JSON; they do not execute.
4. Select **Reset to Preset** to load the only approved chain: Catalog Health → Script Smoke Test → Macro Sequence.
5. Choose **Request Approved Chain**. FieldDeck opens a prefilled GitHub issue for task `field-health-sweep`.
6. Review and submit the issue in GitHub. The existing IssueOps gate checks the submitter's live repository write/maintain/admin permission and the exact task marker.
7. Once approved, GitHub Actions executes the three fixed steps sequentially, fails closed if a step errors, and uploads a JSON receipt including per-step status and source run/issue metadata.

## Security boundaries

- Editing or exporting a draft never authorizes or runs it.
- The one executable chain is implemented as a **fixed reviewed Python function** under the allowlist, not user-supplied serialized commands or shell script.
- Chain steps use direct function calls; no eval, subprocess, or arbitrary input from GitHub issue content.
- A matching preset does not skip GitHub authentication and explicit issue submission.
- Public issue content and public receipts must never contain credentials, private network details, or sensitive data.
- Stage/step successes indicate only that these three deterministic demonstrations passed, not that a local agent, browser macro, or network job ran.
- The Python receipt is an artifact with finite retention, not an immutable audit record.

## Tests

Run `npm test` (Python unittest plus Node negative-control suites), then `npm run build`.

Post-merge smoke test: request the Field Health Sweep task, verify the gate and executor both passed, inspect the JSON receipt for ordered three-step results, and check the run link in the issue comment.

## Future

v0.5: governed declarative chain manifests with approvals per action, typed inputs, execution envelopes, retries, stop conditions, and durable receipts. These should not be wired to arbitrary local execution until a signed paired runner, credential isolation, and a separate approval policy exist.
