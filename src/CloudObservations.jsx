import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  CLOUD_PAGES, CLOUD_REPO, cloudStatusUrl, cloudHistoryUrl, cloudRunApi,
  parseCloudReceipt, parseCloudHistory, correlateCloudRun
} from './cloud-observation-model.mjs';

const NAMES = {
  heartbeat: 'Worker heartbeat',
  repo_layout: 'Runtime layout',
  github_repo_metrics: 'GitHub repository metrics'
};
function safeFetchText(url, signal) {
  return fetch(url, { signal, cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error('Cloud worker evidence HTTP ' + r.status);
    return r.text();
  });
}
function safeFetchJson(url, signal) {
  return fetch(url, { signal, headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error('GitHub run verification HTTP ' + r.status);
    return r.json();
  });
}
export default function CloudObservations() {
  const [state, setState] = useState({ phase: 'idle', receipt: null, history: [], correlated: false, error: '', checked: null });
  async function refresh(signal) {
    setState(s => ({ ...s, phase: 'loading', error: '', receipt: null, history: [], correlated: false }));
    try {
      const [rawReceipt, rawHistory] = await Promise.all([
        safeFetchText(cloudStatusUrl(), signal), safeFetchText(cloudHistoryUrl(), signal)
      ]);
      if (rawReceipt.length > 30000) throw new Error('Cloud receipt too large');
      const receipt = parseCloudReceipt(JSON.parse(rawReceipt));
      const history = parseCloudHistory(rawHistory, receipt);
      const run = await safeFetchJson(cloudRunApi(receipt.run_id), signal);
      correlateCloudRun(receipt, run);
      if (!signal?.aborted) setState({ phase: 'ready', receipt, history, correlated: true, error: '', checked: Date.now() });
    } catch (e) {
      if (!signal?.aborted) setState({ phase: 'error', receipt: null, history: [], correlated: false, error: e.message || 'Observation unavailable', checked: Date.now() });
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, []);
  const data = state.receipt;
  const stale = data && (Date.now() - data.observedAtMs) > 8 * 60 * 60 * 1000;
  const label = state.phase !== 'ready' ? 'UNCONFIRMED' : stale ? 'STALE' : data.overall === 'ok' ? 'HEALTHY OBSERVATION' : 'TASK ERROR';
  return <section className="cloud-observations" id="cloud-observations" aria-labelledby="cloud-heading">
    <div className="cloud-heading">
      <div><span className="section-kicker">04 / REMOTE OBSERVATION</span><h2 id="cloud-heading">FieldCloudWorker</h2>
        <p>Independent GitHub-hosted observations, with public run metadata correlation. These records cannot request or authorize execution.</p></div>
      <span className={'cloud-state ' + (state.phase === 'ready' && !stale && data.overall === 'ok' ? 'healthy' : '')}>
        <Activity size={14}/> {label}
      </span>
    </div>
    <div className="cloud-toolbar">
      <span><ShieldCheck size={14}/> Read-only external source</span>
      <button type="button" disabled={state.phase === 'loading'} onClick={() => refresh()}>
        <RefreshCw size={14}/> {state.phase === 'loading' ? 'CHECKING…' : 'REFRESH EVIDENCE'}
      </button>
    </div>
    {state.phase === 'loading' && <p className="cloud-note">Checking Pages receipt and the GitHub workflow run…</p>}
    {state.phase === 'error' && <div className="cloud-warning" role="status">
      Cannot confirm CloudWorker evidence: {state.error}. No data has been trusted or actions unlocked.
      <a href={'https://github.com/' + CLOUD_REPO + '/actions'} target="_blank" rel="noreferrer"> Inspect GitHub Actions <ArrowUpRight size={12}/></a>
    </div>}
    {state.phase === 'ready' && <>
      <div className="cloud-stats">
        <div><small>LAST OBSERVED</small><strong><Clock3 size={15}/> {new Date(data.observedAtMs).toLocaleString()}</strong></div>
        <div><small>FIXED TASKS</small><strong>{data.passed} passed / {data.failed} failed</strong></div>
        <div><small>PROVENANCE</small><strong>GitHub run metadata matched</strong></div>
      </div>
      {stale && <p className="cloud-warning" role="status">Observation is over eight hours old. A successful old result is not a current health check.</p>}
      <div className="cloud-task-grid">{data.results.map(task => <div className="cloud-task" key={task.task}>
        <span className={'cloud-task-state ' + task.status}>{task.status.toUpperCase()}</span>
        <strong>{NAMES[task.task]}</strong>
        <small>{task.status === 'error' ? 'Error code: ' + task.error_code :
          task.task === 'heartbeat' ? 'Signal: alive' :
          task.task === 'repo_layout' ? '3 required files present' :
          'Stars: ' + (task.output.stars ?? 'n/a') + ' · Open issues/PRs: ' + (task.output.open_issues_and_prs ?? 'n/a')}
        </small>
      </div>)}</div>
      <div className="cloud-subheading"><span>RECENT CLOUD RUNS</span><a href={data.run_url} target="_blank" rel="noreferrer">LATEST SOURCE RUN <ArrowUpRight size={12}/></a></div>
      <div className="cloud-history">{state.history.map((entry, i) => <div key={entry.run_id + '-' + i}>
        <span className={'cloud-task-state ' + (entry.overall === 'ok' ? 'ok' : 'error')}>{entry.overall.toUpperCase()}</span>
        <span>{new Date(entry.run_at).toLocaleString()}</span>
        <small>{entry.ok_count} passed / {entry.error_count} failed</small>
      </div>)}</div>
      <p className="cloud-note">Cross-check confirms the source workflow's repository, branch, run ID, commit, and outcome. It does not cryptographically authenticate individual measurements. <a href={CLOUD_PAGES} target="_blank" rel="noreferrer">Open worker dashboard <ArrowUpRight size={12}/></a></p>
    </>}
  </section>;
}
