import { existsSync } from 'node:fs';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { startDreamScheduler } from '../services/dream-cycle.js';
import { closeSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: 'user:owner',
    podId: 'dream-test',
    podName: 'Dream Test Pod',
    apiToken: 'owner-token',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('manual Dream uses the shared, experience-connected Dream cycle', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-dream-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/pod/dream',
      payload: { actor_id: 'user:owner', scope_alias: 'workspace' },
    });
    assert.equal(unauthenticated.statusCode, 401);

    const response = await app.inject({
      method: 'POST',
      url: '/pod/dream',
      headers: { authorization: 'Bearer owner-token' },
      payload: { actor_id: 'user:owner', scope_alias: 'workspace' },
    });
    assert.equal(response.statusCode, 200, response.payload);
    const body = response.json() as {
      phases: Array<{ canonical_writes: string[] }>;
      report_path: string;
      mode: string;
      scheduled: boolean;
      canonical_memory_writes_enabled: boolean;
      experience: {
        scopes_refreshed: number;
        lesson_count: number;
      };
    };
    assert.equal(body.mode, 'manual');
    assert.equal(body.scheduled, false);
    assert.equal(body.canonical_memory_writes_enabled, false);
    assert.equal(body.phases.length, 6);
    assert.equal(body.phases.every(phase => phase.canonical_writes.length === 0), true);
    assert.equal(existsSync(body.report_path), true);
    assert.deepEqual(body.experience, {
      scopes_refreshed: 1,
      lesson_count: 0,
    });

    const activity = await app.inject({
      method: 'GET',
      url: '/pod/events?process=dream&limit=10',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(activity.statusCode, 200, activity.payload);
    assert.equal(activity.json().events.length, 1);
    assert.equal(activity.json().events[0].process, 'dream');

    const persisted = JSON.parse(await readFile(body.report_path, 'utf8')) as { phases: unknown[] };
    assert.equal(persisted.phases.length, 6);

    const capabilities = await app.inject({
      method: 'GET',
      url: '/pod/capabilities',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(capabilities.statusCode, 200, capabilities.payload);
    assert.deepEqual(capabilities.json().capabilities.maintenance, [
      'dream_manual',
      'dream_scheduled',
      'experience_consolidation',
      'conversation_consolidation',
    ]);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('Pod-wide maintenance updates its status after a manual run', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-dream-all-scopes-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/pod/dream-cycle',
      headers: { authorization: 'Bearer owner-token' },
      payload: { actor_id: 'user:owner' },
    });
    assert.equal(response.statusCode, 200, response.payload);
    const body = response.json() as {
      mode: string;
      runs: Array<{ scope: string }>;
      cadence: { last_dreamed_at: string | null; next_dream_after: string | null };
    };
    assert.equal(body.mode, 'manual');
    assert.ok(body.runs.length > 0);
    assert.ok(body.cadence.last_dreamed_at);
    assert.ok(body.cadence.next_dream_after);

    const settings = await app.inject({
      method: 'GET',
      url: '/pod/settings/pod.dream_cadence',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(settings.statusCode, 200, settings.payload);
    assert.equal(settings.json().values.last_dreamed_at, body.cadence.last_dreamed_at);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('scheduled Dream runs when due and advances its persisted cadence', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-dream-scheduled-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);
  let stopFastScheduler: (() => void) | undefined;

  try {
    const initial = await app.inject({
      method: 'GET',
      url: '/pod/settings/pod.dream_cadence',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(initial.statusCode, 200, initial.payload);
    assert.equal(initial.json().values.mode, 'daily');
    assert.equal(typeof initial.json().values.next_dream_after, 'string');

    const configured = await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.dream_cadence',
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        values: {
          mode: 'daily',
          interval_seconds: 3600,
          next_dream_after: '2020-01-01T00:00:00.000Z',
        },
      },
    });
    assert.equal(configured.statusCode, 200, configured.payload);

    stopFastScheduler = startDreamScheduler(app, env, 10);
    let events: Array<{ title: string; content: { mode?: string } }> = [];
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      const activity = await app.inject({
        method: 'GET',
        url: '/pod/events?process=dream&limit=10',
        headers: { authorization: 'Bearer owner-token' },
      });
      assert.equal(activity.statusCode, 200, activity.payload);
      events = activity.json().events;
      if (events.some(event => event.content?.mode === 'scheduled')) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    assert.equal(events.some(event => event.title === 'Scheduled Dream completed'), true);
    const advanced = await app.inject({
      method: 'GET',
      url: '/pod/settings/pod.dream_cadence',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(advanced.statusCode, 200, advanced.payload);
    assert.equal(typeof advanced.json().values.last_dreamed_at, 'string');
    assert.ok(Date.parse(advanced.json().values.next_dream_after) > Date.parse(advanced.json().values.last_dreamed_at));
  } finally {
    stopFastScheduler?.();
    await app.close();
    await closeSmartwareCore();
  }
});
