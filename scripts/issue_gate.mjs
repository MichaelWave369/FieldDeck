/**
 * FieldDeck IssueOps gate.
 * Pure parsers allow negative controls to run in CI. All inputs from GitHub issues are untrusted.
 */
export const ALLOWED_TASKS = Object.freeze(['catalog-health', 'script-smoke', 'macro-demo', 'field-health-sweep']);
const PREFIX = 'FD RUN: ';

export function issueMarker(task) {
  if (!ALLOWED_TASKS.includes(task)) throw new Error('Task is not allowlisted');
  return '<!-- fielddeck:run:v0.2:' + task + ' -->';
}

export function parseIssueTask(title, body) {
  if (typeof title !== 'string' || typeof body !== 'string') return null;
  if (!title.startsWith(PREFIX)) return null;
  const task = title.slice(PREFIX.length);
  if (!ALLOWED_TASKS.includes(task)) return null;
  if (title !== PREFIX + task || !body.includes(issueMarker(task))) return null;
  return task;
}

export function eligiblePermission(permission) {
  return ['admin', 'maintain', 'write'].includes(permission);
}

export function issueRequestUrl(repository, task) {
  if (typeof repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('Invalid GitHub repository');
  }
  if (!ALLOWED_TASKS.includes(task)) throw new Error('Task is not allowlisted');
  const url = new URL('https://github.com/' + repository + '/issues/new');
  url.searchParams.set('title', PREFIX + task);
  url.searchParams.set('body',
    issueMarker(task) + '\n\n' +
    '## FieldDeck task request\n\n' +
    '**Action:** `' + task + '`\n\n' +
    (task === 'field-health-sweep' ? '**Reviewed steps:** Catalog Health → Script Smoke Test → Macro Sequence.\n\n' : '') +
    'Confirm creation of this issue to request an execution. ' +
    'The issue author needs WRITE or greater access to the repository. ' +
    'The workflow will run this exact allowlisted task and leave a receipt.\n\n' +
    '_Public issue content is not a command. Do not include secrets._\n'
  );
  return url.toString();
}
