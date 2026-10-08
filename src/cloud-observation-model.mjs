/**
 * FCW-02: strict read-only projection of the independent FieldCloudWorker.
 * Pages data is UNTRUSTED even when it matches a real GitHub Actions run.
 * This layer neither authorizes actions nor attests to the truth of task output.
 */
export const CLOUD_REPO = 'MichaelWave369/FieldCloudWorker';
export const CLOUD_PAGES = 'https://michaelwave369.github.io/FieldCloudWorker/';
export const CLOUD_WORKFLOW = '.github/workflows/worker.yml';
const TASK_IDS = ['heartbeat', 'repo_layout', 'github_repo_metrics'];
const TASK_SET = new Set(TASK_IDS);
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

function requireValue(ok, code) {
  if (!ok) throw new Error(code);
}
function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function exactKeys(v, keys) { return object(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(','); }
function timestamp(value) {
  if (typeof value !== 'string') return NaN;
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return NaN;
  return Date.parse(value);
}
function safeInt(n) { return Number.isSafeInteger(n) && n >= 0 && n < 1000000000; }

export function cloudStatusUrl() { return CLOUD_PAGES + 'status.json'; }
export function cloudHistoryUrl() { return CLOUD_PAGES + 'history.jsonl'; }
export function cloudRunApi(id) {
  requireValue(/^\d{1,20}$/.test(String(id)), 'Invalid run identifier');
  return 'https://api.github.com/repos/' + CLOUD_REPO + '/actions/runs/' + id;
}

export function parseCloudReceipt(v, now = Date.now()) {
  requireValue(exactKeys(v, ['schema', 'receipt_kind', 'run_at', 'run_id', 'trigger', 'sha', 'run_url', 'overall', 'results']), 'Receipt shape rejected');
  requireValue(v.schema === 'fielddeck.cloud-observation.v1' && v.receipt_kind === 'observation_not_authorization', 'Receipt schema rejected');
  requireValue(typeof v.run_id === 'string' && /^\d{1,20}$/.test(v.run_id) && Number.isSafeInteger(Number(v.run_id)), 'Receipt run ID rejected');
  requireValue(v.trigger === 'push' || v.trigger === 'schedule' || v.trigger === 'workflow_dispatch', 'Receipt trigger rejected');
  requireValue(typeof v.sha === 'string' && /^[0-9a-f]{7}$/.test(v.sha), 'Receipt SHA rejected');
  requireValue(v.run_url === 'https://github.com/' + CLOUD_REPO + '/actions/runs/' + v.run_id, 'Receipt source rejected');
  requireValue(v.overall === 'ok' || v.overall === 'error', 'Receipt overall status rejected');
  const at = timestamp(v.run_at);
  requireValue(Number.isFinite(at) && at >= 0 && at <= now + 5 * 60 * 1000, 'Receipt timestamp rejected');
  requireValue(Array.isArray(v.results) && v.results.length === TASK_IDS.length, 'Receipt task count rejected');
  const seen = new Set();
  let errors = 0;
  for (const task of v.results) {
    requireValue(object(task) && TASK_SET.has(task.task) && !seen.has(task.task), 'Unknown or duplicate task');
    seen.add(task.task);
    requireValue(task.kind === 'observation' && ['ok', 'error'].includes(task.status), 'Invalid task state');
    requireValue(typeof task.duration_s === 'number' && Number.isFinite(task.duration_s) && task.duration_s >= 0 && task.duration_s <= 600, 'Task duration rejected');
    if (task.status === 'error') {
      errors++;
      requireValue(exactKeys(task, ['task', 'kind', 'status', 'error_code', 'duration_s']), 'Unsafe error fields');
      requireValue(typeof task.error_code === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,50}$/.test(task.error_code), 'Unsafe error code');
    } else {
      requireValue(exactKeys(task, ['task', 'kind', 'status', 'output', 'duration_s']), 'Unsafe output fields');
      const out = task.output;
      if (task.task === 'heartbeat') {
        requireValue(exactKeys(out, ['signal']) && out.signal === 'alive', 'Heartbeat mismatch');
      } else if (task.task === 'repo_layout') {
        requireValue(exactKeys(out, ['required_files', 'present_files']) && out.required_files === 3 && out.present_files === 3, 'Layout mismatch');
      } else {
        requireValue((exactKeys(out, ['state']) && out.state === 'skipped_local') ||
          (exactKeys(out, ['repository', 'stars', 'open_issues_and_prs']) &&
            out.repository === CLOUD_REPO && safeInt(out.stars) && safeInt(out.open_issues_and_prs)), 'Metrics mismatch');
      }
    }
  }
  requireValue((errors === 0 ? 'ok' : 'error') === v.overall, 'Contradictory receipt state');
  return {
    ...v,
    observedAtMs: at,
    ageMs: Math.max(0, now - at),
    freshness: now - at > MAX_AGE_MS ? 'stale' : 'current',
    passed: TASK_IDS.length - errors,
    failed: errors
  };
}

