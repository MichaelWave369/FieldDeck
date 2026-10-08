# FieldDeck

Human + agent action deck. React on GitHub Pages, a public agent-readable manifest, and a separate reviewed GitHub Actions execution surface.

**Governance:** capability does not grant authority. Static Pages cannot execute scripts on your machine, store secrets, or authorize an agent.

## v0.9 features

- Responsive React dashboard, live action filtering, action inspector, recent local interaction log.
- Six ready cards: 3 GitHub Actions handoffs and 3 browser-only actions.
- Four locked placeholders: paired local runner, agent intake, NBG sync, and scheduled chains.
- Public manifest at /FieldDeck/fielddeck.manifest.json and agent notes in AGENTS.md.
- Three reviewed Python tasks with JSON receipt artifacts.

## Get it live

1. Merge the first PR.
2. In GitHub repo Settings > Pages, select GitHub Actions as the source.
3. Visit https://michaelwave369.github.io/FieldDeck/ after deployment succeeds.
4. To test execution, choose Actions > Run allowlisted FieldDeck task > Run workflow > catalog-health. Download the receipt artifact from that run.

**Authenticated IssueOps:** workflow buttons now open a prefilled GitHub issue. Review and submit it using your GitHub account. GitHub Actions validates your actual repository write permission before executing one of three fixed tasks, then posts the run link and a receipt. The dashboard never stores credentials or claims clicking the button completed a job. See [IssueOps protocol](docs/ISSUEOPS.md). A future OAuth-backed gateway could remove the separate GitHub confirmation.

**Personal decks + live history:** add up to 12 personal decks from the sidebar and pin existing actions from the inspector. Decks persist in this browser only and do not change any execution permissions. The Live run history rail reads public GitHub Actions data without credentials. See [Decks and telemetry](docs/DECKS-TELEMETRY.md).

## Development

Use npm install, npm run dev, npm run build, and npm test (Python 3 is needed for executor tests).

## Future

v0.2 authenticated GitHub IssueOps delivered; future direct OAuth-backed gateway; v0.3 local decks and public telemetry delivered; upcoming paired local runner; v0.4 PhiBot/BrainC/SuperPhiVessel adapters; v0.5 versioned schedules and macro builder.

MIT licensed.

## v0.4 chain composer

The visual Chain Lab builds bounded local draft sequences from reviewed action IDs. Custom sequences **do not execute**. Export them for review. Only the exact fixed **Field Health Sweep** chain (Catalog Health → Script Smoke Test → Macro Sequence) can be submitted via IssueOps. Its Python executor runs fixed functions sequentially and writes a structured per-step receipt, including fail-fast results. See [Chain Lab](docs/CHAIN-LAB.md).

After merging this PR, visit FieldDeck, scroll to Chain Lab, click **REQUEST APPROVED CHAIN**, submit the prefilled GitHub issue, and inspect the run artifact.

## v0.5 blueprints and preflight

Chain Lab supports three templates, strict JSON blueprint import/export and local read-only preflight. Imports cannot supply custom scripts, change permissions, or launch a job. Custom chains remain draft-only, regardless of passing preflight. Only the fixed Field Health Sweep has an authorized request route through GitHub IssueOps. See [Blueprints & preflight](docs/BLUEPRINTS.md).

## v0.6 blueprint review proposals

A human or agent can prepare a **review-only** GitHub issue from Chain Lab using the PROPOSE FOR REVIEW button. A separate validation workflow checks the strict JSON blueprint, publishes a sanitized evidence artifact and SHA-256 fingerprint, and comments the outcome. The issue is public and must contain no secrets. Validation **never executes or approves** the proposed chain. See [Blueprint Review protocol](docs/BLUEPRINT-REVIEW.md).

## v0.7 Review Board

A read-only public GitHub proposal inbox lets operators open and inspect proposals. GitHub Actions validation fingerprints can be fetched from authentic bot comments to construct exact copyable human review commands. A new GitHub `issue_comment:created` gate checks actual repository write permission and exact blueprint fingerprint before recording **ACCEPTED_FOR_IMPLEMENTATION_REVIEW** or **DECLINED** evidence. Neither decision authorizes execution or installs an implementation. See [Review Board](docs/REVIEW-BOARD.md).

## v0.8 current-proposal evidence reconciliation

Review Board now reads the current GitHub proposal body **and** signed-in GitHub Actions bot validation/review comments before showing a current decision status. A changed proposal becomes stale and disables reviewer commands. The decision workflow also fails closed unless the current issue matches previously published GitHub Actions validation evidence. See [Evidence Timeline](docs/EVIDENCE-TIMELINE.md). Human recommendations still never implement or execute blueprints.

## v0.9 Pilot Console

The **Review Pilot Console** guides one real GitHub proposal/validation/human-review acceptance test. Operators explicitly submit an innocuous two-step blueprint through a GitHub issue; the dashboard then verifies public issue/comment metadata and linked completed GitHub Actions runs, without tokens or automatic execution. Pilot observations are explicitly not execution receipts. [Operator guide](docs/PILOT-ACCEPTANCE.md).

## v0.9.1: real GitHub run-path compatibility

Live pilot issue [#11](https://github.com/MichaelWave369/FieldDeck/issues/11) generated a successful validator run [#37730046473](https://github.com/MichaelWave369/FieldDeck/actions/runs/37730046473), but the v0.9 dashboard incorrectly marked it UNCONFIRMED_VALIDATION_RUN. The REST API reported `path: ".github/workflows/blueprint-review.yml"`; the verifier only accepted an owner-qualified `@refs/` path. v0.9.1 accepts both exact expected formats and retains all repository, workflow, event, run ID, completion and success checks. Once deployed, run **Pilot Console → Verify Issue → 11**; no new pilot proposal is needed. The validation run does not authorize execution.
