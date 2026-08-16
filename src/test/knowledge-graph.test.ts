import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readLatestClaimVersion } from 'smartware';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import {
  closeDb,
  getDb,
  listOutboundReferences,
  patchObject,
  upsertAgent,
  upsertCollection,
  upsertObject,
  type PodObject,
} from '../pod/db.js';
import {
  aggregateEpistemicTags,
  MAX_GRAPH_OBJECT_LIMIT,
  parseGraphObjectLimit,
  parseGraphProjectionMode,
  selectRepresentativeGraphObjects,
} from '../pod/knowledge-graph.js';
import { issueClientToken } from '../security/client-tokens.js';
import { closeSmartwareCore, getPodProfile, getSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: 'person_owner_graph',
    podId: 'knowledge-graph-test',
    podName: 'Knowledge Graph Test Pod',
    apiToken: 'owner-token',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('graph limit parsing rejects invalid values and caps large requests', () => {
  assert.equal(parseGraphObjectLimit('0'), null);
  assert.equal(parseGraphObjectLimit('1.5'), null);
  assert.equal(parseGraphObjectLimit('not-a-number'), null);
  assert.equal(parseGraphObjectLimit(String(MAX_GRAPH_OBJECT_LIMIT + 1)), MAX_GRAPH_OBJECT_LIMIT);
  assert.equal(parseGraphProjectionMode(undefined), 'overview');
  assert.equal(parseGraphProjectionMode('neighborhood'), 'neighborhood');
  assert.equal(parseGraphProjectionMode('random'), null);
  assert.equal(aggregateEpistemicTags([]), undefined);
  assert.equal(aggregateEpistemicTags(['fact', 'fact']), 'fact');
  assert.equal(aggregateEpistemicTags(['fact', 'inference']), 'mixed');
});

test('graph overview covers collections before filling with recent duplicates', () => {
  const object = (
    id: string,
    collectionId: string,
    updatedAt: string,
  ) => ({
    id,
    collection_id: collectionId,
    kind: 'note',
    source_app: 'pod',
    origin: 'written',
    content: null,
    metadata: null,
    created_at: updatedAt,
    updated_at: updatedAt,
    sort_order: 0,
  }) as PodObject;
  const selected = selectRepresentativeGraphObjects([
    object('new-a', 'a', '2026-07-27T00:00:00.000Z'),
    object('newer-a', 'a', '2026-07-28T00:00:00.000Z'),
    object('older-b', 'b', '2025-01-01T00:00:00.000Z'),
  ], 2);

  assert.deepEqual(new Set(selected.map(item => item.collection_id)), new Set(['a', 'b']));
});

test('owner graph projects warranted layers, durable annotations, hierarchy, and stable references', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-knowledge-graph-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);
  const db = getDb(env);

  try {
    const client = await issueClientToken(env, {
      clientId: 'graph-client',
      clientName: 'Graph client',
      actorId: 'coffee:graph-client',
      grantId: 'grant_graph_client',
    });
    const clientDenied = await app.inject({
      method: 'GET',
      url: '/pod/graph',
      headers: { authorization: `Bearer ${client.token}` },
    });
    assert.equal(clientDenied.statusCode, 403);

    const agent = upsertAgent(db, { id: 'agent:graph-test', name: 'Graph Test Agent' });
    assert.ok(agent.auth_token);
    const agentDenied = await app.inject({
      method: 'GET',
      url: '/pod/graph',
      headers: { authorization: `Bearer ${agent.auth_token}` },
    });
    assert.equal(agentDenied.statusCode, 403);

    upsertCollection(db, { id: 'graph-parent', name: 'Graph Parent' });
    upsertCollection(db, { id: 'graph-child', name: 'Graph Child', parent_id: 'graph-parent' });

    upsertObject(db, {
      id: 'graph-late-source',
      collection_id: 'graph-child',
      kind: 'note',
      title: 'Late Source',
      content: { text: 'Written before its target.' },
      metadata: { references: { related_to: ['Late Target'] } },
    });
    assert.equal(listOutboundReferences(db, 'graph-late-source').related_to.length, 0);

    upsertObject(db, {
      id: 'graph-late-target',
      collection_id: 'graph-child',
      kind: 'note',
      title: 'Late Target',
      content: { text: 'Created second.' },
    });
    assert.equal(listOutboundReferences(db, 'graph-late-source').related_to[0]?.target_object_id, 'graph-late-target');

    patchObject(db, 'graph-late-target', { title: 'Renamed Target' });
    assert.equal(listOutboundReferences(db, 'graph-late-source').related_to[0]?.target_title, 'Renamed Target');

    upsertObject(db, {
      id: 'graph-old-title-imposter',
      collection_id: 'graph-child',
      kind: 'note',
      title: 'Late Target',
      content: { text: 'Must not steal an already-resolved stable reference.' },
    });
    assert.deepEqual(
      listOutboundReferences(db, 'graph-late-source').related_to.map((reference) => reference.target_object_id),
      ['graph-late-target'],
    );

    patchObject(db, 'graph-late-source', { content: { text: 'Patched after target rename.' } });
    const renamedReference = listOutboundReferences(db, 'graph-late-source').related_to[0];
    assert.equal(renamedReference?.target_object_id, 'graph-late-target');
    assert.equal(renamedReference?.target_title, 'Renamed Target');

    upsertObject(db, {
      id: 'graph-exact',
      collection_id: 'graph-child',
      kind: 'note',
      title: 'Project Atlas',
      content: { text: 'Exact entity title.' },
    });
    upsertObject(db, {
      id: 'graph-substring',
      collection_id: 'graph-child',
      kind: 'note',
      title: 'Project Atlas Roadmap',
      content: { text: 'Only a substring match.' },
    });
    upsertObject(db, {
      id: 'graph-sensitive-object',
      kind: 'note',
      title: 'Sensitive Pod Object',
      content: { text: 'Must not be projected.' },
      sensitive: true,
    });
    upsertObject(db, {
      id: 'graph-synthetic-person',
      collection_id: 'graph-child',
      kind: 'entity',
      title: 'Synthetic Map Person',
      content: { text: 'Demo-only map anchor.' },
      metadata: {
        synthetic: true,
        graph_stress: true,
        map_node_type: 'person',
      },
    });
    upsertObject(db, {
      id: 'graph-untrusted-map-hint',
      collection_id: 'graph-child',
      kind: 'entity',
      title: 'Ordinary Pod Object',
      content: { text: 'A normal object cannot override its map type.' },
      metadata: { map_node_type: 'person' },
    });

    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const actor = { type: 'person' as const, id: env.ownerId!, display_name: 'Owner' };
    await core.observe({
      actor,
      type: 'decision',
      scope: profile.scopes.workspace,
      content: { format: 'text/plain', body: 'Project Atlas is approved. Project Beta is pending.' },
      visibility: 'scope',
      app: 'knowledge-graph-test',
    });
    await core.observe({
      actor,
      type: 'decision',
      scope: profile.scopes.workspace,
      content: { format: 'text/plain', body: 'Secret Meridian is approved.' },
      visibility: 'scope',
      sensitive: true,
      app: 'knowledge-graph-test',
    });
    await core.compile({ actor, scope: profile.scopes.workspace, use_llm: false });

    const visibleSnapshot = core.readKnowledgeGraph({ actor, scopes: [profile.scopes.workspace], include_sensitive: false });
    assert.ok(visibleSnapshot.entities.some((entity) => entity.entity_name === 'Project Atlas'));
    assert.ok(!visibleSnapshot.entities.some((entity) => entity.entity_name === 'Secret Meridian'));

    const atlasClaim = visibleSnapshot.claims.find((claim) => claim.subject_name === 'Project Atlas');
    const betaClaim = visibleSnapshot.claims.find((claim) => claim.subject_name === 'Project Beta');
    assert.ok(atlasClaim);
    assert.ok(betaClaim);
    const atlasVersion = readLatestClaimVersion(core.dataDir, atlasClaim.claim_id)?.version;
    const betaVersion = readLatestClaimVersion(core.dataDir, betaClaim.claim_id)?.version;
    assert.ok(atlasVersion);
    assert.ok(betaVersion);
    await core.revise({
      actor,
      target: atlasClaim.claim_id,
      expected_base_version: atlasVersion,
      add_relations: [{
        kind: 'supports',
        target: betaClaim.claim_id,
        valid_at: '2026-07-14T00:00:00.000Z',
        provenance: { origin: 'user', target_claim_version: betaVersion },
      }],
      reason: 'Graph direction regression fixture',
      operation_id: 'op_KGRA000000000000000000001A',
    });

    const limited = await app.inject({
      method: 'GET',
      url: '/pod/graph?limit=1',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(limited.statusCode, 200);
    assert.equal(limited.json().meta.object_count, 1);
    assert.equal(limited.json().meta.object_limit, 1);
    assert.equal(limited.json().meta.truncated, true);
    assert.equal(limited.json().meta.projection_mode, 'overview');
    assert.equal(limited.json().meta.selection_strategy, 'representative_stratified');

    const neighborhood = await app.inject({
      method: 'GET',
      url: '/pod/graph?view=neighborhood&root=obj%3Agraph-exact&depth=1&limit=100',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(neighborhood.statusCode, 200);
    assert.equal(neighborhood.json().meta.projection_mode, 'neighborhood');
    assert.equal(neighborhood.json().meta.root_node_id, 'obj:graph-exact');
    assert.ok(neighborhood.json().nodes.some((node: { id: string }) => node.id === 'obj:graph-exact'));

    const graphResponse = await app.inject({
      method: 'GET',
      url: '/pod/graph?limit=100',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(graphResponse.statusCode, 200);
    const graph = graphResponse.json();
    assert.ok(!graph.nodes.some((node: { id: string }) => node.id === 'obj:graph-sensitive-object'));
    assert.ok(!graph.nodes.some((node: { label: string }) => node.label === 'Secret Meridian'));
    assert.ok(graph.nodes.some((node: {
      id: string;
      type: string;
      role: string;
      artifact_kind?: string;
      valid_at?: string;
      recorded_at?: string;
      temporal_basis?: string;
    }) =>
      node.id === 'obj:graph-exact'
      && node.type === 'artifact'
      && node.role === 'artifact'
      && node.artifact_kind === 'note'
      && node.valid_at === undefined
      && typeof node.recorded_at === 'string'
      && node.temporal_basis === 'recorded_time'));
    assert.ok(graph.nodes.some((node: { id: string; type: string; role: string }) =>
      node.id === 'col:graph-child' && node.type === 'collection' && node.role === 'collection'));
    assert.ok(graph.nodes.some((node: { id: string; type: string; role: string }) =>
      node.id === 'obj:graph-synthetic-person'
      && node.type === 'person'
      && node.role === 'artifact'));
    assert.ok(graph.nodes.some((node: { id: string; type: string }) =>
      node.id === 'obj:graph-untrusted-map-hint' && node.type === 'artifact'));
    assert.ok(graph.edges.some((edge: { id: string; layer: string }) => edge.id === 'col-parent:graph-child' && edge.layer === 'structural'));
    assert.ok(graph.edges.some((edge: { id: string; layer: string }) => edge.id === 'obj-col:graph-exact' && edge.layer === 'structural'));
    const metadataReference = graph.edges.find((edge: { id: string }) =>
      edge.id === 'ref:graph-late-source:graph-late-target:related_to');
    assert.equal(metadataReference?.layer, 'derived');
    assert.equal(metadataReference?.type, 'dashed');
    assert.deepEqual(metadataReference?.provenance, {
      origin: 'pod_object_metadata_reference',
      reference_key: 'Late Target',
      resolution: 'stable_id_from_title_intent',
    });

    const atlasNode = graph.nodes.find((node: { id: string; label: string }) => node.id.startsWith('sw:') && node.label === 'Project Atlas');
    const betaNode = graph.nodes.find((node: { id: string; label: string }) => node.id.startsWith('sw:') && node.label === 'Project Beta');
    assert.ok(atlasNode);
    assert.ok(betaNode);
    assert.equal(atlasNode.role, 'semantic_entity');
    assert.equal(typeof atlasNode.semantic_type, 'string');
    assert.ok(graph.edges.some((edge: {
      source: string;
      target: string;
      layer: string;
      label: string;
      provenance: { origin?: string; relation?: { origin?: string }; source_claim_id?: string; target_claim_id?: string };
    }) =>
      edge.source === atlasNode.id
      && edge.target === betaNode.id
      && edge.layer === 'derived'
      && edge.label === 'supports'
      && edge.provenance.origin === 'claim_relation_projection'
      && edge.provenance.relation?.origin === 'user'
      && edge.provenance.source_claim_id === atlasClaim.claim_id
      && edge.provenance.target_claim_id === betaClaim.claim_id));

    const derivedTargets = graph.edges
      .filter((edge: { source: string; layer: string; provenance: string }) =>
        edge.source === atlasNode.id && edge.layer === 'derived' && edge.provenance === 'title_exact')
      .map((edge: { target: string }) => edge.target);
    assert.deepEqual(derivedTargets, ['obj:graph-exact']);

    const annotationCreate = await app.inject({
      method: 'POST',
      url: '/pod/graph/edges',
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        source_node_id: 'obj:graph-exact',
        target_node_id: 'obj:graph-late-target',
        relation: 'contextualises',
        direction: 'undirected',
        note: 'User-authored map annotation',
      },
    });
    assert.equal(annotationCreate.statusCode, 201);
    const createdAnnotation = annotationCreate.json().edge;
    const annotationId = createdAnnotation.id as string;
    assert.match(annotationId, /^annotation:/);
    assert.equal(createdAnnotation.source, 'obj:graph-exact');
    assert.equal(createdAnnotation.target, 'obj:graph-late-target');
    assert.equal(createdAnnotation.layer, 'annotation');

    const invalidAnnotation = await app.inject({
      method: 'POST',
      url: '/pod/graph/edges',
      headers: { authorization: 'Bearer owner-token' },
      payload: { source: 42, target: 'obj:graph-late-target' },
    });
    assert.equal(invalidAnnotation.statusCode, 400);

    const unknownNodeAnnotation = await app.inject({
      method: 'POST',
      url: '/pod/graph/edges',
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        source_node_id: 'obj:does-not-exist',
        target_node_id: 'obj:graph-late-target',
        relation: 'must-not-resurface-later',
      },
    });
    assert.equal(unknownNodeAnnotation.statusCode, 404);

    const graphWithAnnotation = await app.inject({
      method: 'GET',
      url: '/pod/graph?limit=100',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.ok(graphWithAnnotation.json().edges.some((edge: { id: string; layer: string; direction: string }) =>
      edge.id === annotationId && edge.layer === 'annotation' && edge.direction === 'undirected'));

    const annotationDelete = await app.inject({
      method: 'DELETE',
      url: `/pod/graph/edges/${annotationId}`,
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(annotationDelete.statusCode, 200);
    const graphWithoutAnnotation = await app.inject({
      method: 'GET',
      url: '/pod/graph?limit=100',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.ok(!graphWithoutAnnotation.json().edges.some((edge: { id: string }) => edge.id === annotationId));

    await core.forget({
      actor,
      target: { type: 'claim', id: betaClaim.claim_id },
      mode: 'tombstone',
      reason: 'Graph lifecycle regression fixture',
    });
    const graphAfterForget = await app.inject({
      method: 'GET',
      url: '/pod/graph?limit=100',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.ok(!graphAfterForget.json().nodes.some((node: { id: string }) => node.id === betaNode.id));
    assert.ok(!graphAfterForget.json().edges.some((edge: { provenance?: { target_claim_id?: string } }) =>
      edge.provenance?.target_claim_id === betaClaim.claim_id));
  } finally {
    await app.close();
    await closeSmartwareCore();
    closeDb();
  }
});
