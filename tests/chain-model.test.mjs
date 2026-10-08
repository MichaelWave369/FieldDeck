import test from 'node:test';
import assert from 'node:assert/strict';
import { APPROVED_CHAIN, STEPS, MAX_STEPS, normalizeSteps, isApprovedChain, addStep, moveStep, removeStep, exportDraft } from '../src/chain-model.mjs';

test('canonical approved chain is exact and order-sensitive', () => {
  assert.equal(isApprovedChain(APPROVED_CHAIN.steps), true);
  assert.equal(isApprovedChain([...APPROVED_CHAIN.steps].reverse()), false);
  assert.equal(isApprovedChain([...APPROVED_CHAIN.steps, 'catalog-health']), false);
  assert.equal(isApprovedChain(APPROVED_CHAIN.steps.slice(0, 2)), false);
});
test('draft manipulation cannot create unexpected capabilities', () => {
  assert.throws(() => addStep([], 'rm -rf /'));
  assert.throws(() => addStep([], '__proto__'));
  const moved = moveStep(APPROVED_CHAIN.steps, 0, 1);
  assert.deepEqual(moved, ['script-smoke', 'catalog-health', 'macro-demo']);
  assert.deepEqual(removeStep(moved, 1), ['script-smoke', 'macro-demo']);
  assert.deepEqual(APPROVED_CHAIN.steps, ['catalog-health', 'script-smoke', 'macro-demo']);
});
test('storage normalization is bounded and drops unknown actions', () => {
  assert.deepEqual(normalizeSteps(null), APPROVED_CHAIN.steps);
  assert.deepEqual(normalizeSteps(['arbitrary', ...Array(20).fill('macro-demo')]), Array(MAX_STEPS).fill('macro-demo'));
  assert.deepEqual(normalizeSteps({}), APPROVED_CHAIN.steps);
  assert.deepEqual(STEPS.map(s => s.id), APPROVED_CHAIN.steps);
});
test('exports are explicitly non-authoritative, even for a matching preset', () => {
  const preset = exportDraft(APPROVED_CHAIN.steps);
  assert.equal(preset.matches_approved_preset, true);
  assert.equal(preset.execution_authorized, false);
  const custom = exportDraft(['macro-demo']);
  assert.equal(custom.matches_approved_preset, false);
  assert.equal(custom.execution_authorized, false);
  assert.deepEqual(custom.steps, [{ position: 1, action_id: 'macro-demo' }]);
});
