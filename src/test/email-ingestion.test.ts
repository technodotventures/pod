import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeDb, getDb, getObject, listEvents } from '../pod/db.js';
import { ensureAppDataSpace } from '../pod/data-spaces.js';
import { readConversationProjection } from '../services/conversation-memory.js';
import { syncEmailSource } from '../services/email-ingestion.js';
import type { EmailSource } from '../services/email-source.js';
import { closeSmartwareCore, getSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'email-ingestion-test',
    podName: 'Email Ingestion Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
    userEmail: 'owner@example.com',
  };
}

test('email ingestion turns the owner reply into reusable thread resolution memory', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-email-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);
  let requestedAfter: Date | null = null;
  const source: EmailSource = {
    provider: 'gmail',
    integration_id: 'gmail',
    account_id: 'owner@example.com',
    display_name: 'Google',
    async fetchRecent(options) {
      requestedAfter = options.after;
      return [
        {
          id: 'question-1',
          thread_id: 'gmail:owner@example.com:thread-1',
          provider: 'gmail',
          account_id: 'owner@example.com',
          subject: 'Launch timing',
          from: { address: 'teammate@example.com', name: 'Teammate' },
          to: [{ address: 'owner@example.com' }],
          cc: [],
          occurred_at: '2026-07-19T10:00:00.000Z',
          body: 'When should we launch the smaller release?',
          mailbox: 'Inbox',
          labels: ['INBOX'],
          headers: {},
          authored_by_owner: false,
          message_id: 'question@example.com',
          references: [],
        },
        {
          id: 'reply-1',
          thread_id: 'gmail:owner@example.com:thread-1',
          provider: 'gmail',
          account_id: 'owner@example.com',
          subject: 'Re: Launch timing',
          from: { address: 'owner@example.com', name: 'Owner' },
          to: [{ address: 'teammate@example.com' }],
          cc: [],
          occurred_at: '2026-07-19T11:00:00.000Z',
          body: 'Launch the smaller release Tuesday after the final check.',
          mailbox: 'Sent',
          labels: ['SENT'],
          headers: {},
          authored_by_owner: true,
          message_id: 'reply@example.com',
          in_reply_to: 'question@example.com',
          references: ['question@example.com'],
        },
      ];
    },
  };

  try {
    const report = await syncEmailSource(env, app.log, source, {
      filters: { include_inbox: true, include_sent: true, max_age_days: 30 },
      last_sync_at: new Date(Date.now() - 60 * 60 * 1_000).toISOString(),
    });
    assert.equal(report.count, 2);
    assert.equal(report.owner_reply_threads, 1);
    assert.equal(report.classification.high >= 1, true);
    assert.ok(requestedAfter);
    assert.ok((requestedAfter as Date).getTime() > Date.now() - 70 * 60 * 1_000, 'subsequent sync uses a bounded overlap');

    const core = await getSmartwareCore(env);
    const space = ensureAppDataSpace(core, env, 'gmail');
    const projection = await readConversationProjection(env, space.scope);
    assert.equal(projection.conversations.length, 1);
    assert.equal(projection.conversations[0]!.title, 'Email · Launch timing');
    assert.equal(projection.conversations[0]!.question, 'When should we launch the smaller release?');
    assert.equal(projection.conversations[0]!.resolution, 'Launch the smaller release Tuesday after the final check.');
    assert.equal(projection.conversations[0]!.resolution_actor_id, core.createPodProfile(env.podId, env.podName).owner_id);

    const storedReply = getObject(getDb(env), 'gmail:c8cd3c642730:reply-1');
    assert.ok(storedReply);
    assert.equal(storedReply.metadata?.['authored_by_owner'], true);
    assert.equal(storedReply.metadata?.['owner_replied'], true);
    assert.equal(
      storedReply.source_url,
      'https://mail.google.com/mail/u/owner%40example.com/#all/thread-1',
    );

    const syncEvent = listEvents(getDb(env), { limit: 10 })
      .find(event => event.type === 'gmail_sync');
    assert.ok(syncEvent);
    assert.deepEqual(
      (syncEvent.content as { items: unknown[] }).items,
      [
        {
          title: 'Launch timing',
          object_id: 'gmail:c8cd3c642730:question-1',
          source_url: 'https://mail.google.com/mail/u/owner%40example.com/#all/thread-1',
          sender: 'Teammate',
          occurred_at: '2026-07-19T10:00:00.000Z',
        },
        {
          title: 'Re: Launch timing',
          object_id: 'gmail:c8cd3c642730:reply-1',
          source_url: 'https://mail.google.com/mail/u/owner%40example.com/#all/thread-1',
          sender: 'Owner',
          occurred_at: '2026-07-19T11:00:00.000Z',
        },
      ],
    );
  } finally {
    await app.close();
    closeDb();
    await closeSmartwareCore();
  }
});

test('Ask Pod collapses one email message and its one-message conversation projection', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-email-dedup-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);
  const source: EmailSource = {
    provider: 'gmail',
    integration_id: 'gmail',
    account_id: 'owner@example.com',
    display_name: 'Google',
    async fetchRecent() {
      return [{
        id: 'subscription-1',
        thread_id: 'gmail:owner@example.com:subscription-thread',
        provider: 'gmail',
        account_id: 'owner@example.com',
        subject: 'ChatGPT - Your updated plan',
        from: { address: 'noreply@example.com', name: 'OpenAI' },
        to: [{ address: 'owner@example.com' }],
        cc: [],
        occurred_at: '2026-07-26T00:13:35.000Z',
        body: 'You have successfully subscribed to ChatGPT Pro. Your subscription renews monthly.',
        mailbox: 'Inbox',
        labels: ['INBOX'],
        headers: {},
        authored_by_owner: false,
        message_id: 'subscription@example.com',
        references: [],
      }];
    },
  };

  try {
    await syncEmailSource(env, app.log, source, {
      signal_config: { skip_observe_low: false },
    });

    const queried = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: 'person-local',
        scope: 'all',
        query: 'ChatGPT Pro subscription',
        include_observations: true,
        include_external_mcp: false,
        use_llm: false,
      },
    });

    assert.equal(queried.statusCode, 200);
    const gmailSources = queried.json().sources.filter(
      (candidate: { source?: { app?: string } }) => candidate.source?.app === 'gmail',
    );
    assert.equal(gmailSources.length, 1);
    assert.deepEqual(
      gmailSources[0].ranking.retrievers,
      ['library_fts', 'lexical', 'conversation_projection'],
    );
  } finally {
    await app.close();
    closeDb();
    await closeSmartwareCore();
  }
});
