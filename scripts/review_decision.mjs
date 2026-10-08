#!/usr/bin/env node
/** Trusted review-decision receipt model. Gate calls GitHub permission API first.
 * Does not modify any executor allowlist, issue body, or runtime credentials.
 */
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseProposalIssue } from '../src/proposal-model.mjs';
import { eligiblePermission } from './issue_gate.mjs';

export const REVIEW_ACTION_RE = /^\/fielddeck review (accept|decline) ([a-f0-9]{64})$/;

export function evaluateReview(event, permission) {
  const issue = event?.issue;
  const comment = event?.comment;
  if (!issue || !comment || issue.pull_request
    || !Number.isSafeInteger(issue.number) || issue.number <= 0
    || issue.state !== 'open'
    || typeof comment.body !== 'string'
    || !eligiblePermission(permission)
    || !/^[A-Za-z0-9-]{1,39}$/.test(comment.user?.login || '')) return null;
  const match = REVIEW_ACTION_RE.exec(comment.body);
  if (!match) return null;
  const proposal = parseProposalIssue(issue.title, issue.body);
  if (!proposal) return null;
  const canonicalSha = createHash('sha256').update(JSON.stringify(proposal.blueprint)).digest('hex');
  if (match[2] !== canonicalSha || event?.validated_fingerprint !== canonicalSha) return null;
  return {
    schema_version: '0.7.0',
    kind: 'fielddeck.blueprint.human-review-decision',
    issue_number: issue.number,
    blueprint_name: proposal.name,
    canonical_sha256: canonicalSha,
    reviewer: comment.user.login,
    decision: match[1] === 'accept' ? 'ACCEPTED_FOR_IMPLEMENTATION_REVIEW' : 'DECLINED',
    execution_authorized: false,
    implementation_authorized: false,
    auto_promoted: false,
    is_execution_receipt: false,
    note: 'A reviewed proposal is NOT an approved executable. A separate reviewed code change is still required.'
  };
}
export function makeReviewReceipt(event, approvedPermission, runId) {
  const evaluated = evaluateReview(event, approvedPermission);
  if (!evaluated) throw new Error('Unauthorized or invalid review directive');
  return {
    ...evaluated,
    github_run_id: typeof runId === 'string' && /^\d+$/.test(runId) ? runId : null,
    recorded_at_utc: new Date().toISOString()
  };
}
function main() {
  const [eventPath, receiptPath] = process.argv.slice(2);
  if (!eventPath || !receiptPath) throw new Error('Usage: review_decision.mjs EVENT_FILE RECEIPT_FILE');
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  const receipt = makeReviewReceipt(event, process.env.FD_REVIEWER_PERMISSION, process.env.GITHUB_RUN_ID);
  mkdirSync(dirname(receiptPath), {recursive:true});
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({decision:receipt.decision, issue_number:receipt.issue_number, execution_authorized:false}));
}
if (process.argv[1]?.endsWith('/review_decision.mjs')) main();
