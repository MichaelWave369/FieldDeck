import { useEffect, useState } from 'react';
import { ArrowUpRight, Clipboard, Inbox, RefreshCw, ShieldCheck, ExternalLink } from 'lucide-react';
import { parseProposalInbox, parseValidationEvidence, proposalInboxUrl, proposalCommentsUrl, reviewCommand } from './review-board-model.mjs';

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
    setSelectedNumber(issueNumber);
    setFingerprint(null);
    setEvidenceError('');
    setNotice('');
  }

  async function loadEvidence() {
    if (!selected) return;
    setEvidenceLoading(true);
    setFingerprint(null);
    setEvidenceError('');
    setNotice('');
    try {
      const res = await fetch(proposalCommentsUrl(repository, selected.number), { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) throw new Error('GitHub comments API HTTP ' + res.status);
      const evidence = parseValidationEvidence(await res.json());
      if (!evidence) throw new Error('No valid GitHub Actions validation fingerprint found; validate the issue first');
      setFingerprint(evidence.fingerprint);
      setNotice('Validator fingerprint loaded. Read the actual blueprint in GitHub before making a decision.');
    } catch (e) {
      setEvidenceError(e.message);
    } finally {
      setEvidenceLoading(false);
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
            <ShieldCheck size={16}/>{evidenceLoading ? 'CHECKING VALIDATION…' : 'LOAD VALIDATION FINGERPRINT'}
          </button>
          {fingerprint && <div className="review-fingerprint"><span>CANONICAL SHA-256 (VALIDATION ONLY)</span><code>{fingerprint}</code></div>}
          <div className="review-commands">
            <button type="button" disabled={!fingerprint} onClick={() => copyDecision('accept')}><Clipboard size={14}/> COPY ACCEPT-FOR-IMPLEMENTATION</button>
            <button type="button" disabled={!fingerprint} onClick={() => copyDecision('decline')}><Clipboard size={14}/> COPY DECLINE</button>
          </div>
          <small className="review-warning">Commands must be posted manually as GitHub comments. The workflow verifies repository write access and an exact matching fingerprint. Accepting a proposal does not implement or execute it.</small>
          {notice && <p className="review-notice" role="status">{notice}</p>}
          {evidenceError && <p className="review-message-error" role="alert">{evidenceError}</p>}
        </>}
      </div>
    </div>}
  </section>;
}
