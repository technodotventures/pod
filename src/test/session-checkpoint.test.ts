import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { deriveSessionCheckpointId } from 'smartware';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeDb } from '../pod/db.js';
import { closeSmartwareCore, getSmartwareCore } from '../smartware/core.js';

let operationSequence = 41_000;
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
    podId: 'checkpoint-test',
    podName: 'Checkpoint Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('session checkpoints are scoped, replay-safe, and recallable as typed claims', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-checkpoint-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);

  try {
    const status = await app.inject({ method: 'GET', url: '/pod/status' });
    const actorId = status.json().pod.owner_id as string;
    const scope = status.json().pod.scopes.workspace as string;
    const sessionId = 'session-release-42';
    const trigger = 'pre_compaction' as const;
    const generation = 2;
    const checkpointId = deriveSessionCheckpointId(sessionId, trigger, generation);
    const payload = {
      actor_id: actorId,
      scope_alias: 'workspace',
      operation_id: operationId(),
      checkpoint_id: checkpointId,
      session_id: sessionId,
      trigger,
      generation,
      summary: 'The online migration is staged but has not been applied.',
      decisions: ['Use the online migration path.'],
      open_loops: ['Verify replica lag before applying.'],
      source_digest: `sha256:${'a'.repeat(64)}`,
    };

    const missingScope = await app.inject({
      method: 'POST',
      url: '/pod/session/checkpoint',
      payload: { ...payload, scope_alias: undefined },
    });
    assert.equal(missingScope.statusCode, 400, missingScope.payload);
    assert.equal(missingScope.json().error.code, 'invalid_payload');

    const missingSession = await app.inject({
      method: 'POST',
      url: '/pod/session/checkpoint',
      payload,
    });
    assert.equal(missingSession.statusCode, 404, missingSession.payload);

    const started = await app.inject({
      method: 'POST',
      url: '/pod/session/start',
      payload: {
        actor_id: actorId,
        scope_alias: 'workspace',
        session_id: sessionId,
        goal: 'Ship the online migration safely',
      },
    });
    assert.equal(started.statusCode, 200, started.payload);

    const first = await app.inject({ method: 'POST', url: '/pod/session/checkpoint', payload });
    assert.equal(first.statusCode, 200, first.payload);
    assert.equal(first.json().checkpoint_id, checkpointId);
    assert.equal(first.json().scope, scope);

    const retry = await app.inject({ method: 'POST', url: '/pod/session/checkpoint', payload });
    assert.equal(retry.statusCode, 200, retry.payload);
    assert.equal(retry.json().id, first.json().id);

    const changedRetry = await app.inject({
      method: 'POST',
      url: '/pod/session/checkpoint',
      payload: { ...payload, summary: 'Changed after the operation was committed.' },
    });
    assert.equal(changedRetry.statusCode, 409, changedRetry.payload);
    assert.equal(changedRetry.json().error.code, 'conflict');

    const invalidIdentity = await app.inject({
      method: 'POST',
      url: '/pod/session/checkpoint',
      payload: { ...payload, operation_id: operationId(), checkpoint_id: `checkpoint_${'0'.repeat(64)}` },
    });
    assert.equal(invalidIdentity.statusCode, 400, invalidIdentity.payload);
    assert.equal(invalidIdentity.json().error.code, 'invalid_payload');
    assert.equal(invalidIdentity.json().error.details.expected_checkpoint_id, checkpointId);

    const wrongScope = await app.inject({
      method: 'POST',
      url: '/pod/session/checkpoint',
      payload: {
        ...payload,
        operation_id: operationId(),
        scope_alias: 'personal',
        checkpoint_id: deriveSessionCheckpointId(sessionId, 'manual', 0),
        trigger: 'manual',
        generation: 0,
      },
    });
    assert.equal(wrongScope.statusCode, 404, wrongScope.payload);

    const core = await getSmartwareCore(env);
    const observation = core.readObservationEvidence({
      actor: { type: 'person', id: actorId, display_name: actorId },
      observation_id: first.json().id as string,
    });
    assert.ok(observation);
    assert.equal(observation.type, 'compaction');
    assert.deepEqual(observation.content, {
      kind: 'session_checkpoint',
      version: 1,
      operation_id: payload.operation_id,
      checkpoint_id: checkpointId,
      session_id: sessionId,
      scope,
      trigger,
      generation,
      summary: payload.summary,
      decisions: payload.decisions,
      open_loops: payload.open_loops,
      source_digest: payload.source_digest,
    });

    await core.compile({
      actor: { type: 'person', id: actorId, display_name: actorId },
      scope,
      use_llm: false,
    });
    const recalled = await core.recall({
      actor: { type: 'person', id: actorId, display_name: actorId },
      scope,
      query: 'checkpoint',
    });
    const checkpoint = recalled.results.find(result => result.claim?.predicate === 'checkpoint:pre_compaction');
    assert.ok(checkpoint);
    assert.equal((checkpoint.claim?.object as { type?: string }).type, 'any');
    assert.deepEqual(
      (checkpoint.claim?.object as { value?: { checkpoint_id?: string; open_loops?: string[] } }).value,
      observation.content,
    );
    assert.deepEqual(checkpoint.claim?.observation_ids, [first.json().id]);
  } finally {
    await app.close();
    closeDb();
    await closeSmartwareCore();
  }
});
