#!/usr/bin/env node
/**
 * Read the GitHub issue event as untrusted data. Never execute, eval or forward
 * imported blueprint fields into shell commands. Only write review evidence.
 */
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseProposalIssue } from '../src/proposal-model.mjs';

export function validateEvent(event, runId = null) {
  const issue = event?.issue || {};
  const proposal = parseProposalIssue(issue.title, issue.body);
  const issueNumber = Number.isSafeInteger(issue.number) && issue.number > 0 ? issue.number : null;
  const receipt = {
    schema_version: '0.6.0',
    kind: 'fielddeck.blueprint.review',
    is_execution_receipt: false,
    execution_authorized: false,
    workflow_execution_occurred: false,
    status: proposal && issueNumber ? 'VALID_FOR_REVIEW' : 'REJECTED',
    reviewer_decision: 'NOT_REVIEWED',
    issue_number: issueNumber,
    github_run_id: typeof runId === 'string' && /^\d+$/.test(runId) ? runId : null
  };
  if (proposal && issueNumber) {
    receipt.blueprint_name = proposal.name;
    receipt.step_ids = proposal.steps;
    receipt.steps_count = proposal.steps.length;
    receipt.canonical_sha256 = createHash('sha256').update(JSON.stringify(proposal.blueprint)).digest('hex');
    receipt.note = 'Schema valid. No human approval or execution authority is granted.';
  } else {
    receipt.reason = 'INVALID_OR_UNSUPPORTED_PROPOSAL';
    receipt.note = 'Rejected review submission. No code or workflow tasks were executed.';
  }
  return receipt;
}

function main() {
  const eventFile = process.argv[2];
  const targetFile = process.argv[3];
  if (!eventFile || !targetFile) throw new Error('Usage: node proposal_receipt.mjs EVENT_FILE RECEIPT_FILE');
  const event = JSON.parse(readFileSync(eventFile, 'utf8'));
  const receipt = validateEvent(event, process.env.GITHUB_RUN_ID || null);
  mkdirSync(dirname(targetFile), { recursive: true });
  writeFileSync(targetFile, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    status: receipt.status,
    issue_number: receipt.issue_number,
    execution_authorized: false,
    canonical_sha256: receipt.canonical_sha256 || null
  }));
}

if (process.argv[1] && process.argv[1].endsWith('proposal_receipt.mjs')) main();
