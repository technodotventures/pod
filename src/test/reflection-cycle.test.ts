import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { isReflectAutoTerminalReceipt, readAllOpLogEntries } from 'smartware';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { runDueReflectionCycle } from '../services/reflection-cycle.js';
import { closeSmartwareCore, getSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: 'user:owner',
    podId: 'reflection-test',
    podName: 'Reflection Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('due reflection runs across Pod data spaces and advances its cadence', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-reflection-cycle-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);

  try {
    const configured = await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.reflect_cadence',
      payload: {
        values: {
          mode: 'every_6h',
          interval_seconds: 21_600,
          next_reflect_after: '2020-01-01T00:00:00.000Z',
        },
      },
    });
    assert.equal(configured.statusCode, 200, configured.payload);

    const now = new Date('2026-07-21T00:00:00.000Z');
    const result = await runDueReflectionCycle(env, now);
    assert.equal(result.status, 'completed');
    if (result.status !== 'completed') return;
    assert.equal(result.result.mode, 'scheduled');
    assert.equal(result.result.use_llm, false);
    assert.ok(result.result.scopes.length >= 2);
    assert.equal(result.result.cadence.last_reflected_at, now.toISOString());
    assert.equal(
      result.result.cadence.next_reflect_after,
      new Date(now.getTime() + 21_600_000).toISOString(),
    );
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('reflection checkpoints terminal no-op observations exactly once', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-reflection-terminal-'));
  const env = testEnv(dataDir);
  const core = await getSmartwareCore(env);
  const profile = core.createPodProfile(env.podId, env.podName);
  const actor = { type: 'person' as const, id: profile.owner_id, display_name: 'Pod owner' };

  try {
    const short = await core.observe({
      actor,
      type: 'message',
      scope: profile.scopes.workspace,
      content: { format: 'text/plain', body: 'Hi' },
      source_id: 'short-reflection-fixture',
    });
    const noClaims = await core.observe({
      actor,
      type: 'message',
      scope: profile.scopes.workspace,
      content: { format: 'text/plain', body: 'A plain sentence with nothing structured to extract.' },
      source_id: 'no-claims-reflection-fixture',
    });

    await core.compile({ actor, scope: profile.scopes.workspace, use_llm: false });
    await core.compile({ actor, scope: profile.scopes.workspace, use_llm: false });

    const terminalEntries = [...readAllOpLogEntries(core.opsDir)]
      .filter(isReflectAutoTerminalReceipt)
      .filter(entry => entry.details.observation_id === short.id
        || entry.details.observation_id === noClaims.id);

    assert.equal(terminalEntries.length, 2);
    assert.deepEqual(
      terminalEntries.map(entry => [entry.details.observation_id, entry.details.outcome]).sort(),
      [[noClaims.id, 'no_claims'], [short.id, 'ignored_short_content']].sort(),
    );
  } finally {
    await closeSmartwareCore();
  }
});
