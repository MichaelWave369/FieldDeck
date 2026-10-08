/**
 * A read-only evidence projection. Source: public GitHub issue + authenticated
 * github-actions[bot] comments. Fingerprints are comparison aids, never approvals.
 */
import { parseProposalIssue } from './proposal-model.mjs';
import { parseValidationEvidence } from './review-board-model.mjs';

const BOT='github-actions[bot]';
const DECISION_RE=/^- Decision: \*\*(ACCEPTED FOR IMPLEMENTATION REVIEW|DECLINED)\*\*$/m;
const FP_RE=/^- Blueprint SHA-256: `([a-f0-9]{64})`$/m;
const REVIEWER_RE=/^- Reviewer: @([A-Za-z0-9-]{1,39})$/m;

export async function browserBlueprintFingerprint(blueprint) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure browser fingerprinting unavailable');
  const data=new TextEncoder().encode(JSON.stringify(blueprint));
  const digest=await globalThis.crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}

export function parseDecisionEvidence(comments) {
  if (!Array.isArray(comments)) throw new Error('Invalid GitHub comment list');
  for(const c of [...comments].reverse()){
    if(c?.user?.login!==BOT || typeof c.body!=='string'
      || !c.body.includes('### FieldDeck human review decision')
      || !c.body.includes('- Execution authorized: **NO**')
      || !c.body.includes('- Implementation authorized: **NO**')) continue;
    const decision=DECISION_RE.exec(c.body);
    const sha=FP_RE.exec(c.body);
    const reviewer=REVIEWER_RE.exec(c.body);
    if(decision && sha && reviewer) {
      return {
        decision: decision[1]==='ACCEPTED FOR IMPLEMENTATION REVIEW'?'ACCEPTED_FOR_IMPLEMENTATION_REVIEW':'DECLINED',
        fingerprint:sha[1],
        reviewer:reviewer[1],
        at:typeof c.created_at==='string'?c.created_at:null
      };
    }
  }
  return null;
}

export async function reconcileProposalEvidence(issue, comments, fingerprint=browserBlueprintFingerprint) {
  if(!issue || !Array.isArray(comments))throw new Error('Missing GitHub issue or comments');
  const proposal=parseProposalIssue(issue.title,issue.body);
  const validation=parseValidationEvidence(comments);
  const decision=parseDecisionEvidence(comments);
  if(!proposal){
    return {state:'INVALID_PROPOSAL',command_enabled:false,execution_authorized:false,
      current_fingerprint:null,validation_fingerprint:validation?.fingerprint||null,decision,
      steps:[],message:'The current issue body does not match a valid v0.5 blueprint.'};
  }
  const current=await fingerprint(proposal.blueprint);
  if(typeof current!=='string'||!/^[a-f0-9]{64}$/.test(current))throw new Error('Fingerprint verification failed');
  const validationMatches=validation?.fingerprint===current;
  const decisionMatches=decision?.fingerprint===current;
  let state='AWAITING_VALIDATION';
  if(validation && !validationMatches)state='STALE_VALIDATION';
  else if(validationMatches && decision && !decisionMatches)state='STALE_DECISION';
  else if(validationMatches && decisionMatches)state=decision.decision;
  else if(validationMatches)state='AWAITING_HUMAN_REVIEW';
  const open=issue.state==='open';
  return {
    state,
    command_enabled:open&&validationMatches,
    execution_authorized:false,
    current_fingerprint:current,
    validation_fingerprint:validation?.fingerprint||null,
    validation_matches_current:validationMatches,
    decision,
    decision_matches_current:!!decisionMatches,
    steps:proposal.steps,
    message:state==='STALE_VALIDATION'||state==='STALE_DECISION'
      ?'Evidence references an older blueprint. Submit a new proposal issue for validation.'
      :open?'Review context verified against the current issue body.':'Issue is closed. Reopen it before recording a new decision.'
  };
}
