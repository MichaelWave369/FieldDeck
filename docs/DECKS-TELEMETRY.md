# FieldDeck v0.3: personal decks & public execution history

## What changed

- Personal decks are local browser collections of references to existing catalog actions. **They never add new executable capabilities.**
- Quick Launch exists by default. Create up to 12 additional decks, add or remove actions in the inspector, and switch decks in the sidebar.
- Deck data is stored only in localStorage. It is not synced to GitHub, agents, BrainC, or other devices. Clearing site data removes those personal collections.
- The Live Executions rail reads up to ten public IssueOps workflow runs from GitHub's public REST API. It does not use a PAT or execute any jobs.
- The rail separates queued/running/completed statuses, shows the run link, and offers a manual refresh. A handoff is not displayed as an execution.
- If the public GitHub API is rate-limited, unreachable, or blocked, the UI reports the issue and links to Actions.

## Test plan

1. PR CI: `npm run build`, `npm test`.
2. Run FieldDeck and create a personal deck such as Network Tools. Pin `catalog-health` and verify it persists after reload in the same browser.
3. Remove that action and delete the custom deck; Quick Launch cannot be deleted.
4. Verify the Live Executions rail contains issue #3's successful `catalog-health` run, if still in the ten most recent matching runs.
5. Use Refresh after submitting a new request; verify queued/running/success transitions as GitHub reports them. The run link should open the exact GitHub Actions page.
6. Temporarily block the GitHub API in browser devtools and verify the UI shows an error with a fallback link; the deck and execution gate continue working.

## Governance

No execution permissions are introduced here. Personal deck selections are UI preferences only; all workflow requests still pass through the v0.2 IssueOps authorization gate. The live rail reads the public GitHub API without any embedded credentials or secrets. Public GitHub API rate limits apply.
