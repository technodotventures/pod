import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeSmartwareCore, getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { subscribeWatch, type WatchEvent } from '../services/watch-events.js';

let operationSequence = 0;
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
    podId: 'founder-test',
    podName: 'Founder Test Pod',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('OBSERVE operation identity returns the original observation and conflicts on payload mismatch', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-idempotency-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const status = await app.inject({ method: 'GET', url: '/pod/status' });
    const actorId = status.json().pod.owner_id;
    const observeOp = operationId();
    const first = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: actorId,
        operation_id: observeOp,
        scope_alias: 'workspace',
        type: 'decision',
        content: 'Pod should keep tags out of L1 claims.',
        idempotency_key: 'observe-key-1',
      },
    });
    assert.equal(first.statusCode, 200);
    const firstBody = first.json();

    const second = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: actorId,
        operation_id: observeOp,
        scope_alias: 'workspace',
        type: 'decision',
        content: 'Pod should keep tags out of L1 claims.',
        idempotency_key: 'observe-key-1',
      },
    });
    assert.equal(second.statusCode, 200);
    assert.equal(second.json().id, firstBody.id);

    const conflict = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: actorId,
        operation_id: observeOp,
        scope_alias: 'workspace',
        type: 'decision',
        content: 'This payload is different.',
        idempotency_key: 'observe-key-1',
      },
    });
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.json().error.code, 'conflict');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('WATCH subscribers receive compile events for the selected scope', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-watch-'));
  const env = testEnv(dataDir);
  const core = await getSmartwareCore(env);
  const profile = getPodProfile(core, env);
  const actor = { type: 'person' as const, id: 'person-local', display_name: 'person-local' };
  const events: WatchEvent[] = [];
  const unsubscribe = subscribeWatch({ scope: profile.scopes.workspace, event_types: ['compile'] }, event => events.push(event));

  try {
    await core.observe({
      actor,
      type: 'decision',
      scope: profile.scopes.workspace,
      content: { format: 'text/plain', body: 'Decision: implement WATCH transport for beta by 2026-06-01.' },
      visibility: 'scope',
      app: 'contract-test',
    });

    const compiled = await core.compile({
      actor,
      scope: profile.scopes.workspace,
      use_llm: false,
    });
    assert.ok(compiled.pages_compiled > 0);

    assert.equal(events.length, compiled.audit.length);
    assert.equal(events[0]?.type, 'compile');
    assert.equal(events[0]?.scope, profile.scopes.workspace);
    assert.equal(events[0]?.target, compiled.audit[0]?.entity_id);
  } finally {
    unsubscribe();
    await closeSmartwareCore();
  }
});

