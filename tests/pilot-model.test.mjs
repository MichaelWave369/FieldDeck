import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createBlueprint } from '../src/blueprint-model.mjs';
import { proposalBody } from '../src/proposal-model.mjs';
import { assessPilot, githubRunUrl, isVerifiedRun, latestProposalNumber, pilotIssueNumber, pilotProposalUrl, pilotUrls } from '../src/pilot-model.mjs';

const repo = 'MichaelWave369/FieldDeck';
const bp = createBlueprint(['catalog-health','script-smoke'],'FieldDeck Pilot Review');
const sha = createHash('sha256').update(JSON.stringify(bp)).digest('hex');
const issue = {number:12,title:'FD PROPOSE: FieldDeck Pilot Review',body:proposalBody(bp),state:'open'};
const author={user:{login:'github-actions[bot]'}};
const validation={...author,body: [
  '### FieldDeck blueprint validation',
  '- Result: **VALID FOR HUMAN REVIEW**',
  '- Execution authorized: **NO**',
  '- Blueprint fingerprint (SHA-256): `' + sha + '`',
  '- Validation run: https://github.com/'+repo+'/actions/runs/1234'
].join('\n')};
const decision={...author,body: [
  '### FieldDeck human review decision',
  '- Decision: **ACCEPTED FOR IMPLEMENTATION REVIEW**',
  '- Reviewer: @MichaelWave369',
  '- Blueprint SHA-256: `' + sha + '`',
  '- Execution authorized: **NO**',
  '- Implementation authorized: **NO**',
  '- Review run: https://github.com/'+repo+'/actions/runs/5678'
].join('\n')};
const run=(id,kind)=>({id,repository:{full_name:repo},status:'completed',conclusion:'success',
  event:kind==='validation'?'issues':'issue_comment',name:kind==='validation'?'FieldDeck blueprint review validation':'FieldDeck human review decision',
  path:repo+'/.github/workflows/'+(kind==='validation'?'blueprint-review.yml':'review-decision.yml')+'@refs/heads/main'});
const fp=async b=>createHash('sha256').update(JSON.stringify(b)).digest('hex');

test('draft link uses safe proposal protocol; no automatic GitHub issue creation',()=>{
  const url=new URL(pilotProposalUrl(repo));
  assert.equal(url.hostname,'github.com');
  assert.equal(url.searchParams.get('title'),'FD PROPOSE: FieldDeck Pilot Review');
  assert.throws(()=>pilotProposalUrl('evil/../../repo'));
  assert.equal(pilotIssueNumber('12'),12);
  assert.throws(()=>pilotIssueNumber('../12'));
  assert.throws(()=>pilotIssueNumber(0));
  assert.match(pilotUrls(repo,12).comments,/\/issues\/12\/comments/);
});
test('latest proposal selects only FD PROPOSE issues, never pull requests',()=>{
  assert.equal(latestProposalNumber([
    {number:16,title:'FD RUN: catalog-health'},
    {number:15,title:'FD PROPOSE: FieldDeck Pilot Review'},
    {number:14,title:'FD PROPOSE: Fake PR',pull_request:{}}
  ],repo),15);
  assert.equal(latestProposalNumber([],repo),null);
});
test('no comments is waiting, and no imaginary workflow success',async()=>{
  const result=await assessPilot(issue,[],repo,{},fp);
  assert.equal(result.status,'WAITING_FOR_VALIDATION');
  assert.equal(result.execution_authorized,false);
  assert.equal(result.tasks_executed_by_pilot,false);
});
test('comment without matching real GitHub Actions run remains unverified',async()=>{
  const result=await assessPilot(issue,[validation],repo,{},fp);
  assert.equal(result.status,'UNCONFIRMED_VALIDATION_RUN');
  assert.equal(result.validation_run_id,'1234');
  assert.equal(result.validation_workflow_verified,false);
});
test('verified validation and review are independent evidence steps',async()=>{
  const first=await assessPilot(issue,[validation],repo,{validation:run(1234,'validation')},fp);
  assert.equal(first.status,'VALIDATION_VERIFIED');
  const next=await assessPilot(issue,[validation,decision],repo,{validation:run(1234,'validation'),decision:run(5678,'decision')},fp);
  assert.equal(next.status,'HUMAN_REVIEW_RECORDED');
  assert.equal(next.human_review_workflow_verified,true);
  assert.equal(next.execution_authorized,false);
  assert.equal(next.is_execution_receipt,false);
});
test('spoofed, failed, wrong-workflow, wrong-repo and pending runs never verify',()=>{
  assert.equal(isVerifiedRun(run(1234,'validation'),repo,'1234','validation'),true);
  assert.equal(isVerifiedRun(run(1234,'decision'),repo,'1234','validation'),false);
  assert.equal(isVerifiedRun({...run(1234,'validation'),conclusion:'failure'},repo,'1234','validation'),false);
  assert.equal(isVerifiedRun({...run(1234,'validation'),repository:{full_name:'attacker/repo'}},repo,'1234','validation'),false);
  assert.equal(isVerifiedRun({...run(1234,'validation'),status:'in_progress'},repo,'1234','validation'),false);
  assert.equal(isVerifiedRun({...run(1234,'validation'),path:'attacker/.github/workflows/blueprint-review.yml'},repo,'1234','validation'),false);
  assert.throws(()=>githubRunUrl(repo,'1234/anything'));
});
test('editing proposal invalidates stale validation evidence',async()=>{
  const edited={...issue,body:proposalBody(createBlueprint(['macro-demo'],'FieldDeck Pilot Review'))};
  const out=await assessPilot(edited,[validation,decision],repo,{},fp);
  assert.equal(out.status,'BLOCKED');
  assert.equal(out.validation_workflow_verified,false);
});
test('bot author is required and arbitrary browser fields cannot invent evidence',async()=>{
  const fake={...validation,user:{login:'someone-else'}};
  const out=await assessPilot(issue,[fake],repo,{validation:run(1234,'validation')},fp);
  assert.equal(out.status,'WAITING_FOR_VALIDATION');
  await assert.rejects(assessPilot({...issue,number:0},[],repo,{},fp));
});
