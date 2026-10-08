import test from 'node:test';
import assert from 'node:assert/strict';
import { publicRunsApi, parsePublicRuns } from '../src/run-model.mjs';

const repo = 'MichaelWave369/FieldDeck';
test('links are constructed from fixed repo and numeric run IDs', () => {
  assert.match(publicRunsApi(repo), /api\.github\.com/);
  const runs = parsePublicRuns({ workflow_runs: [{
    id: 37711184172, event: 'issues', display_title: 'FD RUN: catalog-health',
    status: 'completed', conclusion: 'success', created_at: '2026-10-08T01:05:49Z',
    html_url: 'https://malicious.example/redirect'
  }]}, repo);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].url, 'https://github.com/MichaelWave369/FieldDeck/actions/runs/37711184172');
  assert.equal(runs[0].conclusion, 'success');
});

test('ignore arbitrary tasks, nonissue triggers and bad IDs', () => {
  const data = { workflow_runs: [
    { id: 1, event: 'issues', display_title: 'FD RUN: arbitrary', status: 'completed' },
    { id: 2, event: 'push', display_title: 'FD RUN: catalog-health', status: 'completed' },
    { id: '3', event: 'issues', display_title: 'FD RUN: catalog-health', status: 'completed' },
    { id: 4, event: 'issues', display_title: 'FD RUN: script-smoke', status: 'in_progress' }
  ]};
  const runs = parsePublicRuns(data, repo);
  assert.deepEqual(runs.map(x=>x.id), [4]);
  assert.equal(runs[0].conclusion, null);
});

test('fail closed on invalid inputs', () => {
  assert.throws(() => publicRunsApi('not a repo name'));
  assert.throws(() => parsePublicRuns({}, repo));
  assert.throws(() => parsePublicRuns({workflow_runs:[]}, 'evil/path/other'));
});
