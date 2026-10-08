/**
 * Read-only acceptance pilot for the review path. The live issue and GitHub
 * workflow runs provide evidence. A GitHub draft page is NEVER submission.
 */
import { createBlueprint } from './blueprint-model.mjs';
import { proposalIssueUrl } from './proposal-model.mjs';
import { reconcileProposalEvidence } from './review-evidence.mjs';
import { proposalDetailsUrl, proposalCommentsUrl, proposalInboxUrl, parseProposalInbox } from './review-board-model.mjs';

export const PILOT_NAME = 'FieldDeck Pilot Review';
export const PILOT_STEPS = Object.freeze(['catalog-health', 'script-smoke']);
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BOT = 'github-actions[bot]';

function checkedRepo(repo) {
  if (typeof repo !== 'string' || !REPO_RE.test(repo)) throw new Error('Invalid repository name');
  return repo;
}

export function pilotProposalUrl(repo) {
  return proposalIssueUrl(checkedRepo(repo), createBlueprint([...PILOT_STEPS], PILOT_NAME));
}
export function pilotIssueNumber(value) {
  const v = String(value).trim();
  if (!/^[1-9][0-9]{0,8}$/.test(v)) throw new Error('Enter a valid GitHub issue number');
  return Number(v);
}
export function pilotUrls(repo, issueNumber) {
  checkedRepo(repo);
  const n = pilotIssueNumber(issueNumber);
  return {
    issue: proposalDetailsUrl(repo, n),
    comments: proposalCommentsUrl(repo, n),
    browser: 'https://github.com/' + repo + '/issues/' + n
  };
}
export function latestProposalNumber(payload, repo) {
  return parseProposalInbox(payload, checkedRepo(repo))[0]?.number ?? null;
}
function commentRunId(comments, repo, kind, fingerprint) {
  const marker = kind === 'validation' ? '### FieldDeck blueprint validation' : '### FieldDeck human review decision';
  const key = kind === 'validation' ? '- Validation run: ' : '- Review run: ';
  const fpLine = kind === 'validation'
    ? '- Blueprint fingerprint (SHA-256): `' + fingerprint + '`'
    : '- Blueprint SHA-256: `' + fingerprint + '`';
  const base = 'https://github.com/' + checkedRepo(repo) + '/actions/runs/';
  for (const comment of [...comments].reverse()) {
    if (comment?.user?.login !== BOT || typeof comment.body !== 'string'
      || !comment.body.includes(marker) || !comment.body.includes(fpLine)
      || !comment.body.includes('- Execution authorized: **NO**')) continue;
    const line = comment.body.split('\n').find(l => l.startsWith(key));
    if (!line || !line.startsWith(key + base)) continue;
    const value = line.slice((key + base).length).trim();
    if (!/^[1-9][0-9]{0,18}$/.test(value)) continue;
    return value;
  }
  return null;
}
export function githubRunUrl(repo, runId) {
  checkedRepo(repo);
  if (typeof runId !== 'string' || !/^[1-9][0-9]{0,18}$/.test(runId)) throw new Error('Invalid run ID');
  return 'https://api.github.com/repos/' + repo + '/actions/runs/' + runId;
}
export function isVerifiedRun(run, repo, runId, kind) {
  const file = kind === 'validation' ? 'blueprint-review.yml' : kind === 'decision' ? 'review-decision.yml' : null;
  const event = kind === 'validation' ? 'issues' : 'issue_comment';
  const name = kind === 'validation' ? 'FieldDeck blueprint review validation' : 'FieldDeck human review decision';
  if (!file) return false;
  // GitHub REST API commonly reports a repository-relative workflow path:
  // ".github/workflows/blueprint-review.yml" (as seen in live run #37730046473).
  // Some workflow references include the full owner/repo and an @refs/ suffix.
  // Accept only these explicit, repository-bound forms, never substring matches.
  const relativePath = '.github/workflows/' + file;
  const actualPath = run?.path;
  const pathMatches = actualPath === relativePath
    || (typeof actualPath === 'string' && actualPath.startsWith(repo + '/' + relativePath + '@refs/'));
  return !!run && String(run.id) === runId
    && run.repository?.full_name === repo
    && run.status === 'completed' && run.conclusion === 'success'
    && run.event === event
    && run.name === name
    && pathMatches;
}

/**
 * An evidence report proves that the cited workflow run was successful,
 * not that an automation was ever executed or a new capability approved.
 */
export async function assessPilot(issue, comments, repo, runs = {}, fingerprint) {
  checkedRepo(repo);
  if (!issue || !Number.isSafeInteger(issue.number) || issue.number <= 0
      || issue.pull_request || !Array.isArray(comments)) throw new Error('Invalid pilot issue evidence');
  const evidence = await reconcileProposalEvidence(issue, comments, fingerprint);
  const validationId = evidence.current_fingerprint && evidence.validation_matches_current
    ? commentRunId(comments, repo, 'validation', evidence.current_fingerprint) : null;
  const decisionId = evidence.current_fingerprint && evidence.decision_matches_current
    ? commentRunId(comments, repo, 'decision', evidence.current_fingerprint) : null;
  const validRun = !!validationId && isVerifiedRun(runs.validation, repo, validationId, 'validation');
  const decisionRun = !!decisionId && isVerifiedRun(runs.decision, repo, decisionId, 'decision');
  let status = 'WAITING_FOR_VALIDATION';
  if (evidence.state === 'INVALID_PROPOSAL' || evidence.state.includes('STALE')) status = 'BLOCKED';
  else if (validationId && !validRun) status = 'UNCONFIRMED_VALIDATION_RUN';
  else if (validRun && decisionId && !decisionRun) status = 'UNCONFIRMED_REVIEW_RUN';
  else if (validRun && decisionRun) status = 'HUMAN_REVIEW_RECORDED';
  else if (validRun) status = 'VALIDATION_VERIFIED';
  return {
    schema_version: '0.9.0', kind: 'fielddeck.review-acceptance.read-only',
    status, source: 'public-github-api', issue_number: issue.number,
    issue_url: 'https://github.com/' + repo + '/issues/' + issue.number,
    blueprint_name: typeof issue.title === 'string' ? issue.title.replace(/^FD PROPOSE: /, '') : null,
    proposal_state: evidence.state,
    validation_run_id: validationId,
    validation_workflow_verified: validRun,
    human_review_run_id: decisionId,
    human_review_workflow_verified: decisionRun,
    current_fingerprint: evidence.current_fingerprint,
    execution_authorized: false, tasks_executed_by_pilot: false,
    is_execution_receipt: false,
    human_review_not_implementation_authorization: true,
    note: 'This is a read-only public API check. GitHub workflow artifacts and the issue remain the source of truth.'
  };
}
