import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeDb } from '../pod/db.js';
import {
  EARLY_HARNESS_ADAPTERS,
  harnessProfileActorId,
  readHarnessProfileMetadata,
} from '../services/harness-adapters.js';
import { closeSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'harness-adapters-test',
    podName: 'Harness Adapters Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('early adapter cohort includes the portable CLI targets and profile-aware harnesses', () => {
  const ids = new Set(EARLY_HARNESS_ADAPTERS.map(adapter => adapter.id));
  assert.ok(ids.has('claude-code'));
  assert.ok(ids.has('codex'));
  assert.ok(ids.has('hermes'));
  assert.ok(ids.has('openclaw'));
  assert.ok(ids.has('kimi-code'));
  assert.ok(ids.has('deerflow'));
  assert.notEqual(harnessProfileActorId('hermes', 'work'), harnessProfileActorId('hermes', 'personal'));
  assert.equal(harnessProfileActorId('hermes', ' Work '), harnessProfileActorId('hermes', 'work'));
  assert.throws(() => harnessProfileActorId('hermes', '../work'));
});

test('harness profiles receive stable, independent Pod identities and keys', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-harness-profile-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const catalog = await app.inject({ method: 'GET', url: '/pod/harnesses' });
    assert.equal(catalog.statusCode, 200);
    assert.ok(catalog.json().adapters.some((adapter: { id: string }) => adapter.id === 'openclaw'));

    const createWork = await app.inject({
      method: 'POST',
      url: '/pod/harnesses/hermes/profiles',
      payload: {
        profile_id: 'work',
        profile_label: 'Work',
        name: 'Hermes Work',
        access_mode: 'all',
        scopes: [],
      },
    });
    assert.equal(createWork.statusCode, 200);
    const first = createWork.json().agent as { id: string; auth_token: string; metadata: Record<string, unknown> };
    assert.equal(first.id, harnessProfileActorId('hermes', 'work'));
    assert.deepEqual(readHarnessProfileMetadata(first.metadata), {
      harness_id: 'hermes',
      harness_profile_id: 'work',
      harness_profile_label: 'Work',
      adapter_contract: 'v1',
    });

    const updateWork = await app.inject({
      method: 'POST',
      url: '/pod/harnesses/hermes/profiles',
      payload: { profile_id: 'WORK', name: 'Hermes for Work', status: 'active' },
    });
    assert.equal(updateWork.statusCode, 200);
    assert.equal(updateWork.json().agent.id, first.id);
    assert.equal(updateWork.json().agent.auth_token, first.auth_token);

    const createPersonal = await app.inject({
      method: 'POST',
      url: '/pod/harnesses/hermes/profiles',
      payload: { profile_id: 'personal', name: 'Hermes Personal', access_mode: 'all', scopes: [] },
    });
    assert.equal(createPersonal.statusCode, 200);
    assert.notEqual(createPersonal.json().agent.id, first.id);
    assert.notEqual(createPersonal.json().agent.auth_token, first.auth_token);

    const listed = await app.inject({ method: 'GET', url: '/pod/harnesses' });
    const hermes = listed.json().adapters.find((adapter: { id: string }) => adapter.id === 'hermes');
    assert.deepEqual(hermes.profiles.map((profile: { profile_id: string }) => profile.profile_id), ['work', 'personal']);
    assert.equal('auth_token' in hermes.profiles[0], false);
  } finally {
    await app.close();
    await closeSmartwareCore();
    closeDb();
  }
});
