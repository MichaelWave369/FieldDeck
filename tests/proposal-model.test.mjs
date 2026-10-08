import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlueprint } from '../src/blueprint-model.mjs';
import { proposalIssueUrl, proposalBody, parseProposalIssue, PROPOSAL_PREFIX } from '../src/proposal-model.mjs';
import { validateEvent } from '../scripts/proposal_receipt.mjs';

const repo = 'MichaelWave369/FieldDeck';
test('browser proposal roundtrips through untrusted issue parser', () => {
  const blueprint = createBlueprint(['catalog-health', 'macro-demo'], 'Research Review');
  const url = new URL(proposalIssueUrl(repo, blueprint));
  const title = url.searchParams.get('title');
  const body = url.searchParams.get('body');
  assert.equal(title, 'FD PROPOSE: Research Review');
  assert.deepEqual(parseProposalIssue(title, body)?.steps, ['catalog-health', 'macro-demo']);
  assert.equal(url.hostname, 'github.com');
  assert.ok(url.toString().length < 6000);
});
test('trusted CI review receipt cannot authorize or execute', () => {
  const blueprint = createBlueprint(['script-smoke'], 'Proposed Test');
  const event = {issue:{number:7,title:PROPOSAL_PREFIX+'Proposed Test',body:proposalBody(blueprint)}};
  const first=validateEvent(event,'1234');
  const second=validateEvent(event,'1234');
  assert.equal(first.status,'VALID_FOR_REVIEW');
  assert.equal(first.is_execution_receipt,false);
  assert.equal(first.execution_authorized,false);
  assert.equal(first.workflow_execution_occurred,false);
  assert.equal(first.reviewer_decision,'NOT_REVIEWED');
  assert.match(first.canonical_sha256, /^[a-f0-9]{64}$/);
  assert.equal(first.canonical_sha256,second.canonical_sha256);
  assert.deepEqual(first.step_ids,['script-smoke']);
});
test('malformed, unknown, and privilege-injected proposals are rejected', () => {
  const b=createBlueprint(['catalog-health']);
  const body=proposalBody(b);
  const cases=[
    [PROPOSAL_PREFIX+'Different Name',body],
    [PROPOSAL_PREFIX+b.name,body.replace('"denied"','"allowed"')],
    [PROPOSAL_PREFIX+b.name,body.replace('catalog-health','arbitrary-shell')],
    [PROPOSAL_PREFIX+b.name,body+'some extra text'],
    [PROPOSAL_PREFIX+b.name,'not a blueprint'],
    ['FD RUN: catalog-health',body],
    [PROPOSAL_PREFIX+b.name,body+'x'.repeat(10000)],
    [PROPOSAL_PREFIX+b.name,body.replace('"steps"', '"eval": "cmd", "steps"')],
  ];
  for(const [title,text] of cases){
    assert.equal(parseProposalIssue(title,text),null);
    const receipt=validateEvent({issue:{number:7,title,body:text}});
    assert.equal(receipt.status,'REJECTED');
    assert.equal(receipt.execution_authorized,false);
    assert.equal(receipt.canonical_sha256,undefined);
  }
  assert.throws(()=>proposalIssueUrl('evil/../../repo',b));
});
test('no source body can claim authority', () => {
  const blueprint=createBlueprint(['macro-demo']);
  blueprint.policy.execution='allowed';
  assert.throws(()=>proposalBody(blueprint));
  assert.equal(validateEvent({issue:{number:9,title:'FD PROPOSE: test',body:'irrelevant'}}).status,'REJECTED');
});
