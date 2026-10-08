import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { proposalBody } from '../src/proposal-model.mjs';
import { createBlueprint } from '../src/blueprint-model.mjs';
import { parseProposalInbox, proposalInboxUrl, proposalCommentsUrl, parseValidationEvidence, reviewCommand } from '../src/review-board-model.mjs';
import { evaluateReview, makeReviewReceipt } from '../scripts/review_decision.mjs';

const repo='MichaelWave369/FieldDeck';
const blueprint=createBlueprint(['catalog-health', 'script-smoke'],'Research Review');
const fp=createHash('sha256').update(JSON.stringify(blueprint)).digest('hex');
const event={issue:{number:8,title:'FD PROPOSE: Research Review',body:proposalBody(blueprint)},comment:{body:reviewCommand('accept',fp),user:{login:'reviewer-1'}}};

test('inbox ignores pull requests and constructs trusted links',()=>{
  assert.match(proposalInboxUrl(repo),/api\.github\.com/);
  const list=parseProposalInbox([
    {number:8,title:'FD PROPOSE: Research Review',state:'open',html_url:'https://evil.test'},
    {number:9,title:'FD PROPOSE: Nonissue',pull_request:{url:'x'}},
    {number:10,title:'FD RUN: catalog-health'},
    {number:11,title:'FD PROPOSE: Closed Lab',state:'closed'}
  ],repo);
  assert.equal(list.length,2);
  assert.equal(list[0].url,'https://github.com/MichaelWave369/FieldDeck/issues/8');
  assert.equal(list[1].state,'closed');
  assert.match(proposalCommentsUrl(repo,8),/\/issues\/8\/comments/);
  assert.throws(()=>proposalCommentsUrl(repo,'../../evil'));
  assert.throws(()=>proposalInboxUrl('evil/../../third'));
});

test('only authentic validator bot comments provide fingerprints',()=>{
  const body='### FieldDeck blueprint validation\n- Result: **VALID FOR HUMAN REVIEW**\n- Execution authorized: **NO**\n- Blueprint fingerprint (SHA-256): `'+fp+'`';
  assert.equal(parseValidationEvidence([{user:{login:'attacker'},body}]),null);
  assert.equal(parseValidationEvidence([{user:{login:'github-actions[bot]'},body}]).fingerprint,fp);
  assert.equal(parseValidationEvidence([{user:{login:'github-actions[bot]'},body:'VALID'}]),null);
  assert.throws(()=>reviewCommand('execute',fp));
  assert.throws(()=>reviewCommand('accept','123'));
});

test('only repo writers can record exact fingerprint decisions, no execution',()=>{
  assert.equal(evaluateReview(event,'read'),null);
  assert.equal(evaluateReview(event,'triage'),null);
  assert.equal(evaluateReview(event,'write')?.decision,'ACCEPTED_FOR_IMPLEMENTATION_REVIEW');
  const receipt=makeReviewReceipt(event,'admin','1234');
  assert.equal(receipt.execution_authorized,false);
  assert.equal(receipt.implementation_authorized,false);
  assert.equal(receipt.auto_promoted,false);
  assert.equal(receipt.is_execution_receipt,false);
  assert.equal(receipt.github_run_id,'1234');
  const decline={...event,comment:{...event.comment,body:reviewCommand('decline',fp)}};
  assert.equal(evaluateReview(decline,'maintain')?.decision,'DECLINED');
});
test('reject spoofed commands, wrong fingerprint, mutations, PR comments and malformed proposal',()=>{
  const cases=[
    {...event,comment:{...event.comment,body:'/fielddeck review accept '+ '0'.repeat(64)}},
    {...event,comment:{...event.comment,body:event.comment.body+'\nrun now'}},
    {...event,comment:{...event.comment,body:'/fielddeck review execute '+fp}},
    {...event,comment:{...event.comment,user:{login:'bad actor'}}},
    {...event,issue:{...event.issue,pull_request:{}}},
    {...event,issue:{...event.issue,body:event.issue.body.replace('catalog-health','shell')}},
    {...event,issue:{...event.issue,title:'FD RUN: catalog-health'}},
  ];
  for(const e of cases)assert.equal(evaluateReview(e,'write'),null);
  assert.throws(()=>makeReviewReceipt(event,'read','123'));
});
