# FieldDeck v0.6: agent and human blueprint proposal review

## Why this exists

The v0.5 Chain Lab can validate custom blueprints, but only its built-in Field Health Sweep can execute. v0.6 gives a safe and visible route for **humans and agents to submit automation proposals for review**, without allowing anyone to execute user-defined sequences.

## Human path

1. In Chain Lab, select or compose steps and enter a short blueprint name.
2. Press **PROPOSE FOR REVIEW**. A GitHub new-issue page opens with a prefilled `FD PROPOSE:` title and canonical JSON blueprint.
3. Review it, remove sensitive details, and submit the GitHub issue.
4. A dedicated GitHub Actions validator checks the blueprint schema; the result and SHA-256 fingerprint are posted as a comment and retained as an artifact.
5. The proposal remains **not reviewed by a human and not approved for execution**. Human reviewers must inspect it and later approve a separately implemented, tested and merged runtime action before execution can be enabled.

## Agent path

An agent may use the same public schema and the IssueOps proposal format defined in `src/proposal-model.mjs`, either through a GitHub issue creator with permission or by presenting a prefilled GitHub issue URL for a human.

The public catalog is discovery-only. `FD PROPOSE:` is intentionally different from `FD RUN:`, and the existing executor will not recognize the proposed blueprint as a runnable task.

## Security and data handling

- All proposal issue content is public. **Do not include secrets, local device identifiers, private endpoints, or personal information.**
- GitHub checks login at issue submission but **proposal validation does not grant repository write permission or authorization**.
- Validation uses pure Node schema parsing and hashing only. No `eval`, subprocess, dynamic script execution or imported JSON used as a command.
- Missing/invalid proposals produce REJECTED evidence. Valid proposals produce VALID_FOR_REVIEW evidence, never SUCCESS or execution authorization.
- SHA-256 is a canonical-content fingerprint to compare reviewed proposals, not a signature, authentication, or human approval.
- Public issue creation can consume limited GitHub Actions resources. Operational rate controls and moderator tooling are future work.
- Workflow artifacts expire. Do not claim permanent or immutable audit records.

## Acceptance

CI: `npm run build` and `npm test`, including negative controls.

Post-merge:
1. Try a custom two-step blueprint named `Research Review`.
2. Click **PROPOSE FOR REVIEW** and submit it in GitHub.
3. Verify `FieldDeck blueprint review validation` passes and comments **VALID FOR HUMAN REVIEW** with a fingerprint and no claim of execution.
4. Verify public IssueOps authorization/execution did not run for this issue.
5. Verify a malicious extra field or `"policy":{"execution":"allowed"}` is rejected.

Do not promote new runnable chains automatically. Approval and execution remain separate governance layers.
