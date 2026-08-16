import assert from 'node:assert/strict';
import test from 'node:test';

import {
  emailConversationMessage,
  emailMessageSourceUrl,
  groupEmailThreads,
  prioritizeEmailThreads,
  type EmailMessage,
} from '../services/email-source.js';
import { canonicalGmailMessage } from '../services/gmail-email-source.js';
import { parseICloudMessage } from '../services/icloud-email-source.js';
import type { GmailMessage } from '../services/google-api.js';

function message(overrides: Partial<EmailMessage> & Pick<EmailMessage, 'id' | 'thread_id' | 'occurred_at'>): EmailMessage {
  return {
    provider: 'gmail',
    account_id: 'owner@example.com',
    subject: 'Project decision',
    from: { address: 'colleague@example.com', name: 'Colleague' },
    to: [{ address: 'owner@example.com' }],
    cc: [],
    body: 'What should we ship?',
    mailbox: 'Inbox',
    labels: ['INBOX'],
    headers: {},
    authored_by_owner: false,
    references: [],
    ...overrides,
  };
}

test('Gmail source URLs use the signed-in default account when no user email is configured', () => {
  const sourceUrl = emailMessageSourceUrl(message({
    id: 'gmail-message-1',
    thread_id: 'gmail:google-account:19fd06c93939da01',
    account_id: 'google-account',
    occurred_at: '2026-08-05T00:00:00.000Z',
  }));

  assert.equal(
    sourceUrl,
    'https://mail.google.com/mail/u/0/#all/19fd06c93939da01',
  );
});

test('email threads prioritise conversations the owner replied to', () => {
  const messages = [
    message({ id: 'new-unanswered', thread_id: 'unanswered', occurred_at: '2026-07-20T04:00:00.000Z' }),
    message({ id: 'question', thread_id: 'replied', occurred_at: '2026-07-19T01:00:00.000Z' }),
    message({
      id: 'answer',
      thread_id: 'replied',
      occurred_at: '2026-07-19T02:00:00.000Z',
      from: { address: 'owner@example.com', name: 'Owner' },
      to: [{ address: 'colleague@example.com' }],
      body: 'Ship the smaller release on Tuesday.',
      mailbox: 'Sent',
      labels: ['SENT'],
      authored_by_owner: true,
    }),
  ];

  const threads = groupEmailThreads(messages);
  assert.equal(threads.find(thread => thread.id === 'replied')?.owner_replied, true);
  assert.deepEqual(prioritizeEmailThreads(threads, 3).map(item => item.id), [
    'question',
    'answer',
    'new-unanswered',
  ]);

  const envelope = emailConversationMessage(messages[2]!, 'person:owner');
  assert.equal(envelope.actor_id, 'person:owner');
  assert.equal(envelope.authored_by_owner, true);
  assert.equal(envelope.direction, 'outbound');
  assert.equal(envelope.subject, 'Project decision');
});

test('Gmail SENT messages become owner-authored canonical email', () => {
  const raw: GmailMessage = {
    id: 'gmail-message-1',
    threadId: 'gmail-thread-1',
    labelIds: ['SENT'],
    snippet: 'We will use the revised plan.',
    internalDate: String(Date.parse('2026-07-20T03:00:00.000Z')),
    payload: {
      mimeType: 'text/plain',
      headers: [
        { name: 'Subject', value: 'Re: Revised plan' },
        { name: 'From', value: 'Owner <owner@example.com>' },
        { name: 'To', value: 'Teammate <team@example.com>' },
        { name: 'Message-ID', value: '<reply@example.com>' },
        { name: 'In-Reply-To', value: '<question@example.com>' },
      ],
      body: { data: Buffer.from('We will use the revised plan.').toString('base64url') },
    },
  };

  const canonical = canonicalGmailMessage(raw, 'owner@example.com');
  assert.equal(canonical.thread_id, 'gmail:owner@example.com:gmail-thread-1');
  assert.equal(canonical.authored_by_owner, true);
  assert.equal(canonical.mailbox, 'Sent');
  assert.equal(canonical.in_reply_to, '<question@example.com>');
});

test('iCloud Inbox and Sent messages share a thread through RFC references', async () => {
  const original = await parseICloudMessage({
    source: Buffer.from([
      'From: Teammate <team@example.com>',
      'To: Owner <owner@icloud.com>',
      'Subject: Release date',
      'Message-ID: <question@example.com>',
      'Date: Sun, 19 Jul 2026 10:00:00 +0000',
      '',
      'When should we release?',
    ].join('\r\n')),
    uid: 11,
    uidValidity: 7n,
    mailbox: 'INBOX',
    isSent: false,
    accountId: 'owner@icloud.com',
    ownerAddresses: new Set(['owner@icloud.com']),
  });
  const reply = await parseICloudMessage({
    source: Buffer.from([
      'From: Owner <owner@icloud.com>',
      'To: Teammate <team@example.com>',
      'Subject: Re: Release date',
      'Message-ID: <reply@example.com>',
      'In-Reply-To: <question@example.com>',
      'References: <question@example.com>',
      'Date: Sun, 19 Jul 2026 11:00:00 +0000',
      '',
      'Release Tuesday after the final check.',
    ].join('\r\n')),
    uid: 4,
    uidValidity: 9n,
    mailbox: 'Sent Messages',
    isSent: true,
    accountId: 'owner@icloud.com',
    ownerAddresses: new Set(['owner@icloud.com']),
  });

  assert.equal(reply.thread_id, original.thread_id);
  assert.equal(reply.authored_by_owner, true);
  assert.equal(reply.body, 'Release Tuesday after the final check.');
});
