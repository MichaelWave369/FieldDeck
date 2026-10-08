import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_TASKS, eligiblePermission, issueMarker,
  issueRequestUrl, parseIssueTask
} from '../scripts/issue_gate.mjs';

test('legitimate fixed tasks round-trip from GitHub issue URL', () => {
  for (const task of ALLOWED_TASKS) {
    const url = new URL(issueRequestUrl('MichaelWave369/FieldDeck', task));
    assert.equal(url.hostname, 'github.com');
    assert.equal(parseIssueTask(url.searchParams.get('title'), url.searchParams.get('body')), task);
    assert.ok(url.searchParams.get('body').includes(issueMarker(task)));
  }
});

test('reject spoofed tasks, mismatched markers, and malformed inputs', () => {
  const marker = issueMarker('catalog-health');
  for (const [title, body] of [
    ['FD RUN: rm -rf /', marker],
    ['FD RUN: catalog-health && echo unsafe', marker],
    ['FD RUN: catalog-health\n', marker],
    ['FD RUN: catalog-health', 'no marker'],
    ['FD RUN: catalog-health', issueMarker('script-smoke')],
    ['wrong prefix: catalog-health', marker],
    ['', marker],
    [undefined, marker],
    ['FD RUN: catalog-health', undefined],
  ]) {
    assert.equal(parseIssueTask(title, body), null);
  }
  assert.throws(() => issueRequestUrl('MichaelWave369/FieldDeck', 'invalid'));
  assert.throws(() => issueRequestUrl('invalid path', 'catalog-health'));
});

test('only write, maintain, and admin users may trigger execution', () => {
  for (const permission of ['write', 'maintain', 'admin']) assert.ok(eligiblePermission(permission));
  for (const permission of ['read', 'triage', 'none', 'unknown', null, 'WRITE']) {
    assert.equal(eligiblePermission(permission), false);
  }
});

test('no authority from mere catalog discovery', () => {
  assert.equal(parseIssueTask('catalog-health', issueMarker('catalog-health')), null);
});
