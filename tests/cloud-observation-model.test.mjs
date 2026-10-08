import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOUD_REPO, cloudRunApi, parseCloudReceipt, parseCloudHistory, correlateCloudRun
} from '../src/cloud-observation-model.mjs';

const NOW = Date.parse('2026-10-08T21:20:00Z');
function receipt() {
  return {
    schema: 'fielddeck.cloud-observation.v1',
    receipt_kind: 'observation_not_authorization',
    run_at: '2026-10-08T21:10:46+00:00',
    run_id: '37844903712',
    trigger: 'push',
    sha: '8e81ffe',
    run_url: 'https://github.com/MichaelWave369/FieldCloudWorker/actions/runs/37844903712',
    overall: 'ok',
    results: [
      { task: 'heartbeat', kind: 'observation', status: 'ok', output: { signal: 'alive' }, duration_s: 0 },
      { task: 'repo_layout', kind: 'observation', status: 'ok', output: { required_files: 3, present_files: 3 }, duration_s: 0 },
      { task: 'github_repo_metrics', kind: 'observation', status: 'ok', output: { repository: CLOUD_REPO, stars: 0, open_issues_and_prs: 0 }, duration_s: 0 }
    ]
  };
}
function run() {
  return {
    id: 37844903712, repository: { full_name: CLOUD_REPO },
    path: '.github/workflows/worker.yml', name: 'FieldCloudWorker Observation Pilot',
    event: 'push', head_branch: 'main', head_sha: '8e81ffe30ecaa5c898850da8f7fa9cdaf69ca2a6',
    html_url: receipt().run_url, status: 'completed', conclusion: 'success',
    created_at: '2026-10-08T21:10:38Z', updated_at: '2026-10-08T21:16:19Z'
  };
}
function history(r) {
  return JSON.stringify({ schema: 'fielddeck.cloud-history.v1',
    run_id: r.run_id, run_at: r.run_at, overall: r.overall, ok_count: 3, error_count: 0 }) + '\n';
}

test('accepts a strictly scoped real-format receipt, run and history', () => {
  const r = parseCloudReceipt(receipt(), NOW);
  assert.equal(r.freshness, 'current');
  assert.equal(r.passed, 3);
  assert.equal(correlateCloudRun(r, run()).status, 'metadata_correlated');
  assert.equal(parseCloudHistory(history(r), r).length, 1);
});
test('no forged run URLs or unknown task IDs', () => {
  const a = receipt(); a.run_url = 'https://example.com/other'; assert.throws(() => parseCloudReceipt(a, NOW));
  const b = receipt(); b.results[0].task = 'shell_exec'; assert.throws(() => parseCloudReceipt(b, NOW));
});
test('rejects unsafe extra output fields and contradictory outcomes', () => {
  const a = receipt(); a.results[0].output.token = 'not-public'; assert.throws(() => parseCloudReceipt(a, NOW));
  const b = receipt(); b.overall = 'error'; assert.throws(() => parseCloudReceipt(b, NOW));
});
test('does not accept GitHub runs from other repositories or branches', () => {
  const r = parseCloudReceipt(receipt(), NOW);
  const wrongRepo = run(); wrongRepo.repository.full_name = 'attacker/fake'; assert.throws(() => correlateCloudRun(r, wrongRepo));
  const wrongBranch = run(); wrongBranch.head_branch = 'feature'; assert.throws(() => correlateCloudRun(r, wrongBranch));
});
test('a matching run with the wrong SHA, outcome or time is rejected', () => {
  const r = parseCloudReceipt(receipt(), NOW);
  const wrongCommit = run(); wrongCommit.head_sha = 'fffffffeed123'; assert.throws(() => correlateCloudRun(r, wrongCommit));
  const wrongOutcome = run(); wrongOutcome.conclusion = 'failure'; assert.throws(() => correlateCloudRun(r, wrongOutcome));
  const wrongTime = run(); wrongTime.updated_at = '2026-10-08T19:00:00Z'; assert.throws(() => correlateCloudRun(r, wrongTime));
});
test('history must match the currently published receipt', () => {
  const r = parseCloudReceipt(receipt(), NOW);
  assert.throws(() => parseCloudHistory(history(r).replace('37844903712', '999'), r));
});
test('stale result remains stale even after a successful historical run', () => {
  assert.equal(parseCloudReceipt(receipt(), NOW + 9 * 60 * 60 * 1000).freshness, 'stale');
});
test('accepts a sanitized error receipt matched to failed GitHub run', () => {
  const a = receipt();
  a.overall = 'error';
  a.results[1] = {task: 'repo_layout', kind: 'observation', status: 'error', error_code: 'RuntimeError', duration_s: 0.01};
  const r = parseCloudReceipt(a, NOW);
  assert.equal(r.failed, 1);
  const failedRun = run(); failedRun.conclusion = 'failure';
  assert.equal(correlateCloudRun(r, failedRun).status, 'metadata_correlated');
});
test('run endpoints accept only numeric IDs', () => {
  assert.equal(cloudRunApi('37844903712'), 'https://api.github.com/repos/MichaelWave369/FieldCloudWorker/actions/runs/37844903712');
  assert.throws(() => cloudRunApi('../repos'));
});
