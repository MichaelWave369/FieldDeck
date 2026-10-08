/**
 * IssueOps proposal transport. A proposal requests review only, never execution.
 * Shared by browser and the trusted GitHub validation workflow.
 */
import { createBlueprint, parseBlueprint } from './blueprint-model.mjs';

export const PROPOSAL_VERSION = 'v0.6';
export const PROPOSAL_PREFIX = 'FD PROPOSE: ';
export const MAX_PROPOSAL_BYTES = 8192;
const BODY_HEAD = [
  '<!-- fielddeck:proposal:v0.6 -->',
  '**Review request only. This issue cannot execute an automation.**',
  '',
  '~~~json'
].join('\n') + '\n';
const BODY_FOOT = '\n' + [
  '~~~',
  '',
  'A trusted validator will check this proposal. Human review and a separate code change',
  'would be required to approve a new executable capability.'
].join('\n') + '\n';

export function proposalBody(blueprint) {
  const parsed = parseBlueprint(JSON.stringify(blueprint));
  const canonical = createBlueprint(parsed.steps, parsed.name);
  return BODY_HEAD + JSON.stringify(canonical, null, 2) + BODY_FOOT;
}

export function parseProposalIssue(title, body) {
  if (typeof title !== 'string' || typeof body !== 'string' || new TextEncoder().encode(body).length > MAX_PROPOSAL_BYTES
    || !title.startsWith(PROPOSAL_PREFIX) || !body.startsWith(BODY_HEAD) || !body.endsWith(BODY_FOOT)) {
    return null;
  }
  const json = body.slice(BODY_HEAD.length, body.length - BODY_FOOT.length);
  try {
    const parsed = parseBlueprint(json);
    if (title !== PROPOSAL_PREFIX + parsed.name) return null;
    return {
      name: parsed.name,
      steps: parsed.steps,
      blueprint: createBlueprint(parsed.steps, parsed.name)
    };
  } catch {
    return null;
  }
}

export function proposalIssueUrl(repository, blueprint) {
  if (typeof repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('Invalid GitHub repository');
  }
  const parsed = parseBlueprint(JSON.stringify(blueprint));
  const url = new URL('https://github.com/' + repository + '/issues/new');
  url.searchParams.set('title', PROPOSAL_PREFIX + parsed.name);
  url.searchParams.set('body', proposalBody(blueprint));
  if (url.toString().length > 6000) throw new Error('Proposal is too large for a GitHub issue URL');
  return url.toString();
}
