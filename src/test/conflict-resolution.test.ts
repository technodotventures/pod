import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeSmartwareCore, getPodProfile, getSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: 'user:owner',
    podId: 'conflict-test',
    podName: 'Conflict Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('a genuine memory conflict becomes a resolvable attention item', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-conflict-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);

  try {
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const actor = { type: 'person' as const, id: profile.owner_id, display_name: 'Owner' };
    const observedAt = '2026-07-25T10:00:00.000Z';

    await core.observe({
      actor,
      type: 'decision',
      content: { format: 'text/plain', body: 'Release is active.' },
      scope: profile.scopes.workspace,
      source_id: 'release-active',
      observed_at: observedAt,
    });
    await core.observe({
      actor,
      type: 'decision',
      content: { format: 'text/plain', body: 'Release is cancelled.' },
      scope: profile.scopes.workspace,
      source_id: 'release-cancelled',
      observed_at: observedAt,
    });
    await core.compile({ actor, scope: profile.scopes.workspace, use_llm: false });

    const compiledClaims = core.readKnowledgeGraph({
      actor,
      scopes: [profile.scopes.workspace],
    }).claims.filter(claim => claim.subject_name === 'Release' && claim.predicate === 'status_is');
    assert.equal(compiledClaims.length, 2);
    const [firstClaim, secondClaim] = compiledClaims;
    const smartwareDb = new Database(path.join(dataDir, 'smartware.db'));
    try {
      smartwareDb.prepare(
        "UPDATE claims SET status = 'contested', contested_by = ? WHERE id = ?",
      ).run(JSON.stringify([secondClaim!.claim_id]), firstClaim!.claim_id);
      smartwareDb.prepare(
        "UPDATE claims SET status = 'contested', contested_by = ? WHERE id = ?",
      ).run(JSON.stringify([firstClaim!.claim_id]), secondClaim!.claim_id);
    } finally {
      smartwareDb.close();
    }

    const before = core.readConflicts({ actor, scopes: [profile.scopes.workspace] });
    assert.equal(before.claims.length, 2);

    const query = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: profile.owner_id,
        scope_alias: 'workspace',
        query: 'Are there any conflicting memories?',
        use_llm: true,
      },
    });
    assert.equal(query.statusCode, 200, query.payload);
    assert.equal(query.json().conflicts.length, 1);

    const activity = await app.inject({ method: 'GET', url: '/pod/events?limit=20' });
    assert.equal(activity.statusCode, 200, activity.payload);
    const conflictEvent = activity.json().events.find((event: { type: string }) =>
      event.type === 'memory_conflict_detected');
    assert.ok(conflictEvent);
    assert.equal(conflictEvent.requires_attention, true);
    assert.equal(conflictEvent.attention_action, 'conflict');
    assert.equal(conflictEvent.content.conflict.claims.length, 2);

    const dismissed = await app.inject({
      method: 'PATCH',
      url: '/pod/events/attention',
      payload: {
        event_ids: [conflictEvent.id],
        dismissed: true,
      },
    });
    assert.equal(dismissed.statusCode, 200, dismissed.payload);
    assert.deepEqual(dismissed.json().event_ids, [conflictEvent.id]);

    const activityAfterDismissal = await app.inject({ method: 'GET', url: '/pod/events?limit=20' });
    const dismissedConflict = activityAfterDismissal.json().events.find(
      (event: { id: string }) => event.id === conflictEvent.id,
    );
    assert.ok(dismissedConflict.dismissed_at);
    assert.equal(dismissedConflict.requires_attention, true);
    assert.equal(dismissedConflict.resolved_at, null);

    const restored = await app.inject({
      method: 'PATCH',
      url: '/pod/events/attention',
      payload: {
        event_ids: [conflictEvent.id],
        dismissed: false,
      },
    });
    assert.equal(restored.statusCode, 200, restored.payload);
    assert.deepEqual(restored.json().event_ids, [conflictEvent.id]);

    const activityAfterRestore = await app.inject({ method: 'GET', url: '/pod/events?limit=20' });
    const restoredConflict = activityAfterRestore.json().events.find(
      (event: { id: string }) => event.id === conflictEvent.id,
    );
    assert.equal(restoredConflict.dismissed_at, null);
    assert.equal(restoredConflict.requires_attention, true);

    const selectedClaim = conflictEvent.content.conflict.claims.find(
      (claim: { object: { value: string } }) => claim.object.value === 'active',
    );
    assert.ok(selectedClaim);

    const resolved = await app.inject({
      method: 'POST',
      url: '/pod/conflicts/resolve',
      payload: {
        actor_id: profile.owner_id,
        event_id: conflictEvent.id,
        selected_claim_id: selectedClaim.claim_id,
        reason: 'The release remains active',
        operation_id: 'op_00000000000000000000000002',
      },
    });
    assert.equal(resolved.statusCode, 200, resolved.payload);
    assert.equal(resolved.json().status, 'resolved');
    assert.deepEqual(
      resolved.json().superseded_claim_ids,
      conflictEvent.content.conflict.claims
        .filter((claim: { claim_id: string }) => claim.claim_id !== selectedClaim.claim_id)
        .map((claim: { claim_id: string }) => claim.claim_id),
    );
    assert.equal(core.readConflicts({ actor, scopes: [profile.scopes.workspace] }).claims.length, 0);

    const refreshedActivity = await app.inject({ method: 'GET', url: '/pod/events?limit=20' });
    const refreshedConflict = refreshedActivity.json().events.find(
      (event: { id: string }) => event.id === conflictEvent.id,
    );
    assert.ok(refreshedConflict.resolved_at);
    assert.equal(refreshedConflict.requires_attention, false);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});
