/**
 * FieldDeck 1.0 promotion handoff.
 * Derived from a verified operator check and current GitHub proposal.
 * Produces a non-authoritative implementation candidate, NEVER a runnable task.
 */
import { parseProposalIssue } from './proposal-model.mjs';
import { browserBlueprintFingerprint } from './review-evidence.mjs';

export const PROMOTION_VERSION = '1.0.0';
export const PROMOTION_KIND = 'fielddeck.implementation.candidate';
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA = /^[a-f0-9]{64}$/;
const RUN = /^[1-9][0-9]{0,18}$/;
const TASKS = Object.freeze([
  'Freeze the reviewed blueprint fingerprint in a separately reviewed code change.',
  'Implement the fixed allowlisted executor sequence; never execute user-supplied JSON.',
  'Add positive, negative, fail-fast, and permission-boundary tests.',
  'Update the authenticated IssueOps routing and public catalog only after code review.',
  'Require a separate merged PR and successful CI before enabling any action.',
  'Re-test runtime receipts and verify default-deny behavior after deployment.'
]);
export const PROMOTION_GATES = Object.freeze([...TASKS]);
const exactKeys=(object, keys)=>object && typeof object==='object' && !Array.isArray(object)
  && Object.keys(object).length===keys.length && keys.every(k=>Object.hasOwn(object,k));

function assertIdentity(repo, issueNumber, hash, validationId, reviewId) {
  if(typeof repo!=='string'||!REPO.test(repo)
    || !Number.isSafeInteger(issueNumber)||issueNumber<1
    || typeof hash!=='string'||!SHA.test(hash)
    || typeof validationId!=='string'||!RUN.test(validationId)
    || typeof reviewId!=='string'||!RUN.test(reviewId)
    || validationId===reviewId)throw new Error('Invalid promotion provenance');
}

export async function createPromotionCandidate(issue, report, repo, digest=browserBlueprintFingerprint) {
  const parsed=parseProposalIssue(issue?.title, issue?.body);
  if(!parsed || issue?.state!=='open' || issue.pull_request
    || !Number.isSafeInteger(issue.number) || issue.number<=0)throw new Error('Current proposal is invalid or closed');
  if(!report || report.kind!=='fielddeck.review-acceptance.read-only'
    || report.status!=='HUMAN_REVIEW_RECORDED'
    || report.proposal_state!=='ACCEPTED_FOR_IMPLEMENTATION_REVIEW'
    || report.validation_workflow_verified!==true
    || report.human_review_workflow_verified!==true
    || report.execution_authorized!==false
    || report.tasks_executed_by_pilot!==false
    || report.issue_number!==issue.number
    || report.issue_url!=='https://github.com/'+repo+'/issues/'+issue.number)throw new Error('No verified accepted review for this issue');
  const hash=await digest(parsed.blueprint);
  assertIdentity(repo,issue.number,hash,report.validation_run_id,report.human_review_run_id);
  if(report.current_fingerprint!==hash)throw new Error('Proposal changed since review verification');
  const slug=parsed.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,36) || 'unnamed';
  const candidate={
    schema_version:PROMOTION_VERSION,
    kind:PROMOTION_KIND,
    status:'CANDIDATE_NOT_EXECUTABLE',
    proposed_capability:{
      id:'candidate-'+slug+'-'+issue.number,
      version:'0.1.0',
      name:parsed.name,
      steps:parsed.steps.map(action_id=>({action_id,on_failure:'stop'})),
      runner:'none',enabled:false
    },
    provenance:{
      repository:repo,
      issue_number:issue.number,
      issue_url:report.issue_url,
      canonical_sha256:hash,
      validation_run_url:'https://github.com/'+repo+'/actions/runs/'+report.validation_run_id,
      reviewer_decision_run_url:'https://github.com/'+repo+'/actions/runs/'+report.human_review_run_id,
      human_decision:'ACCEPTED_FOR_IMPLEMENTATION_REVIEW',
      evidence_type:'public-github-api-observation'
    },
    implementation_gates:[...TASKS],
    policy:{
      execution:'denied',
      implementation:'not_authorized',
      requires_separate_code_pr:true,
      requires_human_code_review:true,
      requires_green_ci:true,
      automatically_promoted:false
    },
    execution_authorized:false,
    implementation_authorized:false,
    is_execution_receipt:false,
    is_approval_receipt:false
  };
  // Fail closed on any schema drift before preparing human handoff.
  parsePromotionCandidate(JSON.stringify(candidate));
  return candidate;
}

