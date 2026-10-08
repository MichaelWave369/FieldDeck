import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createBlueprint} from '../src/blueprint-model.mjs';
import {proposalBody} from '../src/proposal-model.mjs';
import {parseDecisionEvidence,reconcileProposalEvidence} from '../src/review-evidence.mjs';

const blueprint=createBlueprint(['catalog-health','macro-demo'],'Research Review');
const hash=b=>createHash('sha256').update(JSON.stringify(b)).digest('hex');
const fingerprint=hash(blueprint);
const issue={number:9,title:'FD PROPOSE: Research Review',body:proposalBody(blueprint),state:'open'};
const bot={user:{login:'github-actions[bot]'},created_at:'2026-10-08T01:05:49Z'};
const validation={...bot,body:[
  '### FieldDeck blueprint validation',
  '- Result: **VALID FOR HUMAN REVIEW**',
  '- Execution authorized: **NO**',
  '- Blueprint fingerprint (SHA-256): `'+fingerprint+'`'
].join('\n')};
const accepted={...bot,created_at:'2026-10-08T01:10:00Z',body:[
  '### FieldDeck human review decision',
  '- Decision: **ACCEPTED FOR IMPLEMENTATION REVIEW**',
  '- Reviewer: @MichaelWave369',
  '- Blueprint SHA-256: `'+fingerprint+'`',
  '- Execution authorized: **NO**',
  '- Implementation authorized: **NO**'
].join('\n')};
const digest=async b=>hash(b);

test('pending proposal is never ready for reviewer commands',async()=>{
  const x=await reconcileProposalEvidence(issue,[],digest);
  assert.equal(x.state,'AWAITING_VALIDATION');
  assert.equal(x.command_enabled,false);
  assert.equal(x.execution_authorized,false);
});
test('matching GitHub bot validation enables reviewer command, not execution',async()=>{
  const x=await reconcileProposalEvidence(issue,[validation],digest);
  assert.equal(x.state,'AWAITING_HUMAN_REVIEW');
  assert.equal(x.current_fingerprint,fingerprint);
  assert.equal(x.command_enabled,true);
  assert.equal(x.execution_authorized,false);
});
test('recorded reviewer decision remains non-executable',async()=>{
  const x=await reconcileProposalEvidence(issue,[validation,accepted],digest);
  assert.equal(x.state,'ACCEPTED_FOR_IMPLEMENTATION_REVIEW');
  assert.equal(x.decision.reviewer,'MichaelWave369');
  assert.equal(x.execution_authorized,false);
  assert.equal(x.decision_matches_current,true);
});
test('edited issue invalidates validation, even if stale bot decision exists',async()=>{
  const edited={...issue,body:proposalBody(createBlueprint(['script-smoke'],'Research Review'))};
  const x=await reconcileProposalEvidence(edited,[validation,accepted],digest);
  assert.equal(x.state,'STALE_VALIDATION');
  assert.equal(x.command_enabled,false);
});
test('changed decision fingerprint is marked stale, never silently current',async()=>{
  const fakeDecision={...accepted,body:accepted.body.replace(fingerprint,'f'.repeat(64))};
  const x=await reconcileProposalEvidence(issue,[validation,fakeDecision],digest);
  assert.equal(x.state,'STALE_DECISION');
  assert.equal(x.command_enabled,true);
});
test('bot identity required for both validation and review decision',async()=>{
  const forged={...accepted,user:{login:'attacker'}};
  assert.equal(parseDecisionEvidence([forged]),null);
  const forgedValidation={...validation,user:{login:'attacker'}};
  const x=await reconcileProposalEvidence(issue,[forgedValidation,forged],digest);
  assert.equal(x.state,'AWAITING_VALIDATION');
});
test('reject invalid proposal and closed issues',async()=>{
  const x=await reconcileProposalEvidence({...issue,body:'malformed'},[validation],digest);
  assert.equal(x.state,'INVALID_PROPOSAL');
  assert.equal(x.command_enabled,false);
  const y=await reconcileProposalEvidence({...issue,state:'closed'},[validation],digest);
  assert.equal(y.command_enabled,false);
});
test('invalid fingerprints and malformed comments fail closed',async()=>{
  await assert.rejects(reconcileProposalEvidence(issue,[validation],async()=> 'garbage'));
  assert.equal(parseDecisionEvidence([{...bot,body:accepted.body.replace('**NO**','**YES**')}]),null);
});
