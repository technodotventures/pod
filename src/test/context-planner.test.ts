import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { decideContextRetrieval, planContextPacking } from 'smartware';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeSmartwareCore } from '../smartware/core.js';

const TEST_PACKING_POLICY = {
  lane_order: ['profile', 'lessons', 'conversations', 'claims'] as const,
  lane_weights: { profile: 20, lessons: 20, conversations: 25, claims: 35 },
  overflow_order: ['claims', 'conversations', 'lessons', 'profile'] as const,
};

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'context-planner-test',
    podName: 'Context Planner Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('automatic retrieval skips only clearly self-contained requests', () => {
  assert.deepEqual(decideContextRetrieval('auto', 'hello!', false), {
    mode: 'auto',
    decision: 'skip',
    reason: 'self_contained_greeting',
  });
  assert.deepEqual(decideContextRetrieval('auto', "what's 12 × 8?", false), {
    mode: 'auto',
    decision: 'skip',
    reason: 'self_contained_arithmetic',
  });
  assert.equal(
    decideContextRetrieval('auto', 'What is the Pod release deadline?', false).decision,
    'retrieve',
  );
  assert.equal(decideContextRetrieval('auto', 'hello', true).decision, 'retrieve');
  assert.equal(decideContextRetrieval('always', 'hello', false).decision, 'retrieve');
  assert.equal(decideContextRetrieval('never', 'release deadline', true).decision, 'skip');
});

test('lane-aware packing protects every populated evidence lane from starvation', () => {
  const plan = planContextPacking({
    profile: Array(10).fill(12),
    lessons: [12, 12],
    conversations: [12, 12],
    claims: [12, 12, 12, 12],
  }, 100, TEST_PACKING_POLICY);

  assert.ok(plan.used_tokens <= 100);
  assert.ok(plan.selected.profile.length > 0);
  assert.ok(plan.selected.lessons.length > 0);
  assert.ok(plan.selected.conversations.length > 0);
  assert.ok(plan.selected.claims.length > 0);
  assert.ok(plan.selected.profile.length < 10);
});

test('unused lane budgets are redistributed to lanes that have evidence', () => {
  const plan = planContextPacking({
    profile: [],
    lessons: [],
    conversations: [],
    claims: [20, 20, 20, 20, 20],
  }, 100, TEST_PACKING_POLICY);

  assert.deepEqual(plan.selected.claims, [0, 1, 2, 3, 4]);
  assert.equal(plan.used_tokens, 100);
});

test('context endpoint reports gate and packing telemetry when retrieval is skipped', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-context-planner-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/pod/context',
      payload: { query: "what's 12 × 8?", retrieval_mode: 'auto' },
    });
    assert.equal(response.statusCode, 200, response.payload);
    assert.deepEqual(response.json().retrieval.gate, {
      mode: 'auto',
      decision: 'skip',
      reason: 'self_contained_arithmetic',
    });
    assert.equal(typeof response.json().retrieval.duration_ms, 'number');
    assert.deepEqual(response.json().retrieval.packing.packed_counts, {
      profile: 0,
      lessons: 0,
      conversations: 0,
      claims: 0,
    });
    assert.deepEqual(response.json().evidence, []);

    const invalid = await app.inject({
      method: 'POST',
      url: '/pod/context',
      payload: { query: 'anything', retrieval_mode: 'sometimes' },
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error, 'invalid_retrieval_mode');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});
