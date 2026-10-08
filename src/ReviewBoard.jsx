import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Clipboard, Inbox, RefreshCw, ShieldCheck, ExternalLink } from 'lucide-react';
import { parseProposalInbox, proposalInboxUrl, proposalCommentsUrl, proposalDetailsUrl, reviewCommand } from './review-board-model.mjs';
import { reconcileProposalEvidence } from './review-evidence.mjs';

/**
 * Read-only public review queue. The operator posts an explicit comment on
 * GitHub; no public browser token, implicit approval, or execution path.
 */
export default function ReviewBoard({ repository }) {
  const [issues, setIssues] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fingerprint, setFingerprint] = useState(null);
  const [summary, setSummary] = useState(null);
  const evidenceRequest = useRef(0);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = issues.find(x => x.number === selectedNumber) || null;

  async function refresh(signal) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(proposalInboxUrl(repository), { signal, headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) throw new Error(res.status === 403 ? 'Public GitHub API rate limit or access denied' : 'GitHub API HTTP ' + res.status);
      const safe = parseProposalInbox(await res.json(), repository);
      setIssues(safe);
      setSelectedNumber(previous => safe.some(x => x.number === previous) ? previous : safe[0]?.number ?? null);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    const ctrl = new AbortController();
    refresh(ctrl.signal);
    return () => ctrl.abort();
  }, [repository]);

  function selectIssue(issueNumber) {
    if (issueNumber === selectedNumber) return;
    evidenceRequest.current += 1;
    setSelectedNumber(issueNumber);
    setSummary(null);
    setFingerprint(null);
    setEvidenceError('');
    setNotice('');
  }

  async function loadEvidence() {
    if (!selected) return;
    const request = ++evidenceRequest.current;
    const issueNumber = selected.number;
    setEvidenceLoading(true);
    setSummary(null);
    setFingerprint(null);
    setEvidenceError('');
    setNotice('');
    try {
      const headers = { Accept: 'application/vnd.github+json' };
      const [issueRes, commentsRes] = await Promise.all([
        fetch(proposalDetailsUrl(repository, issueNumber), { headers }),
        fetch(proposalCommentsUrl(repository, issueNumber), { headers })
      ]);
      if (!issueRes.ok || !commentsRes.ok) throw new Error('GitHub evidence API returned ' + (!issueRes.ok ? issueRes.status : commentsRes.status));
      const [issue, comments] = await Promise.all([issueRes.json(), commentsRes.json()]);
      const evidence = await reconcileProposalEvidence(issue, comments);
      if (request !== evidenceRequest.current) return;
      setSummary(evidence);
      setFingerprint(evidence.command_enabled ? evidence.current_fingerprint : null);
      setNotice(evidence.message);
    } catch (e) {
      if (request === evidenceRequest.current) setEvidenceError(e.message);
    } finally {
      if (request === evidenceRequest.current) setEvidenceLoading(false);
    }
  }

  async function copyDecision(kind) {
    try {
      await navigator.clipboard.writeText(reviewCommand(kind, fingerprint));
      setNotice('Review command copied. Paste it as a comment on the linked GitHub issue. Nothing has been approved here.');
    } catch (e) {
      setEvidenceError('Clipboard unavailable. You can type the exact command in GitHub: /fielddeck review ' + kind + ' ' + fingerprint);
    }
  }

  return <section className="review-board" id="review-board" aria-labelledby="review-heading">
    <div className="review-head">
      <div><span className="section-kicker">06 / REVIEW BOARD</span><h2 id="review-heading">Blueprint inbox</h2>
        <p>Public proposals from GitHub, read only. Validation is not approval. Human recommendations require a signed-in repository writer.</p></div>
      <button type="button" className="review-refresh" disabled={loading} onClick={() => refresh()}><RefreshCw size={15}/>{loading ? 'LOADING…' : 'REFRESH'}</button>
    </div>
    {error && <p role="alert" className="review-message-error">{error}. <a href={'https://github.com/' + repository + '/issues'} target="_blank" rel="noreferrer">Open GitHub Issues <ArrowUpRight size={13}/></a></p>}
    {!error && loading && issues.length === 0 && <p className="review-empty">Loading public proposals…</p>}
    {!error && !loading && issues.length === 0 && <div className="review-empty"><Inbox size={21}/><strong>No proposals submitted yet</strong><span>Create one from Chain Lab → Propose for Review.</span><a href="#chain-lab">OPEN CHAIN LAB <ArrowUpRight size={13}/></a></div>}
    {issues.length > 0 && <div className="review-grid">
      <div className="review-items">
        <span className="review-kicker">RECENT PROPOSALS · {issues.length} SHOWN</span>
        {issues.map(item => <button type="button" key={item.number} onClick={() => selectIssue(item.number)}
          className={'review-issue' + (selected?.number === item.number ? ' active' : '')}>
          <span className="review-issue-top"><b>#{item.number}</b><span>{item.state.toUpperCase()}</span></span>
          <strong>{item.name}</strong>
          <small>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Public proposal'}</small>
        </button>)}
      </div>
      <div className="review-detail">
        {selected && <>
          <span className="review-kicker">PROPOSAL #{selected.number} / EXTERNAL REVIEW</span>
          <h3>{selected.name}</h3>
          <p>Review the issue's blueprint and validation comment on GitHub. Neither a closed issue nor a validation fingerprint proves human approval.</p>
          <a href={selected.url} target="_blank" rel="noreferrer" className="review-open">READ PROPOSAL ON GITHUB <ExternalLink size={14}/></a>
          <button type="button" className="review-evidence" disabled={evidenceLoading} onClick={loadEvidence}>
            <ShieldCheck size={16}/>{evidenceLoading ? 'CHECKING VALIDATION…' : 'CHECK CURRENT EVIDENCE'}
          </button>
          {summary && <div className="review-evidence-summary" role="status">
            <span className={'review-evidence-state ' + (summary.state.includes('STALE') || summary.state === 'INVALID_PROPOSAL' ? 'stale' : '')}>{summary.state.replaceAll('_', ' ')}</span>
            <p>{summary.message}</p>
            <small>Execution authorized: NO · Implementation authorized: NO</small>
            <div className="review-evidence-facts">
              <span>Validation: {summary.validation_matches_current ? 'MATCHES CURRENT ISSUE' : summary.validation_fingerprint ? 'STALE' : 'NOT FOUND'}</span>
              <span>Human recommendation: {summary.decision?.decision?.replaceAll('_', ' ') || 'NOT RECORDED'}{summary.decision && !summary.decision_matches_current ? ' (STALE)' : ''}</span>
              {summary.decision?.reviewer && <span>Last recorded reviewer: @{summary.decision.reviewer}</span>}
              {summary.steps?.length > 0 && <span>Steps: {summary.steps.join(' → ')}</span>}
            </div>
          </div>}
          {summary?.current_fingerprint && <div className="review-fingerprint"><span>CURRENT BLUEPRINT SHA-256 (NOT AUTHORIZATION)</span><code>{summary.current_fingerprint}</code></div>}
          <div className="review-commands">
            <button type="button" disabled={!fingerprint} onClick={() => copyDecision('accept')}><Clipboard size={14}/> COPY ACCEPT-FOR-IMPLEMENTATION</button>
            <button type="button" disabled={!fingerprint} onClick={() => copyDecision('decline')}><Clipboard size={14}/> COPY DECLINE</button>
          </div>
          <small className="review-warning">Commands must be posted manually as GitHub comments. The workflow verifies repository write access, the current blueprint fingerprint, and prior validator evidence. A review recommendation never implements or executes a blueprint.</small>
          {notice && <p className="review-notice" role="status">{notice}</p>}
          {evidenceError && <p className="review-message-error" role="alert">{evidenceError}</p>}
        </>}
      </div>
    </div>}
  </section>;
}