export function parseCloudHistory(value, currentReceipt) {
  requireValue(typeof value === 'string' && value.length <= 30000, 'History too large');
  const lines = value.trim().split('\n');
  requireValue(lines.length >= 1 && lines.length <= 30, 'History count rejected');
  const rows = lines.map(line => {
    let v;
    try { v = JSON.parse(line); } catch { throw new Error('History JSON rejected'); }
    requireValue(exactKeys(v, ['schema', 'run_id', 'run_at', 'overall', 'ok_count', 'error_count']), 'History shape rejected');
    requireValue(v.schema === 'fielddeck.cloud-history.v1', 'History schema rejected');
    requireValue(typeof v.run_id === 'string' && /^(local|\d{1,20})$/.test(v.run_id), 'History run ID rejected');
    requireValue(Number.isFinite(timestamp(v.run_at)), 'History timestamp rejected');
    requireValue(['ok', 'error'].includes(v.overall) && safeInt(v.ok_count) && safeInt(v.error_count) &&
      v.ok_count + v.error_count === TASK_IDS.length, 'History counts rejected');
    return v;
  });
  const last = rows[rows.length - 1];
  requireValue(last.run_id === currentReceipt.run_id && last.run_at === currentReceipt.run_at &&
    last.overall === currentReceipt.overall && last.ok_count === currentReceipt.passed &&
    last.error_count === currentReceipt.failed, 'History/latest receipt mismatch');
  return rows.filter(v => v.run_id !== 'local').slice(-10).reverse();
}

export function correlateCloudRun(receipt, run) {
  requireValue(object(run) && run.id === Number(receipt.run_id), 'GitHub run ID does not match');
  requireValue(run.repository?.full_name === CLOUD_REPO &&
    run.path === CLOUD_WORKFLOW &&
    run.name === 'FieldCloudWorker Observation Pilot', 'GitHub workflow provenance rejected');
  requireValue(run.event === receipt.trigger && run.head_branch === 'main', 'Unexpected run trigger or branch');
  requireValue(typeof run.head_sha === 'string' && run.head_sha.startsWith(receipt.sha), 'GitHub commit SHA mismatch');
  requireValue(run.html_url === receipt.run_url && run.status === 'completed', 'GitHub run not completed');
  requireValue((receipt.overall === 'ok' && run.conclusion === 'success') ||
    (receipt.overall === 'error' && run.conclusion === 'failure'), 'GitHub run outcome does not match');
  const created = timestamp(run.created_at);
  const updated = timestamp(run.updated_at);
  requireValue(Number.isFinite(created) && Number.isFinite(updated) &&
    created - 5 * 60 * 1000 <= receipt.observedAtMs &&
    receipt.observedAtMs <= updated + 5 * 60 * 1000, 'Run time correlation rejected');
  return { runUrl: receipt.run_url, status: 'metadata_correlated', observedAtMs: receipt.observedAtMs };
}
