import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createBlueprint} from '../src/blueprint-model.mjs';
import {proposalBody} from '../src/proposal-model.mjs';
import {createPromotionCandidate,parsePromotionCandidate,implementationIssueUrl,PROMOTION_GATES} from '../src/promotion-model.mjs';

const repo='MichaelWave369/FieldDeck';
const blueprint=createBlueprint(['catalog-health','script-smoke'],'FieldDeck Pilot Review');
const hash=b=>createHash('sha256').update(JSON.stringify(b)).digest('hex');
const sha=hash(blueprint),digest=async b=>hash(b);
const issue={number:13,state:'open',title:'FD PROPOSE: FieldDeck Pilot Review',body:proposalBody(blueprint)};
const report={
  kind:'fielddeck.review-acceptance.read-only',
  status:'HUMAN_REVIEW_RECORDED',
  source:'public-github-api',
  proposal_state:'ACCEPTED_FOR_IMPLEMENTATION_REVIEW',
  issue_number:13,
  issue_url:'https://github.com/'+repo+'/issues/13',
  validation_run_id:'37732365651',
  human_review_run_id:'37732614017',
  validation_workflow_verified:true,
  human_review_workflow_verified:true,
  current_fingerprint:sha,
  execution_authorized:false,
  tasks_executed_by_pilot:false
};

test('verified accepted review creates strict non-executable promotion candidate',async()=>{
  const c=await createPromotionCandidate(issue,report,repo,digest);
  assert.equal(c.schema_version,'1.0.0');
  assert.equal(c.kind,'fielddeck.implementation.candidate');
  assert.equal(c.status,'CANDIDATE_NOT_EXECUTABLE');
  assert.equal(c.provenance.canonical_sha256,sha);
  assert.equal(c.proposed_capability.runner,'none');
  assert.equal(c.proposed_capability.enabled,false);
  assert.equal(c.policy.execution,'denied');
  assert.equal(c.policy.requires_separate_code_pr,true);
  assert.equal(c.execution_authorized,false);
  assert.equal(c.implementation_authorized,false);
  assert.equal(c.is_approval_receipt,false);
  assert.deepEqual(parsePromotionCandidate(JSON.stringify(c)),c);
  assert.deepEqual(c.implementation_gates,PROMOTION_GATES);
});
test('implementation handoff is a GitHub draft and not an executable task',async()=>{
  const c=await createPromotionCandidate(issue,report,repo,digest);
  const u=new URL(implementationIssueUrl(c));
  assert.equal(u.hostname,'github.com');
  assert.equal(u.pathname,'/'+repo+'/issues/new');
  assert.match(u.searchParams.get('title'),/^FD IMPLEMENT:/);
  assert.match(u.searchParams.get('body'),/No execution or implementation permission/);
  assert.ok(!u.searchParams.get('body').includes('FD RUN:'));
  assert.ok(!u.searchParams.get('body').includes('execution_authorized: true'));
});
test('no candidate for unverified, declined, stale, changed or unauthorized evidence',async()=>{
  const invalid=[
    {...report,status:'VALIDATION_VERIFIED'},
    {...report,proposal_state:'DECLINED'},
    {...report,proposal_state:'STALE_DECISION'},
    {...report,human_review_workflow_verified:false},
    {...report,validation_workflow_verified:false},
    {...report,execution_authorized:true},
    {...report,tasks_executed_by_pilot:true},
    {...report,current_fingerprint:'f'.repeat(64)},
    {...report,issue_number:11},
    {...report,issue_url:'https://evil.test'},
    {...report,validation_run_id:'../../etc'},
    {...report,human_review_run_id:'37732365651'}
  ];
  for(const bad of invalid)await assert.rejects(createPromotionCandidate(issue,bad,repo,digest));
  await assert.rejects(createPromotionCandidate({...issue,state:'closed'},report,repo,digest));
  await assert.rejects(createPromotionCandidate({...issue,body:'invalid'},report,repo,digest));
  await assert.rejects(createPromotionCandidate({...issue,pull_request:{}},report,repo,digest));
  await assert.rejects(createPromotionCandidate(issue,report,'evil/../../repo',digest));
  await assert.rejects(createPromotionCandidate(issue,report,repo,async()=>'zz'));
});
test('importing promotion JSON cannot escalate or smuggle runtime scripts',async()=>{
  const original=await createPromotionCandidate(issue,report,repo,digest);
  const variations=[
    o=>o.policy.execution='allowed',
    o=>o.policy.implementation='authorized',
    o=>o.proposed_capability.runner='shell',
    o=>o.proposed_capability.enabled=true,
    o=>o.execution_authorized=true,
    o=>o.implementation_authorized=true,
    o=>o.is_execution_receipt=true,
    o=>o.is_approval_receipt=true,
    o=>o.proposed_capability.steps[0].action_id='rm -rf /',
    o=>o.proposed_capability.steps[0].shell='curl https://evil',
    o=>o.provenance.repository='evil/../../repo',
    o=>o.provenance.validation_run_url='https://evil.test',
    o=>o.provenance.canonical_sha256='not-a-sha',
    o=>o.implementation_gates=[],
    o=>o.elevated_policy=true,
    o=>o.schema_version='future'
  ];
  for(const mutate of variations){const obj=structuredClone(original);mutate(obj);assert.throws(()=>parsePromotionCandidate(JSON.stringify(obj)));}
  assert.throws(()=>parsePromotionCandidate('{'));
  assert.throws(()=>parsePromotionCandidate('x'.repeat(18000)));
});