test('Protocol compatibility exposes RECALL delivery modes and explicit page REFLECT', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-recall-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const capabilities = await app.inject({ method: 'GET', url: '/pod/capabilities' });
    assert.equal(capabilities.statusCode, 200);
    assert.deepEqual(capabilities.json().protocol.verbs, ['OBSERVE', 'RECALL', 'REFLECT', 'WATCH', 'REVISE', 'FORGET', 'ACCESS']);
    assert.equal(capabilities.json().protocol.recall.cadence, 'request_driven');
    assert.equal(capabilities.json().protocol.reflect.cadence.mode, 'manual_only');
    assert.ok(capabilities.json().protocol.reflect.targets.includes('profile:self'));
    assert.deepEqual(capabilities.json().protocol.experience.events, ['attempt_finished', 'feedback_received']);
    assert.equal(capabilities.json().protocol.experience.transfer, 'authorized_scope');
    assert.ok(capabilities.json().capabilities.memory.includes('recall'));
    assert.ok(capabilities.json().capabilities.memory.includes('reflect'));
    assert.ok(capabilities.json().capabilities.memory.includes('revise'));
    assert.ok(capabilities.json().capabilities.memory.includes('access'));
    assert.ok(capabilities.json().capabilities.memory.includes('experience_lessons'));

    const observed = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'workspace',
        type: 'decision',
        content: 'Decision: RECALL supports inline and file_reference delivery for beta clients.',
      },
    });
    assert.equal(observed.statusCode, 200);

    const reflected = await app.inject({
      method: 'POST',
      url: '/pod/reflect',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'workspace',
        target: { type: 'page' },
        mode: 'explicit',
        use_llm: false,
      },
    });
    assert.equal(reflected.statusCode, 200);
    assert.ok(reflected.json().pages_compiled > 0);

    const inline = await app.inject({
      method: 'POST',
      url: '/pod/recall',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'workspace',
        query: 'file_reference delivery',
        depth: 'paragraph',
        delivery_mode: 'inline',
      },
    });
    assert.equal(inline.statusCode, 200);
    assert.equal(inline.json().delivery.mode, 'inline');
    assert.ok(inline.json().sources.length > 0);

    const referenced = await app.inject({
      method: 'POST',
      url: '/pod/recall',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'workspace',
        query: 'file_reference delivery',
        resolution: { max_results: 5, min_confidence: 'low' },
        delivery_mode: 'file_reference',
      },
    });
    assert.equal(referenced.statusCode, 200);
    assert.equal(referenced.json().delivery.mode, 'file_reference');
    const recallFile = referenced.json().delivery.file_path as string;
    assert.ok(recallFile.startsWith(path.join(dataDir, 'recall')));
    const recallPayload = JSON.parse(await readFile(recallFile, 'utf8'));
    assert.ok(recallPayload.sources.length > 0);

    const manualAutonomous = await app.inject({
      method: 'POST',
      url: '/pod/reflect',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'workspace',
        mode: 'autonomous',
      },
    });
    assert.equal(manualAutonomous.statusCode, 200);
    assert.equal(manualAutonomous.json().status, 'skipped');
    assert.equal(manualAutonomous.json().cadence.mode, 'manual_only');

    const cadence = await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.reflect_cadence',
      payload: { values: { mode: 'every_60s', interval_seconds: 60, next_reflect_after: new Date(0).toISOString() } },
    });
    assert.equal(cadence.statusCode, 200);

    const autonomous = await app.inject({
      method: 'POST',
      url: '/pod/reflect',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'workspace',
        mode: 'autonomous',
        use_llm: false,
      },
    });
    assert.equal(autonomous.statusCode, 200);
    assert.equal(autonomous.json().mode, 'autonomous');
    assert.equal(autonomous.json().cadence.mode, 'every_15m');
    assert.ok(autonomous.json().cadence.last_reflected_at);
    assert.ok(autonomous.json().cadence.next_reflect_after);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('REFLECT profile target writes the Self profile anchor with provenance', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-self-profile-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const observed = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'personal',
        type: 'preference',
        content: 'I prefer concise engineering updates with concrete verification status.',
      },
    });
    assert.equal(observed.statusCode, 200);
    const observationId = observed.json().id as string;

    const reflected = await app.inject({
      method: 'POST',
      url: '/pod/reflect',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        target: { type: 'profile', id: 'self' },
        mode: 'explicit',
      },
    });
    assert.equal(reflected.statusCode, 200);
    assert.equal(reflected.json().profile_id, 'self');
    assert.equal(reflected.json().target.id, 'self');
    assert.ok(reflected.json().sources.includes(observationId));
    assert.equal(reflected.json().path, path.join(dataDir, 'wiki', 'profiles', 'self.md'));

    const profileMarkdown = await readFile(path.join(dataDir, 'wiki', 'profiles', 'self.md'), 'utf8');
    assert.ok(profileMarkdown.includes('category: "profile"'));
    assert.ok(profileMarkdown.includes(observationId));
    assert.ok(profileMarkdown.includes('concise engineering updates'));
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('REVISE and FORGET mutate claims through spec-shaped HTTP routes and WATCH events', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-mutations-'));
  const app = await buildApp(testEnv(dataDir), false);
  const env = testEnv(dataDir);
  const core = await getSmartwareCore(env);
  const profile = getPodProfile(core, env);
  const events: WatchEvent[] = [];
  const unsubscribeRevise = subscribeWatch({ scope: profile.scopes.workspace, event_types: ['revise'] }, event => events.push(event));
  const unsubscribeForget = subscribeWatch({ scope: profile.scopes.workspace, event_types: ['forget'] }, event => events.push(event));

  try {
    const status = await app.inject({ method: 'GET', url: '/pod/status' });
    const ownerId = status.json().pod.owner_id as string;

    const observed = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: ownerId,
        operation_id: operationId(),
        scope_alias: 'workspace',
        type: 'decision',
        content: 'Decision: claim mutation tests use the beta mutation surface.',
      },
    });
    assert.equal(observed.statusCode, 200);
    const observationId = observed.json().id as string;

    const reflected = await app.inject({
      method: 'POST',
      url: '/pod/reflect',
      payload: { actor_id: ownerId, operation_id: operationId(), scope_alias: 'workspace', target: { type: 'page' }, use_llm: false },
    });
    assert.equal(reflected.statusCode, 200);

    const recalled = await app.inject({
      method: 'POST',
      url: '/pod/recall',
      payload: {
        actor_id: ownerId,
        scope_alias: 'workspace',
        query: 'beta mutation surface',
        resolution: { min_confidence: 'low' },
      },
    });
    assert.equal(recalled.statusCode, 200);
    const claimId = recalled.json().results[0].claim.id as string;

    const recallActivity = await app.inject({ method: 'GET', url: '/pod/events?process=recall&limit=10' });
    assert.equal(recallActivity.statusCode, 200);
    assert.ok(recallActivity.json().events.some((event: { process: string; content?: { query?: string } }) =>
      event.process === 'recall' && event.content?.query === 'beta mutation surface'));

    const revised = await app.inject({
      method: 'POST',
      url: '/pod/revise',
      payload: {
        actor_id: ownerId,
        claim_id: claimId,
        new_state: { content: 'claim mutation tests use spec-shaped REVISE responses', tag: 'text' },
        reason: 'changed',
        operation_id: operationId(),
      },
    });
    assert.equal(revised.statusCode, 200);
    assert.match(revised.json().revision_id, /^rev_/);
    assert.equal(revised.json().claim_id, claimId);
    assert.equal(revised.json().status, 'revised');
    assert.ok(events.some(event => event.type === 'revise' && event.target === claimId));

    const reviseActivity = await app.inject({ method: 'GET', url: '/pod/events?process=revise&limit=10' });
    assert.equal(reviseActivity.statusCode, 200);
    assert.ok(reviseActivity.json().events.some((event: { process: string; content?: { target_claim_id?: string } }) =>
      event.process === 'revise' && event.content?.target_claim_id === claimId));

    const forgotten = await app.inject({
      method: 'POST',
      url: '/pod/forget',
      payload: {
        actor_id: ownerId,
        target: { type: 'claim', id: claimId },
        mode: 'tombstone',
        reason: 'No longer needed for the beta mutation test.',
        operation_id: `op_${'0'.repeat(26)}`,
      },
    });
    assert.equal(forgotten.statusCode, 200);
    assert.equal(forgotten.json().target_kind, 'claim');
    assert.equal(forgotten.json().target_id, claimId);
    assert.equal(forgotten.json().status, 'forgotten');
    assert.ok(events.some(event => event.type === 'forget' && event.target === claimId));

    const forgetActivity = await app.inject({ method: 'GET', url: '/pod/events?process=forget&limit=10' });
    assert.equal(forgetActivity.statusCode, 200);
    assert.ok(forgetActivity.json().events.some((event: { process: string; content?: { target?: { id?: string } } }) =>
      event.process === 'forget' && event.content?.target?.id === claimId));

    const afterForget = await app.inject({
      method: 'POST',
      url: '/pod/recall',
      payload: {
        actor_id: ownerId,
        scope_alias: 'workspace',
        query: 'beta mutation surface',
        resolution: { min_confidence: 'low' },
      },
    });
    assert.equal(afterForget.statusCode, 200);
    assert.ok(!afterForget.json().results.some((result: { claim?: { id: string } }) => result.claim?.id === claimId));

    const explained = await app.inject({
      method: 'POST',
      url: '/pod/explain',
      payload: { actor_id: ownerId, claim_id: claimId },
    });
    assert.equal(explained.statusCode, 200);
    assert.equal(explained.json().claim.status, 'retracted');
    assert.equal(explained.json().claim.source_observation.id, observationId);
  } finally {
    unsubscribeRevise();
    unsubscribeForget();
    await app.close();
    await closeSmartwareCore();
  }
});

