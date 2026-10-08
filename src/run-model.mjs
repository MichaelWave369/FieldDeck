/**
 * Read-only GitHub Actions status projection for public repositories.
 * Never treat these records as local execution receipts or permissions.
 */
const FIXED_TASKS = new Set(['catalog-health', 'script-smoke', 'macro-demo', 'field-health-sweep']);

export function publicRunsApi(repo) {
  if (typeof repo !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error('Invalid repository');
  return 'https://api.github.com/repos/' + repo + '/actions/workflows/issueops.yml/runs?per_page=12';
}

export function parsePublicRuns(data, repo) {
  if (typeof repo !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error('Invalid repository');
  if (!data || !Array.isArray(data.workflow_runs)) throw new Error('Unexpected GitHub API response');
  return data.workflow_runs
    .filter(r => r && Number.isSafeInteger(r.id) && r.id > 0 && r.event === 'issues' && typeof r.display_title === 'string')
    .map(r => {
      const task = r.display_title.startsWith('FD RUN: ') ? r.display_title.slice('FD RUN: '.length) : null;
      if (!FIXED_TASKS.has(task)) return null;
      const status = ['queued', 'in_progress', 'completed', 'waiting', 'pending'].includes(r.status) ? r.status : 'unknown';
      const conclusion = ['success', 'failure', 'cancelled', 'timed_out', 'skipped', 'neutral'].includes(r.conclusion) ? r.conclusion : null;
      return {
        id: r.id,
        task,
        status,
        conclusion,
        createdAt: typeof r.created_at === 'string' ? r.created_at : null,
        url: 'https://github.com/' + repo + '/actions/runs/' + r.id
      };
    }).filter(Boolean).slice(0, 10);
}
