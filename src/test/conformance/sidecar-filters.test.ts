// Sidecar filter conformance tests (PR-12 / E2 + E3).
//
// Live OAuth + webhook flows are unverified in this session; the filter
// logic IS testable in isolation and is what determines what reaches L0.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterSlackMessage,
  slackOperationId,
  type SlackMessage,
} from '../../services/sidecars/slack.js';
import {
  filterGithubEvent,
  githubOperationId,
  type GithubEvent,
} from '../../services/sidecars/github.js';
import { deterministicOperationId } from '../../services/sidecar-framework.js';

function slackMsg(overrides: Partial<SlackMessage> = {}): SlackMessage {
  return {
    ts: '1700000000.000100',
    channel_id: 'C123',
    channel_name: 'general',
    user: 'U1',
    user_display_name: 'alice',
    text: 'A reasonably substantive message about the auth refactor decision.',
    ...overrides,
  };
}

test('E2: Slack signal_only filters short bodies', () => {
  const result = filterSlackMessage(slackMsg({ text: 'lgtm' }));
  assert.equal(result.decision, 'skip');
});

test('E2: Slack signal_only keeps substantive messages with tags', () => {
  const result = filterSlackMessage(slackMsg({ text: 'A thoughtful note about the upcoming auth refactor proposal.' }));
  assert.equal(result.decision, 'keep');
});

test('E2: Slack always-observe overrides for pinned messages', () => {
  const result = filterSlackMessage(slackMsg({ text: 'k', is_pinned: true }));
  assert.equal(result.decision, 'keep');
  if (result.decision === 'keep') assert.ok(result.tags?.includes('slack-pinned'));
});

test('E2: Slack always-observe overrides for high-reaction messages', () => {
  const result = filterSlackMessage(slackMsg({ text: 'k', reactions: [{ name: 'fire', count: 5 }] }));
  assert.equal(result.decision, 'keep');
  if (result.decision === 'keep') assert.ok(result.tags?.includes('slack-high-reaction'));
});

test('E2: Slack filters out known bots', () => {
  const result = filterSlackMessage(slackMsg({ user_display_name: 'slackbot', is_bot: true, text: 'A reasonably long message that would otherwise pass min_body_length.' }));
  assert.equal(result.decision, 'skip');
});

test('E2: slackOperationId is deterministic on (channel_id, ts)', () => {
  const msg = slackMsg();
  const id1 = slackOperationId(msg);
  const id2 = slackOperationId(slackMsg({ text: 'completely different text but same ts' }));
  assert.equal(id1, id2, 'op_id should depend only on channel_id+ts, not body');
  assert.match(id1, /^op_[0-9A-HJKMNP-TV-Z]{26}$/);
});

function ghEvent(overrides: Partial<GithubEvent> = {}): GithubEvent {
  return {
    type: 'comment',
    repo: 'acme/platform',
    number: 42,
    author: 'Alice Smith',
    author_login: 'alice',
    body: 'A reasonably substantive comment about the architectural choice in this PR.',
    ...overrides,
  };
}

test('E3: GitHub filters short comments', () => {
  const result = filterGithubEvent(ghEvent({ body: '+1' }));
  assert.equal(result.decision, 'skip');
});

test('E3: GitHub filters bot authors', () => {
  const result = filterGithubEvent(
    ghEvent({ author_login: 'dependabot', is_bot: true, body: 'Bumps lodash from 4.17.20 to 4.17.21 — automatic security patch.' }),
  );
  assert.equal(result.decision, 'skip');
});

test('E3: GitHub always-observes approval reviews', () => {
  const result = filterGithubEvent(ghEvent({ type: 'pr_review', state: 'approved', body: 'ok' }));
  assert.equal(result.decision, 'keep');
});

test('E3: GitHub tags decision-labeled PRs', () => {
  const result = filterGithubEvent(ghEvent({ type: 'pull_request', labels: ['decision'], body: 'Architectural choice: migrate from JWT to session tokens.' }));
  assert.equal(result.decision, 'keep');
  if (result.decision === 'keep') assert.ok(result.tags?.includes('gh-decision'));
});

test('E3: githubOperationId is deterministic on event identity', () => {
  const e = ghEvent({ type: 'pull_request', number: 42 });
  const id1 = githubOperationId(e);
  const id2 = githubOperationId(ghEvent({ type: 'pull_request', number: 42, body: 'unrelated change to body' }));
  assert.equal(id1, id2);
});

test('E1: deterministicOperationId matches spec op_id pattern', () => {
  const id = deterministicOperationId('sidecar:slack', 'C123.1700000000.000100');
  assert.match(id, /^op_[0-9A-HJKMNP-TV-Z]{26}$/);
});