test('Context fencing prevents informed-by echo observations from being recompiled', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-context-fence-'));
  const env = testEnv(dataDir);
  const core = await getSmartwareCore(env);
  const profile = getPodProfile(core, env);
  const actor = { type: 'person' as const, id: 'person-local', display_name: 'person-local' };

  try {
    await core.observe({
      actor,
      type: 'decision',
      scope: profile.scopes.workspace,
      content: { format: 'text/plain', body: 'Decision: Context fencing should prevent recursive memory amplification.' },
      visibility: 'scope',
      app: 'contract-test',
    });

    await core.compile({ actor, scope: profile.scopes.workspace, use_llm: false });
    const firstRecall = await core.query({
      actor,
      scope: profile.scopes.workspace,
      query: 'recursive memory amplification',
      limit: 5,
      min_confidence: 0,
    });
    const fencedClaimId = firstRecall.results[0]?.claim?.id;
    assert.ok(fencedClaimId, 'initial compile should produce a claim to cite');
    const firstExplanation = await core.explain({ actor, claim_id: fencedClaimId });
    const firstSupport = firstExplanation.claim!.supporting_evidence;
    const firstSupportCount = firstSupport.length;
    assert.equal(firstSupportCount, 1);

    await core.observe({
      actor,
      type: 'decision',
      scope: profile.scopes.workspace,
      content: { format: 'text/plain', body: 'Decision: Context fencing should prevent recursive memory amplification.' },
      visibility: 'scope',
      app: 'contract-test',
      informed_by: [fencedClaimId],
    });

    await core.compile({ actor, scope: profile.scopes.workspace, use_llm: false });
    const secondRecall = await core.query({
      actor,
      scope: profile.scopes.workspace,
      query: 'recursive memory amplification',
      limit: 5,
      min_confidence: 0,
    });
    const fencedClaim = secondRecall.results.find(result => result.claim?.id === fencedClaimId)?.claim;
    assert.ok(fencedClaim);
    const secondExplanation = await core.explain({ actor, claim_id: fencedClaimId });
    assert.deepEqual(secondExplanation.claim!.supporting_evidence, firstSupport);
  } finally {
    await closeSmartwareCore();
  }
});