/** Only structural validity. Imported packs MUST NOT be trusted as verified evidence. */
export function parsePromotionCandidate(json) {
  if(typeof json!=='string'||new TextEncoder().encode(json).length>16384)throw new Error('Invalid candidate size');
  let c;
  try{c=JSON.parse(json);}catch{throw new Error('Invalid promotion JSON');}
  if(!exactKeys(c,['schema_version','kind','status','proposed_capability','provenance','implementation_gates','policy','execution_authorized','implementation_authorized','is_execution_receipt','is_approval_receipt'])
    || c.schema_version!==PROMOTION_VERSION||c.kind!==PROMOTION_KIND||c.status!=='CANDIDATE_NOT_EXECUTABLE'
    || c.execution_authorized!==false||c.implementation_authorized!==false
    || c.is_execution_receipt!==false||c.is_approval_receipt!==false)throw new Error('Candidate is not default-deny');
  const p=c.proposed_capability,v=c.provenance,g=c.policy;
  if(!exactKeys(p,['id','version','name','steps','runner','enabled'])
    || typeof p.id!=='string'|| !/^candidate-[a-z0-9-]{1,45}-[1-9][0-9]*$/.test(p.id)
    || p.version!=='0.1.0'||typeof p.name!=='string'|| !/^[a-zA-Z0-9 _.-]{1,64}$/.test(p.name)
    || p.runner!=='none'||p.enabled!==false
    || !Array.isArray(p.steps)||p.steps.length<1||p.steps.length>6
    || !p.steps.every(s=>exactKeys(s,['action_id','on_failure']) && ['catalog-health','script-smoke','macro-demo'].includes(s.action_id) && s.on_failure==='stop'))throw new Error('Candidate capability is not safe');
  if(!exactKeys(v,['repository','issue_number','issue_url','canonical_sha256','validation_run_url','reviewer_decision_run_url','human_decision','evidence_type'])
    || typeof v.repository!=='string'||!REPO.test(v.repository)
    || !Number.isSafeInteger(v.issue_number)||v.issue_number<=0
    || v.issue_url!=='https://github.com/'+v.repository+'/issues/'+v.issue_number
    || typeof v.canonical_sha256!=='string'||!SHA.test(v.canonical_sha256)
    || v.human_decision!=='ACCEPTED_FOR_IMPLEMENTATION_REVIEW'||v.evidence_type!=='public-github-api-observation'
    || ![v.validation_run_url,v.reviewer_decision_run_url].every(url=>{
      const prefix='https://github.com/'+v.repository+'/actions/runs/';
      return typeof url==='string' && url.startsWith(prefix) && RUN.test(url.slice(prefix.length));
    })
    || v.validation_run_url===v.reviewer_decision_run_url)throw new Error('Candidate provenance invalid');
  if(!Array.isArray(c.implementation_gates)||JSON.stringify(c.implementation_gates)!==JSON.stringify(TASKS)
    ||!exactKeys(g,['execution','implementation','requires_separate_code_pr','requires_human_code_review','requires_green_ci','automatically_promoted'])
    ||g.execution!=='denied'||g.implementation!=='not_authorized'
    ||g.requires_separate_code_pr!==true||g.requires_human_code_review!==true||g.requires_green_ci!==true||g.automatically_promoted!==false)throw new Error('Candidate governance violated');
  return c;
}

export function implementationIssueUrl(candidate) {
  const c=parsePromotionCandidate(JSON.stringify(candidate));
  const v=c.provenance;
  const title='FD IMPLEMENT: '+c.proposed_capability.name+' #'+v.issue_number;
  const body=[
    '## Implementation planning only (NOT an execution request)',
    '',
    'Blueprint issue: '+v.issue_url,
    'Canonical SHA-256: `'+v.canonical_sha256+'`',
    'Validation run: '+v.validation_run_url,
    'Human review run: '+v.reviewer_decision_run_url,
    '',
    '### Reviewed steps',
    ...c.proposed_capability.steps.map((s,i)=>(i+1)+'. `'+s.action_id+'` (stop on failure)'),
    '',
    '### Required implementation gates',
    ...c.implementation_gates.map(s=>'- [ ] '+s),
    '',
    '**No execution or implementation permission is conferred by this planning issue.**'
  ].join('\n');
  const url=new URL('https://github.com/'+v.repository+'/issues/new');
  url.searchParams.set('title',title);
  url.searchParams.set('body',body);
  if(url.toString().length>6000)throw new Error('Implementation planning URL too large');
  return url.toString();
}
