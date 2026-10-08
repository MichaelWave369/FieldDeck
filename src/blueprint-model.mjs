/**
 * FieldDeck blueprint format. Pure, deterministic validation. No code or network execution.
 * A blueprint is an untrusted local proposal, regardless of its embedded metadata.
 */
import { APPROVED_CHAIN, MAX_STEPS, STEPS, isApprovedChain } from './chain-model.mjs';

export const BLUEPRINT_VERSION = '0.5.0';
export const MAX_BLUEPRINT_BYTES = 16384;
const IDs = new Set(STEPS.map(step => step.id));

export const BLUEPRINT_TEMPLATES = Object.freeze([
  { id: 'approved-health-sweep', label: 'Field Health Sweep', description: 'Reviewed three-step chain', steps: [...APPROVED_CHAIN.steps] },
  { id: 'quick-diagnostics', label: 'Quick Diagnostics', description: 'Two-step draft, not executable', steps: ['catalog-health', 'script-smoke'] },
  { id: 'macro-bench', label: 'Macro Bench', description: 'Test macro evidence twice, draft only', steps: ['macro-demo', 'script-smoke', 'macro-demo'] }
]);

const exactKeys = (obj, keys) =>
  obj && typeof obj === 'object' && !Array.isArray(obj)
  && Object.keys(obj).length === keys.length
  && keys.every(key => Object.prototype.hasOwnProperty.call(obj, key));

export function createBlueprint(steps, name = 'Local Chain Draft') {
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > MAX_STEPS || steps.some(id => !IDs.has(id))) {
    throw new Error('Blueprint must contain 1–6 allowlisted action IDs');
  }
  if (typeof name !== 'string' || !/^[a-zA-Z0-9 _.-]{1,64}$/.test(name) || name.trim() !== name) {
    throw new Error('Blueprint name must be 1–64 simple characters');
  }
  return {
    schema_version: BLUEPRINT_VERSION,
    kind: 'fielddeck.chain.blueprint',
    name,
    steps: steps.map(action_id => ({
      action_id,
      timeout_seconds: 30,
      on_failure: 'stop'
    })),
    policy: {
      execution: 'denied',
      requires_authentication: true,
      requires_review: true
    }
  };
}

export function parseBlueprint(input) {
  if (typeof input !== 'string' || input.length > MAX_BLUEPRINT_BYTES || input.length === 0) {
    throw new Error('Blueprint file must be JSON and under 16 KB');
  }
  let raw;
  try { raw = JSON.parse(input); } catch { throw new Error('Blueprint is not valid JSON'); }
  if (!exactKeys(raw, ['schema_version', 'kind', 'name', 'steps', 'policy'])
    || raw.schema_version !== BLUEPRINT_VERSION || raw.kind !== 'fielddeck.chain.blueprint') {
    throw new Error('Invalid blueprint schema or version');
  }
  if (!exactKeys(raw.policy, ['execution', 'requires_authentication', 'requires_review'])
    || raw.policy.execution !== 'denied'
    || raw.policy.requires_authentication !== true
    || raw.policy.requires_review !== true) {
    throw new Error('Imported blueprint must retain default-deny governance');
  }
  if (!Array.isArray(raw.steps) || raw.steps.length < 1 || raw.steps.length > MAX_STEPS) {
    throw new Error('Blueprint must have 1–6 steps');
  }
  const steps = [];
  for (const entry of raw.steps) {
    if (!exactKeys(entry, ['action_id', 'timeout_seconds', 'on_failure'])
      || !IDs.has(entry.action_id)
      || !Number.isInteger(entry.timeout_seconds)
      || entry.timeout_seconds < 1 || entry.timeout_seconds > 120
      || entry.on_failure !== 'stop') {
      throw new Error('Invalid step: only allowlisted actions, 1–120s timeouts and stop-on-failure allowed');
    }
    steps.push(entry.action_id);
  }
  // Discard all untrusted authority claims. Rebuild from validated primitives.
  const validated = createBlueprint(steps, raw.name);
  return { name: validated.name, steps, imported: true };
}

export function preflightChain(steps, catalogActions = []) {
  const structurallyValid = Array.isArray(steps)
    && steps.length > 0 && steps.length <= MAX_STEPS
    && steps.every(id => IDs.has(id));
  const actions = new Map(
    Array.isArray(catalogActions)
      ? catalogActions.filter(a => a && typeof a.id === 'string').map(a => [a.id, a])
      : []
  );
  const checks = structurallyValid ? steps.map((id, i) => {
    const catalog = actions.get(id);
    const accepted = catalog?.kind === 'workflow' && catalog.status === 'ready' && catalog.task === id;
    return {
      index: i + 1,
      action_id: id,
      check: accepted ? 'CATALOG_READY' : 'CATALOG_MISSING_OR_DISABLED',
      would_run: false
    };
  }) : [];
  const catalogReady = structurallyValid && checks.every(c => c.check === 'CATALOG_READY');
  const approvedPreset = structurallyValid && isApprovedChain(steps);
  return {
    schema_version: BLUEPRINT_VERSION,
    kind: 'fielddeck.chain.preflight',
    is_execution_receipt: false,
    status: !structurallyValid || !catalogReady ? 'BLOCKED' : approvedPreset ? 'REQUEST_ELIGIBLE' : 'DRAFT_VALID',
    execution_authorized: false,
    requires_authenticated_github_submission: true,
    structurally_valid: structurallyValid,
    catalog_ready: catalogReady,
    approved_preset: approvedPreset,
    steps: checks
  };
}