test('Memories backlinks and tag filters use explicit references only', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-backlinks-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const target = await app.inject({
      method: 'POST',
      url: '/pod/objects',
      payload: {
        actor_id: 'person-local',
        id: 'obj-target',
        kind: 'page',
        title: 'Project Atlas',
        content: { text: 'Target page.' },
        tags: ['product', 'roadmap'],
      },
    });
    assert.equal(target.statusCode, 200);

    const linked = await app.inject({
      method: 'POST',
      url: '/pod/objects',
      payload: {
        actor_id: 'person-local',
        id: 'obj-linked',
        kind: 'page',
        title: 'Launch Plan',
        content: { text: 'This document references [[Project Atlas]].' },
        tags: ['product', 'launch'],
        metadata: {
          references: {
            related_to: ['Project Atlas'],
            other_links: ['Project Atlas'],
          },
        },
      },
    });
    assert.equal(linked.statusCode, 200);

    const plainMention = await app.inject({
      method: 'POST',
      url: '/pod/objects',
      payload: {
        actor_id: 'person-local',
        id: 'obj-unlinked',
        kind: 'page',
        title: 'Loose Notes',
        content: { text: 'Project Atlas is mentioned here without a wikilink.' },
        tags: ['product'],
      },
    });
    assert.equal(plainMention.statusCode, 200);

    const backlinks = await app.inject({ method: 'GET', url: '/pod/memories/backlinks/obj-target' });
    assert.equal(backlinks.statusCode, 200);
    const backlinkBody = backlinks.json();
    assert.equal(backlinkBody.backlinks.related_to.length, 1);
    assert.equal(backlinkBody.backlinks.related_to[0].source_object_id, 'obj-linked');
    assert.equal(backlinkBody.backlinks.other_links.length, 1);

    const filtered = await app.inject({ method: 'GET', url: '/pod/objects?tags=product,launch' });
    assert.equal(filtered.statusCode, 200);
    assert.deepEqual(filtered.json().objects.map((object: { id: string }) => object.id), ['obj-linked']);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('PATCH /pod/objects updates tags and related references used by the memories inspector', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-object-patch-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const target = await app.inject({
      method: 'POST',
      url: '/pod/objects',
      payload: {
        actor_id: 'person-local',
        id: 'obj-target-inspector-patch',
        kind: 'page',
        title: 'Project Nova Inspector',
        content: { text: 'Target page.' },
      },
    });
    assert.equal(target.statusCode, 200);

    const source = await app.inject({
      method: 'POST',
      url: '/pod/objects',
      payload: {
        actor_id: 'person-local',
        id: 'obj-source-inspector-patch',
        kind: 'page',
        title: 'Inspector Launch Plan',
        content: { text: 'Initial draft.' },
        tags: ['inspector-draft'],
      },
    });
    assert.equal(source.statusCode, 200);

    const patched = await app.inject({
      method: 'PATCH',
      url: '/pod/objects/obj-source-inspector-patch',
      payload: {
        tags: ['inspector-product', 'inspector-launch'],
        metadata: {
          references: {
            related_to: ['Project Nova Inspector'],
          },
        },
      },
    });
    assert.equal(patched.statusCode, 200);
    assert.deepEqual(patched.json().object.tags, ['inspector-product', 'inspector-launch']);

    const backlinks = await app.inject({ method: 'GET', url: '/pod/memories/backlinks/obj-target-inspector-patch' });
    assert.equal(backlinks.statusCode, 200);
    assert.equal(backlinks.json().backlinks.related_to.length, 1);
    assert.equal(backlinks.json().backlinks.related_to[0].source_object_id, 'obj-source-inspector-patch');

    const filtered = await app.inject({ method: 'GET', url: '/pod/objects?tags=inspector-product,inspector-launch' });
    assert.equal(filtered.statusCode, 200);
    assert.deepEqual(filtered.json().objects.map((object: { id: string }) => object.id), ['obj-source-inspector-patch']);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('Folder import defaults to no reflection and separates explicit skills from possible skills', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-folder-import-'));
  const app = await buildApp(testEnv(dataDir), false);
  const folder = await mkdtemp(path.join(tmpdir(), 'coffee-pod-import-src-'));
  await mkdir(path.join(folder, 'docs'));
  await writeFile(path.join(folder, 'docs', 'explicit-skill.md'), `---
type: skill
name: Release Checklist
version: 1.0.0
description: Checks release state
permissions: read:docs write:tasks
---
# Release Checklist
`);
  await writeFile(path.join(folder, 'docs', 'possible-skill.md'), `---
name: Maybe Skill
version: 0.1.0
description: Looks like a skill but is missing the explicit marker
commands: deploy
---
# Maybe Skill
`);

  try {
    const imported = await app.inject({
      method: 'POST',
      url: '/pod/import/folder',
      payload: {
        actor_id: 'person-local',
        path: folder,
      },
    });
    assert.equal(imported.statusCode, 200);

    const list = await app.inject({ method: 'GET', url: '/pod/objects?source_app=local-folder' });
    assert.equal(list.statusCode, 200);
    const objects = list.json().objects as Array<{ processing_state: string; tags: string[] }>;
    assert.ok(objects.every((object) => object.processing_state === 'searchable'));

    const reviewSkills = await app.inject({ method: 'GET', url: '/pod/skills?status=review' });
    assert.equal(reviewSkills.statusCode, 200);
    assert.equal(reviewSkills.json().skills.length, 1);
    assert.equal(reviewSkills.json().skills[0].name, 'Release Checklist');
    assert.ok(reviewSkills.json().skills[0].review_facets);

    const possibleSkills = await app.inject({ method: 'GET', url: '/pod/skills?status=possible' });
    assert.equal(possibleSkills.statusCode, 200);
    assert.equal(possibleSkills.json().skills.length, 1);
    assert.equal(possibleSkills.json().skills[0].name, 'Maybe Skill');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('Memories sidebar and saved views expose the approved default buckets', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-memories-sidebar-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const sidebar = await app.inject({ method: 'GET', url: '/pod/memories/sidebar' });
    assert.equal(sidebar.statusCode, 200);
    const body = sidebar.json();
    assert.equal(body.core.length, 3);
    assert.ok(body.sources.some((source: { id: string }) => source.id === 'upload'));
    assert.ok(body.saved_views.some((view: { id: string }) => view.id === 'recently-modified'));

    const savedViews = await app.inject({ method: 'GET', url: '/pod/memories/saved-views' });
    assert.equal(savedViews.statusCode, 200);
    assert.equal(savedViews.json().saved_views.length, 3);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});
