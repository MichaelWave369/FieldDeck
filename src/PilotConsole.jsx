import { useState } from 'react';
import { ArrowUpRight, CheckCircle2, ClipboardList, ExternalLink, FileDown, RefreshCw, ShieldCheck } from 'lucide-react';
import { assessPilot, githubRunUrl, latestProposalNumber, pilotIssueNumber, pilotProposalUrl, pilotUrls } from './pilot-model.mjs';
import { proposalInboxUrl } from './review-board-model.mjs';

/** Explicit operator actions only, no background polling and no account token. */
export default function PilotConsole({ repository, onExport }) {
  const [issueInput, setIssueInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [notice, setNotice] = useState('');

  async function githubJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error('GitHub API HTTP ' + response.status + (response.status === 403 ? ' (rate limit or access denied)' : ''));
    return response.json();
  }

  function openPilot() {
    try {
      const url = pilotProposalUrl(repository);
      window.open(url, '_blank', 'noopener,noreferrer');
      setNotice('GitHub draft opened. Review and submit the issue there. Merely opening it runs nothing.');
      setError('');
    } catch (e) { setError(e.message); }
  }

  async function verify(useLatest = false) {
    setBusy(true);
    setError('');
    setNotice('');
    setReport(null);
    try {
      let issueNo;
      if (useLatest) {
        const data = await githubJson(proposalInboxUrl(repository));
        issueNo = latestProposalNumber(data, repository);
        if (!issueNo) throw new Error('No submitted FD PROPOSE issues found. Create and submit the pilot proposal first.');
        setIssueInput(String(issueNo));
      } else issueNo = pilotIssueNumber(issueInput);
      const urls = pilotUrls(repository, issueNo);
      const [issue, comments] = await Promise.all([githubJson(urls.issue), githubJson(urls.comments)]);
      const fingerprintReport = await assessPilot(issue, comments, repository);
      const runIds = [fingerprintReport.validation_run_id, fingerprintReport.human_review_run_id];
      const [validation, decision] = await Promise.all(runIds.map(id => id ? githubJson(githubRunUrl(repository, id)) : Promise.resolve(null)));
      // Recompute using live workflow details, not comment claims.
      const checked = await assessPilot(issue, comments, repository, { validation, decision });
      setReport(checked);
      setNotice('Read-only check completed against public GitHub issue, comments and linked workflow runs.');
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  return <section className="pilot-console" id="pilot-console" aria-labelledby="pilot-heading">
    <div className="pilot-heading">
      <div><span className="section-kicker">07 / LIVE ACCEPTANCE</span><h2 id="pilot-heading">Review Pilot Console</h2>
        <p>A guided real-world check of the GitHub proposal → validation → human review path. No fake success lights and no auto-submitted GitHub issues.</p></div>
      <span className="pilot-badge"><ClipboardList size={15}/> OPERATOR-GUIDED</span>
    </div>
    <div className="pilot-steps">
      <div className="pilot-step"><b>01</b><strong>Submit a harmless pilot proposal</strong><p>Prefills a two-step, non-executable blueprint on GitHub. You confirm the issue submission.</p>
        <button type="button" onClick={openPilot}><ExternalLink size={14}/> OPEN PILOT ISSUE DRAFT</button>
      </div>
      <div className="pilot-step"><b>02</b><strong>Verify GitHub evidence</strong><p>After submitting, enter your issue number or inspect the latest proposal. Public REST API checks are read-only.</p>
        <label htmlFor="pilot-issue-number">GITHUB ISSUE NUMBER</label>
        <input id="pilot-issue-number" inputMode="numeric" value={issueInput} onChange={e=>setIssueInput(e.target.value)} placeholder="e.g. 11"/>
        <div className="pilot-actions">
          <button type="button" disabled={busy} onClick={()=>verify(false)}><ShieldCheck size={14}/> VERIFY ISSUE</button>
          <button type="button" disabled={busy} onClick={()=>verify(true)}><RefreshCw size={14}/> VERIFY LATEST</button>
        </div>
      </div>
      <div className="pilot-step"><b>03</b><strong>Record human review separately</strong><p>If validation is confirmed, use Review Board to copy a reviewer command, post it on GitHub, then verify again.</p>
        <a href="#review-board">OPEN REVIEW BOARD <ArrowUpRight size={14}/></a>
      </div>
    </div>
    {notice && <p role="status" className="pilot-notice">{notice}</p>}
    {error && <p role="alert" className="pilot-error">{error}</p>}
    {report && <div className="pilot-report" role="status">
      <div className="pilot-report-head"><div><span>LIVE GITHUB EVIDENCE</span><h3>{report.status.replaceAll('_',' ')}</h3></div>
        <button type="button" onClick={()=>onExport(report)}><FileDown size={14}/> EXPORT REPORT</button>
      </div>
      <div className="pilot-report-grid">
        <span>Issue submitted</span><strong><a href={report.issue_url} target="_blank" rel="noreferrer">#{report.issue_number} <ArrowUpRight size={12}/></a></strong>
        <span>Validation workflow</span><strong>{report.validation_workflow_verified ? 'CONFIRMED SUCCESS' : 'NOT YET VERIFIED'}</strong>
        <span>Human review workflow</span><strong>{report.human_review_workflow_verified ? 'CONFIRMED SUCCESS' : 'NOT YET VERIFIED'}</strong>
        <span>Execution permission</span><strong>NONE GRANTED</strong>
      </div>
      <p>{report.note} An accepted review is not permission to implement or execute.</p>
      {report.validation_workflow_verified && <span className="pilot-confirm"><CheckCircle2 size={15}/> GitHub validation run verified</span>}
    </div>}
  </section>;
}
