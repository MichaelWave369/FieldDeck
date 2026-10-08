import test from 'node:test';
import assert from 'node:assert/strict';
import { BLUEPRINT_TEMPLATES, createBlueprint, parseBlueprint, preflightChain, MAX_BLUEPRINT_BYTES } from '../src/blueprint-model.mjs';
import { APPROVED_CHAIN } from '../src/chain-model.mjs';

const actions = ['catalog-health', 'script-smoke', 'macro-demo'].map(id => ({
  id, kind: 'workflow', status: 'ready', task: id
}));

test('canonical blueprint round-trip preserves IDs without execution authority', () => {
  const data = createBlueprint(APPROVED_CHAIN.steps, 'Field Health Sweep');
  const imported = parseBlueprint(JSON.stringify(data));
  assert.deepEqual(imported.steps, APPROVED_CHAIN.steps);
  assert.equal(data.policy.execution, 'denied');
  assert.equal(data.steps[0].on_failure, 'stop');
  assert.equal(preflightChain(imported.steps, actions).status, 'REQUEST_ELIGIBLE');
  assert.equal(preflightChain(imported.steps, actions).execution_authorized, false);
});

test('custom order stays draft only, regardless of JSON metadata', () => {
  const custom = ['macro-demo', 'catalog-health'];
  assert.equal(preflightChain(custom, actions).status, 'DRAFT_VALID');
  assert.equal(preflightChain(custom, actions).approved_preset, false);
  assert.equal(preflightChain([], actions).status, 'BLOCKED');
});

test('fail closed on missing, disabled, or mismatched catalog actions', () => {
  assert.equal(preflightChain(APPROVED_CHAIN.steps, []).status, 'BLOCKED');
  assert.equal(preflightChain(APPROVED_CHAIN.steps, actions.map(a => ({...a, status:'locked'}))).status, 'BLOCKED');
  assert.equal(preflightChain(APPROVED_CHAIN.steps, actions.map(a => ({...a, task:'wrong'}))).status, 'BLOCKED');
  assert.equal(preflightChain(['hidden-command'], actions).status, 'BLOCKED');
});

test('reject injected fields, elevated policy, arbitrary code and malformed files', () => {
  const data = createBlueprint(['catalog-health']);
  const mutated = (change) => {
    const raw = structuredClone(data);
    change(raw);
    assert.throws(() => parseBlueprint(JSON.stringify(raw)));
  };
  mutated(d => { d.policy.execution = 'allowed'; });
  mutated(d => { d.policy.requires_authentication = false; });
  mutated(d => { d.steps[0].action_id = 'rm -rf /'; });
  mutated(d => { d.steps[0].on_failure = 'continue'; });
  mutated(d => { d.steps[0].timeout_seconds = 99999; });
  mutated(d => { d.eval = 'alert(1)'; });
  mutated(d => { d.steps[0].shell = 'echo hello'; });
  mutated(d => { d.schema_version = 'future'; });
  mutated(d => { d.steps = []; });
  mutated(d => { d.name = '<script>alert(1)</script>'; });
  assert.throws(() => parseBlueprint('{'));
  assert.throws(() => parseBlueprint('x'.repeat(MAX_BLUEPRINT_BYTES+1)));
  assert.throws(() => createBlueprint(['unknown']));
});

test('templates advertise exact canonical execution eligibility', () => {
  assert.equal(BLUEPRINT_TEMPLATES.length, 3);
  assert.equal(preflightChain(BLUEPRINT_TEMPLATES[0].steps, actions).status, 'REQUEST_ELIGIBLE');
  for (const template of BLUEPRINT_TEMPLATES.slice(1)) {
    assert.equal(preflightChain(template.steps, actions).status, 'DRAFT_VALID');
  }
});
