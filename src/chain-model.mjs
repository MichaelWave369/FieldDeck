// Public chain drafts are UI artifacts, not execution permissions.
export const APPROVED_CHAIN = Object.freeze({
  id: 'field-health-sweep',
  name: 'Field Health Sweep',
  steps: ['catalog-health', 'script-smoke', 'macro-demo']
});
export const STEPS = Object.freeze([
  { id: 'catalog-health', label: 'Catalog Health', detail: 'Verify registry and default-deny policy' },
  { id: 'script-smoke', label: 'Script Smoke Test', detail: 'Deterministic runtime signature' },
  { id: 'macro-demo', label: 'Macro Sequence', detail: 'Three-step mock macro receipt' }
]);
const IDS = new Set(STEPS.map(s => s.id));
export const MAX_STEPS = 6;

export function normalizeSteps(value) {
  if (!Array.isArray(value)) return [...APPROVED_CHAIN.steps];
  return value.filter(id => typeof id === 'string' && IDS.has(id)).slice(0, MAX_STEPS);
}
export function isApprovedChain(steps) {
  return Array.isArray(steps) && steps.length === APPROVED_CHAIN.steps.length
    && steps.every((id, i) => id === APPROVED_CHAIN.steps[i]);
}
export function addStep(steps, stepId) {
  const safe = normalizeSteps(steps);
  if (!IDS.has(stepId)) throw new Error('Step is not allowlisted');
  if (safe.length >= MAX_STEPS) throw new Error('Six-step draft limit reached');
  return [...safe, stepId];
}
export function moveStep(steps, index, direction) {
  const safe = normalizeSteps(steps);
  if (!Number.isInteger(index) || ![-1, 1].includes(direction)) return safe;
  const target = index + direction;
  if (index < 0 || target < 0 || index >= safe.length || target >= safe.length) return safe;
  [safe[index], safe[target]] = [safe[target], safe[index]];
  return safe;
}
export function removeStep(steps, index) {
  const safe = normalizeSteps(steps);
  return Number.isInteger(index) && index >= 0 && index < safe.length ? safe.filter((_, i) => i !== index) : safe;
}
export function exportDraft(steps) {
  const normalized = normalizeSteps(steps);
  return {
    schema_version: '0.4.0',
    kind: 'fielddeck.chain.draft',
    name: 'Local Chain Draft',
    steps: normalized.map((id, position) => ({ position: position + 1, action_id: id })),
    matches_approved_preset: isApprovedChain(normalized),
    execution_authorized: false,
    approval: 'A matching preset still requires an authenticated GitHub request.'
  };
}
