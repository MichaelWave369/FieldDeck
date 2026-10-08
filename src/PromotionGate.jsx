import { useEffect, useState } from 'react';
import { ClipboardCheck, FileDown, GitPullRequestArrow, ShieldAlert, ArrowUpRight, ExternalLink } from 'lucide-react';
import { createPromotionCandidate, implementationIssueUrl } from './promotion-model.mjs';

/** Builds a locally exportable implementation plan. Never an execution grant. */
export default function PromotionGate({ context, onExport }) {
  const [error,setError]=useState('');
  const [candidate,setCandidate]=useState(null);
  const [notice,setNotice]=useState('');
  // An outdated verified issue must never leave an old candidate looking current.
  useEffect(()=>{setCandidate(null);setNotice('');setError('');},[context]);

  async function prepare() {
    setError('');setNotice('');setCandidate(null);
    try{
      if(!context)throw new Error('Verify a live accepted proposal in Pilot Console first');
      const pack=await createPromotionCandidate(context.issue,context.report,context.repository);
      setCandidate(pack);
      setNotice('Candidate prepared locally; no GitHub task, implementation or execution has started.');
    }catch(e){setError(e.message);}
  }
  function handoff() {
    try {
      const url=implementationIssueUrl(candidate);
      window.open(url,'_blank','noopener,noreferrer');
      setNotice('GitHub implementation-planning draft opened. It is not submitted and grants no authority.');
    }catch(e){setError(e.message);}
  }
  return <section className="promotion-gate" id="promotion-gate" aria-labelledby="promotion-heading">
    <div className="promotion-heading">
      <div><span className="section-kicker">08 / GOVERNED IMPLEMENTATION</span><h2 id="promotion-heading">Promotion Gate</h2>
        <p>Turn an accepted, verified proposal into a versioned, default-deny implementation candidate. A separate reviewed pull request remains mandatory.</p></div>
      <span className="promotion-locked"><ShieldAlert size={15}/> EXECUTION LOCKED</span>
    </div>
    <div className="promotion-panel">
      <div className="promotion-summary">
        <strong>{context?.report?.status==='HUMAN_REVIEW_RECORDED' ? 'VERIFIED HUMAN REVIEW AVAILABLE' : 'AWAITING LIVE ACCEPTED REVIEW'}</strong>
        <small>{context ? 'Issue #'+context.issue.number+' · '+context.issue.title : 'Use Pilot Console → Verify Issue to load live review evidence.'}</small>
      </div>
      <button type="button" className="promotion-build" disabled={!context} onClick={prepare}><ClipboardCheck size={15}/> PREPARE IMPLEMENTATION CANDIDATE</button>
    </div>
    {candidate && <div className="promotion-candidate">
      <div><span className="section-kicker">CANDIDATE ONLY / 0.1.0</span><h3>{candidate.proposed_capability.name}</h3>
        <code>{candidate.proposed_capability.id}</code></div>
      <div className="promotion-facts">
        <span>BLUEPRINT</span><strong>{candidate.provenance.canonical_sha256.slice(0,16)}…</strong>
        <span>VALIDATION</span><a href={candidate.provenance.validation_run_url} target="_blank" rel="noreferrer">VIEW VERIFIED RUN <ArrowUpRight size={12}/></a>
        <span>HUMAN REVIEW</span><a href={candidate.provenance.reviewer_decision_run_url} target="_blank" rel="noreferrer">VIEW VERIFIED RUN <ArrowUpRight size={12}/></a>
        <span>IMPLEMENTATION</span><strong>NOT AUTHORIZED</strong>
        <span>EXECUTION</span><strong>DENIED</strong>
      </div>
      <div className="promotion-checklist"><strong>Required before any implementation</strong>
        {candidate.implementation_gates.map((item,i)=><div key={i}><span>□</span><span>{item}</span></div>)}
      </div>
      <div className="promotion-actions">
        <button type="button" onClick={()=>onExport(candidate)}><FileDown size={14}/> EXPORT CANDIDATE JSON</button>
        <button type="button" onClick={handoff}><GitPullRequestArrow size={14}/> OPEN IMPLEMENTATION ISSUE DRAFT</button>
      </div>
      <p>Candidate artifacts and planning issues are not approval receipts. Only separately reviewed and merged code may add an executable action.</p>
    </div>}
    {notice&&<p className="pilot-notice" role="status">{notice}</p>}
    {error&&<p className="pilot-error" role="alert">{error}</p>}
  </section>;
}
