// ACCESS conformance tests (PR-5 / A4). Targets AC-01..AC-06 from the
// Conformance Test Spec v0.1.1.
//
// AC-05 (cross-scope deny) and AC-06 (user-authored REVISE by agent) need
// scope-scoped grants and user-authored claims, both of which are wired
// in later PRs (A4-alias-map for scope_limits, B1+B5 for user-authored
// content). They're kept here as skipped fixtures.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { SmartwareCore } from 'smartware';
import { getPodProfile, getSmartwareCore } from '../../smartware/core.js';
import {
  buildConformanceApp,
  conformanceEnv,
  fakeOperationId,
} from './harness.js';

async function postAccess(
  app: Awaited<ReturnType<typeof buildConformanceApp>>['app'],
  payload: {
    requester: { id: string; type?: 'person' | 'agent' | 'system' };
    operation: string;
    scope: string;
  },
): Promise<{ decision: 'allow' | 'deny'; code?: string; reason?: string }> {
  const response = await app.inject({ method: 'POST', url: '/pod/access', payload });
  assert.equal(response.statusCode, 200, `ACCESS check failed: ${response.payload}`);
  return response.json() as { decision: 'allow' | 'deny'; code?: string; reason?: string };
}

test('AC-01: Pod owner is allowed', async () => {
  const { app, teardown } = await buildConformanceApp({ ownerId: 'user:test-owner' });
  try {
    const result = await postAccess(app, {
      requester: { id: 'user:test-owner', type: 'person' },
      operation: 'observe',
      scope: 'pod/conformance-test/personal',
    });
    assert.equal(result.decision, 'allow', `owner should be allowed; got: ${JSON.stringify(result)}`);
  } finally {
    await teardown();
  }
});

test('AC-02: registered agent within capability is allowed', async () => {
  const { app, teardown } = await buildConformanceApp();
  try {
    const result = await postAccess(app, {
      requester: { id: 'agent:test', type: 'agent' },
      operation: 'observe',
      scope: 'pod/conformance-test/personal',
    });
    assert.equal(result.decision, 'allow', `registered actor should be allowed; got: ${JSON.stringify(result)}`);
  } finally {
    await teardown();
  }
});

test('AC-04: unregistered actor is denied with actor_unregistered', async () => {
  const { app, teardown } = await buildConformanceApp();
  try {
    const result = await postAccess(app, {
      requester: { id: 'agent:not-registered', type: 'agent' },
      operation: 'observe',
      scope: 'pod/conformance-test/personal',
    });
    assert.equal(result.decision, 'deny');
    assert.equal(result.code, 'actor_unregistered', `expected actor_unregistered, got: ${JSON.stringify(result)}`);
  } finally {
    await teardown();
  }
});

test('AC-03: registered actor outside their capability is denied', async () => {
  // The conformance harness seeds agent:test with the standard
  // ensureTrustedClientGrant capabilities (observe/query/compile/correct/read
  // but NOT forget). FORGET on a known scope should deny.
  const { app, teardown } = await buildConformanceApp();
  try {
    const result = await postAccess(app, {
      requester: { id: 'agent:test', type: 'agent' },
      operation: 'forget',
      scope: 'pod/conformance-test/personal',
    });
    assert.equal(result.decision, 'deny');
    assert.equal(result.code, 'forbidden', `expected forbidden, got: ${JSON.stringify(result)}`);
  } finally {
    await teardown();
  }
});

test('AC-05: registered actor outside scope_limits is denied', async () => {
  const { app, dataDir, teardown } = await buildConformanceApp();
  try {
    const env = conformanceEnv(dataDir);
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    core.ensureTrustedClientGrant('agent:scoped', 'agent', [profile.scopes.personal]);

    const result = await postAccess(app, {
      requester: { id: 'agent:scoped', type: 'agent' },
      operation: 'observe',
      scope: profile.scopes.workspace,
    });
    assert.equal(result.decision, 'deny');
    assert.equal(result.code, 'forbidden');
  } finally {
    await teardown();
  }
});

test('A4: registry.md markdown projection is emitted on Pod open', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-registry-md-'));
  const core = await SmartwareCore.open({ dataDir, ownerId: 'user:test-owner' });
  try {
    const registryPath = path.join(dataDir, 'agents', 'registry.md');
    const content = await readFile(registryPath, 'utf-8');
    assert.match(content, /# Agent Registry/);
    assert.match(content, /\| actor_id \| kind \| owner \| capabilities \| added \| notes \|/);
    assert.match(content, /\| user:test-owner \| human \| self \| all \| - \| Pod owner \|/);
  } finally {
    core.close();
  }
});

test('A4: registry.md updates when a new trusted grant is added', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-registry-md2-'));
  const core = await SmartwareCore.open({ dataDir, ownerId: 'user:test-owner' });
  try {
    core.ensureTrustedClientGrant('agent:freshly-added', 'agent', ['pod/test/personal']);
    const content = await readFile(path.join(dataDir, 'agents', 'registry.md'), 'utf-8');
    assert.match(content, /agent:freshly-added/);
    assert.match(content, /\bagent\b/);
  } finally {
    core.close();
  }
});

// Sanity check that operation_id pattern recognition (PR-3) and ActorId
// pattern recognition (PR-5) are both available from the substrate barrel.
test('A4: ACTOR_ID_PATTERN matches spec-conformant ids and rejects legacy ones', async () => {
  const { ACTOR_ID_PATTERN, isSpecConformantActorId } = await import('smartware');
  assert.equal(isSpecConformantActorId('user:stevie'), true);
  assert.equal(isSpecConformantActorId('sidecar:slack'), true);
  assert.equal(isSpecConformantActorId('agent:coffee-research'), true);
  assert.equal(isSpecConformantActorId('substrate:coffee'), true);
  // Legacy shapes used in the codebase today — these are alias-map territory.
  assert.equal(isSpecConformantActorId('person-local'), false);
  assert.equal(isSpecConformantActorId('coffee:CLIENT-ID'), false); // uppercase not allowed
  assert.equal(ACTOR_ID_PATTERN.test('agent:Test'), false); // uppercase not allowed
});

// Avoid unused-import lint
void fakeOperationId;
