# FieldDeck

Human + agent action deck. React on GitHub Pages, a public agent-readable manifest, and a separate reviewed GitHub Actions execution surface.

**Governance:** capability does not grant authority. Static Pages cannot execute scripts on your machine, store secrets, or authorize an agent.

## v0.5 features

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
