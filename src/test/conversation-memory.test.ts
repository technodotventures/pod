import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeDb } from '../pod/db.js';
import { ensureAppDataSpace } from '../pod/data-spaces.js';
import {
  compileConversationProjection,
  findConversationEvidence,
} from '../services/conversation-memory.js';
import { closeSmartwareCore, getSmartwareCore } from '../smartware/core.js';

let operationSequence = 8_000;
function operationId(): string {
  operationSequence += 1;
  return `op_${String(operationSequence).padStart(26, '0')}`;
}

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'conversation-test',
    podName: 'Conversation Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('conversation messages become scoped, cited question-resolution evidence refreshed by Dream', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-conversation-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);

  try {
    const status = await app.inject({ method: 'GET', url: '/pod/status' });
    const ownerActorId = status.json().pod.owner_id as string;
    const observations: string[] = [];

    const observe = async (input: {
      conversationId: string;
      messageId: string;
      text: string;
      actorId: string;
      private?: boolean;
      sensitive?: boolean;
    }) => {
      const response = await app.inject({
        method: 'POST',
        url: '/pod/observe',
        payload: {
          actor_id: ownerActorId,
          operation_id: operationId(),
          scope_alias: 'workspace',
          type: 'message',
          visibility: input.private ? 'private' : 'scope',
          sensitive: input.sensitive ?? false,
          content_format: 'application/json',
          content: {
            kind: 'conversation_message',
            source: 'slack',
            conversation_id: input.conversationId,
            message_id: input.messageId,
            text: input.text,
            actor_id: input.actorId,
            actor_name: input.actorId.split(':').at(-1),
            channel_id: 'C_RELEASES',
            channel_name: 'releases',
            reactions_count: 0,
          },
        },
      });
      assert.equal(response.statusCode, 200, response.payload);
      observations.push(response.json().id as string);
      return response.json().id as string;
    };

    const questionObservationId = await observe({
      conversationId: 'C_RELEASES:thread-1',
      messageId: '1',
      actorId: 'person:alice',
      text: 'Why does the production upload fail before the UI bundle exists?',
    });
    const resolutionObservationId = await observe({
      conversationId: 'C_RELEASES:thread-1',
      messageId: '2',
      actorId: 'person:bob',
      text: 'Resolved: run `npm run build` and verify dist-ui before starting the production upload.',
    });
    await observe({
      conversationId: 'C_RELEASES:thread-lunch',
      messageId: '3',
      actorId: 'person:alice',
      text: 'Where should we order lunch today?',
    });
    await observe({
      conversationId: 'C_RELEASES:thread-private',
      messageId: '4',
      actorId: 'person:alice',
      text: 'Private production upload resolution: use a hidden credential.',
      private: true,
    });
    await observe({
      conversationId: 'C_RELEASES:thread-sensitive',
      messageId: '5',
      actorId: 'person:alice',
      text: 'Sensitive production upload resolution: use a secret token.',
      sensitive: true,
    });

    const workspaceScope = status.json().pod.scopes.workspace as string;
    const projection = await compileConversationProjection(env, workspaceScope);
    assert.equal(projection.conversations.length, 2);
    const release = projection.conversations.find(row => row.conversation_id === 'C_RELEASES:thread-1');
    assert.ok(release);
    assert.equal(release.question, 'Why does the production upload fail before the UI bundle exists?');
    assert.equal(release.question_actor_id, 'person:alice');
    assert.equal(release.resolution, 'Resolved: run `npm run build` and verify dist-ui before starting the production upload.');
    assert.equal(release.resolution_actor_id, 'person:bob');
    assert.deepEqual(release.code_refs, ['npm run build']);
    assert.deepEqual(release.evidence_observation_ids, [questionObservationId, resolutionObservationId]);
    assert.deepEqual(release.participants.map(participant => participant.actor_id), ['person:alice', 'person:bob']);

    const matches = await findConversationEvidence(env, [workspaceScope], 'production bundle upload', 5);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]!.id, release.id);
    assert.match(matches[0]!.text, /Question:/);
    assert.match(matches[0]!.text, /Resolution:/);

    const context = await app.inject({
      method: 'POST',
      url: '/pod/context',
      payload: {
        query: 'How do we fix the production bundle upload?',
        scope: 'workspace',
        token_budget: 2_000,
      },
    });
    assert.equal(context.statusCode, 200, context.payload);
    assert.equal(context.json().conversations.length, 1);
    assert.equal(context.json().conversations[0].id, release.id);
    const contextEvidence = context.json().evidence.find((row: { type: string }) => row.type === 'conversation');
    assert.ok(contextEvidence);
    assert.equal(contextEvidence.source_group, 'conversation:slack:C_RELEASES:thread-1');
    assert.deepEqual(contextEvidence.provenance.observation_ids, [questionObservationId, resolutionObservationId]);

    const session = await app.inject({
      method: 'POST',
      url: '/pod/session/start',
      payload: {
        actor_id: ownerActorId,
        scope_alias: 'workspace',
        session_id: 'session-release-fix',
        goal: 'Fix the production bundle upload',
        query: 'How do we fix the production bundle upload?',
      },
    });
    assert.equal(session.statusCode, 200, session.payload);
    assert.equal(session.json().session.read_policy, 'task_start_lane_aware');
    assert.equal(session.json().context.conversations.length, 1);
    assert.equal(session.json().context.conversations[0].id, release.id);
    assert.ok(session.json().context.evidence.some((row: { type: string; source_group: string }) =>
      row.type === 'conversation' && row.source_group === 'conversation:slack:C_RELEASES:thread-1'));

    const query = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: ownerActorId,
        scope_alias: 'workspace',
        query: 'production bundle upload',
        use_llm: false,
      },
    });
    assert.equal(query.statusCode, 200, query.payload);
    assert.equal(query.json().retrieval.conversation_results, 1);
    assert.ok(query.json().evidence.some((row: { type: string; source_group: string }) =>
      row.type === 'conversation' && row.source_group === 'conversation:slack:C_RELEASES:thread-1'));

    const core = await getSmartwareCore(env);
    const slackSpace = ensureAppDataSpace(core, env, 'slack');
    const appConversation = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: ownerActorId,
        operation_id: operationId(),
        scope: slackSpace.scope,
        type: 'message',
        content_format: 'application/json',
        content: {
          kind: 'conversation_message',
          source: 'slack',
          conversation_id: 'C_INFRA:thread-manifest',
          message_id: '6',
          text: 'Resolved: checkpoint manifest recovery requires remounting the NFS volume.',
          actor_id: 'person:carol',
          actor_name: 'Carol',
          channel_id: 'C_INFRA',
          channel_name: 'infra',
          reactions_count: 4,
        },
      },
    });
    assert.equal(appConversation.statusCode, 200, appConversation.payload);
    const allMemoryQuery = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: ownerActorId,
        scope: 'all',
        query: 'checkpoint manifest recovery',
        use_llm: false,
      },
    });
    assert.equal(allMemoryQuery.statusCode, 200, allMemoryQuery.payload);
    assert.equal(allMemoryQuery.json().query_scope, 'all');
    assert.ok(allMemoryQuery.json().evidence.some((row: { source_group: string }) =>
      row.source_group === 'conversation:slack:C_INFRA:thread-manifest'));

    const expertise = await app.inject({
      method: 'POST',
      url: '/pod/expertise',
      payload: {
        actor_id: ownerActorId,
        query: 'production bundle upload',
        scope: 'workspace',
      },
    });
    assert.equal(expertise.statusCode, 200, expertise.payload);
    assert.equal(expertise.json().methodology, 'demonstrated_activity_only');
    assert.equal(expertise.json().experts[0].actor_id, 'person:bob');
    assert.ok(expertise.json().experts[0].demonstrated_by.resolutions >= 1);
    assert.deepEqual(
      expertise.json().experts[0].evidence[0].provenance.observation_ids,
      [resolutionObservationId],
    );
    assert.equal(expertise.json().experts.some((row: { actor_id: string }) => row.actor_id === 'person:alice'), false);

    const personalAgent = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:personal-only',
        name: 'Personal only',
        access_mode: 'scoped',
        scopes: ['personal'],
      },
    });
    assert.equal(personalAgent.statusCode, 200, personalAgent.payload);
    const forbiddenExpertise = await app.inject({
      method: 'POST',
      url: '/pod/expertise',
      headers: { authorization: `Bearer ${personalAgent.json().agent.auth_token as string}` },
      payload: {
        actor_id: 'agent:personal-only',
        query: 'production bundle upload',
        scope: 'workspace',
      },
    });
    assert.equal(forbiddenExpertise.statusCode, 403);

    const forgotten = await app.inject({
      method: 'POST',
      url: '/pod/forget',
      payload: {
        actor_id: ownerActorId,
        operation_id: operationId(),
        target: { type: 'observation', id: resolutionObservationId },
        mode: 'tombstone',
        reason: 'Lifecycle regression check',
      },
    });
    assert.equal(forgotten.statusCode, 200, forgotten.payload);
    const refreshedProjection = await compileConversationProjection(env, workspaceScope);
    const refreshedRelease = refreshedProjection.conversations.find(row => row.id === release.id);
    assert.ok(refreshedRelease);
    assert.equal(refreshedRelease.resolution, null);
    assert.deepEqual(refreshedRelease.evidence_observation_ids, [questionObservationId]);
    const refreshedExpertise = await app.inject({
      method: 'POST',
      url: '/pod/expertise',
      payload: {
        actor_id: ownerActorId,
        query: 'production bundle upload',
        scope: 'workspace',
      },
    });
    assert.equal(refreshedExpertise.statusCode, 200, refreshedExpertise.payload);
    assert.equal(refreshedExpertise.json().experts.some((row: { actor_id: string }) => row.actor_id === 'person:bob'), false);

    const dream = await app.inject({
      method: 'POST',
      url: '/pod/dream',
      payload: { actor_id: ownerActorId, scope_alias: 'workspace' },
    });
    assert.equal(dream.statusCode, 200, dream.payload);
    assert.deepEqual(dream.json().conversations, {
      scopes_refreshed: 1,
      conversation_count: 2,
    });
  } finally {
    await app.close();
    closeDb();
    await closeSmartwareCore();
  }
});
