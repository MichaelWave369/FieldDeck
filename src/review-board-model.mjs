/**
 * Read-only public GitHub proposal discovery. Never translates proposal metadata
 * into executable capability or an authoritative review decision.
 */
export function proposalInboxUrl(repo) {
  if (typeof repo !== 'string' || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)) throw new Error('Invalid GitHub repository');
  return 'https://api.github.com/repos/' + repo + '/issues?state=all&sort=created&direction=desc&per_page=100';
}
export function proposalCommentsUrl(repo, issueNumber) {
  if (typeof repo !== 'string' || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)
    || !Number.isSafeInteger(issueNumber) || issueNumber <= 0) throw new Error('Invalid proposal locator');
  return 'https://api.github.com/repos/' + repo + '/issues/' + issueNumber + '/comments?per_page=100';
}
export function parseProposalInbox(data, repo) {
  proposalInboxUrl(repo);
  if (!Array.isArray(data)) throw new Error('Unexpected GitHub issues response');
  return data.filter(issue => issue
    && !issue.pull_request
    && Number.isSafeInteger(issue.number)
    && issue.number > 0
    && typeof issue.title === 'string'
    && /^FD PROPOSE: [a-zA-Z0-9 _.-]{1,64}$/.test(issue.title))
    .slice(0, 16)
    .map(issue => ({
      number: issue.number,
      name: issue.title.slice('FD PROPOSE: '.length),
      state: issue.state === 'closed' ? 'closed' : 'open',
      updatedAt: typeof issue.updated_at === 'string' ? issue.updated_at : null,
      url: 'https://github.com/' + repo + '/issues/' + issue.number
    }));
}
export function parseValidationEvidence(comments) {
  if (!Array.isArray(comments)) throw new Error('Unexpected GitHub issue comments response');
  // GitHub authenticates the comment author. Do not trust copied text from anyone else.
  for (const c of [...comments].reverse()) {
    if (c?.user?.login !== 'github-actions[bot]' || typeof c.body !== 'string') continue;
    if (!c.body.includes('### FieldDeck blueprint validation')
      || !c.body.includes('- Result: **VALID FOR HUMAN REVIEW**')
      || !c.body.includes('- Execution authorized: **NO**')) continue;
    const m = c.body.match(/- Blueprint fingerprint \(SHA-256\): `([a-f0-9]{64})`/);
    if (m) return { fingerprint: m[1], validation_only: true };
  }
  return null;
}
export function reviewCommand(decision, fingerprint) {
  if (!['accept','decline'].includes(decision) || typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw new Error('Invalid review decision or blueprint fingerprint');
  }
  return '/fielddeck review ' + decision + ' ' + fingerprint;
}
