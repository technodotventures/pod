import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeDb, getDb, getObject, listObjectMemoryObservations } from '../pod/db.js';
import { closeSmartwareCore, getPodProfile, getSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: 'person_owner_artifact_lifecycle',
    podId: 'artifact-lifecycle-test',
    podName: 'Artifact Lifecycle Test Pod',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('artifact revisions replace their semantic observation and deletion retires memory by default', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-artifact-lifecycle-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);
  const db = getDb(env);

  try {
    const created = await app.inject({
      method: 'POST',
      url: '/pod/objects',
      payload: {
        actor_id: 'person-local',
        id: 'lifecycle-artifact',
        kind: 'note',
        title: 'Project Atlas status',
        content: { text: 'Project Atlas is active.' },
      },
    });
    assert.equal(created.statusCode, 200, created.payload);
    assert.equal(created.json().memory.status, 'created');
    const firstObject = getObject(db, 'lifecycle-artifact')!;
    assert.equal(firstObject.version, 1);

    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const actor = { type: 'person' as const, id: 'person-local', display_name: 'Owner' };
    await core.compile({ actor, scope: profile.scopes.workspace, use_llm: false });

    const patched = await app.inject({
      method: 'PATCH',
      url: '/pod/objects/lifecycle-artifact',
      payload: { content: { text: 'Project Atlas is cancelled.' } },
    });
    assert.equal(patched.statusCode, 200, patched.payload);
    assert.equal(patched.json().memory.status, 'created');
    const secondObject = getObject(db, 'lifecycle-artifact')!;
    assert.equal(secondObject.version, 2);

    const activeLineage = listObjectMemoryObservations(db, 'lifecycle-artifact', 'active');
    const retiredLineage = listObjectMemoryObservations(db, 'lifecycle-artifact', 'retired');
    assert.equal(activeLineage.length, 1);
    assert.equal(activeLineage[0]?.object_version, 2);
    assert.equal(retiredLineage.length, 1);
    assert.equal(retiredLineage[0]?.object_version, 1);

    await core.compile({ actor, scope: profile.scopes.workspace, use_llm: false });
    const afterPatch = core.readKnowledgeGraph({ actor, scopes: [profile.scopes.workspace] });
    assert.ok(afterPatch.claims.some(claim =>
      claim.subject_name === 'Project Atlas' && claim.object.value === 'cancelled'));
    assert.ok(!afterPatch.claims.some(claim =>
      claim.subject_name === 'Project Atlas' && claim.object.value === 'active'),
    JSON.stringify(afterPatch.claims.filter(claim => claim.subject_name === 'Project Atlas')));

    const graphResponse = await app.inject({ method: 'GET', url: '/pod/graph?limit=100' });
    assert.equal(graphResponse.statusCode, 200, graphResponse.payload);
    const graph = graphResponse.json();
    const atlasNode = graph.nodes.find((node: { id: string; label: string }) =>
      node.id.startsWith('sw:') && node.label === 'Project Atlas');
    assert.ok(atlasNode);
    assert.ok(graph.edges.some((edge: {
      source: string;
      target: string;
      provenance?: { origin?: string; observation_ids?: string[] };
    }) =>
      edge.source === 'obj:lifecycle-artifact'
      && edge.target === atlasNode.id
      && edge.provenance?.origin === 'claim_observation_lineage'
      && edge.provenance.observation_ids?.includes(activeLineage[0]!.observation_id)));

    const deleted = await app.inject({
      method: 'DELETE',
      url: '/pod/objects/lifecycle-artifact',
      payload: { actor_id: 'person-local' },
    });
    assert.equal(deleted.statusCode, 200, deleted.payload);
    assert.equal(deleted.json().forgotten, true);
    assert.equal(getObject(db, 'lifecycle-artifact'), null);
    assert.equal(listObjectMemoryObservations(db, 'lifecycle-artifact', 'active').length, 0);

    const afterDelete = core.readKnowledgeGraph({ actor, scopes: [profile.scopes.workspace] });
    assert.ok(!afterDelete.claims.some(claim => claim.subject_name === 'Project Atlas'));
  } finally {
    await app.close();
    await closeSmartwareCore();
    closeDb();
  }
});
