#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildApp } from '../dist/app.js';
import { closeDb } from '../dist/pod/db.js';
import { closeSmartwareCore } from '../dist/smartware/core.js';

const startedAt = Date.now();
const rootDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-beta-acceptance-'));
const dataDir = path.join(rootDir, 'data');
const backupDir = path.join(rootDir, 'backups');
const ownerToken = 'cpod_owner_beta_acceptance_fixture_token';
const env = {
  host: '127.0.0.1',
  port: 0,
  dataDir,
  ownerId: undefined,
  podId: 'beta-acceptance',
  podName: 'Beta Acceptance Pod',
  apiToken: ownerToken,
  mcpClientEnabled: false,
  mcpDockerCommand: 'docker',
  mcpPortBase: 5300,
};

const app = await buildApp(env, false);
const podUrl = 'http://127.0.0.1:8732';

async function request(route, options = {}) {
  const response = await app.inject({
    method: options.method ?? 'GET',
    url: route,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${options.token ?? ownerToken}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    payload: options.body,
  });
  const text = response.payload;
  const body = text ? JSON.parse(text) : {};
  assert.ok(response.statusCode >= 200 && response.statusCode < 300,
    `${options.method ?? 'GET'} ${route}: ${response.statusCode} ${text}`);
  return body;
}

async function patchSettings(namespace, values) {
  return request(`/pod/settings/${namespace}`, { method: 'PATCH', body: { values } });
}

try {
  const health = await request('/health');
  assert.equal(health.ok, true);
  console.log('✓ Pod starts and answers health checks');

  const runtimeBefore = await request('/pod/runtime');
  assert.equal(runtimeBefore.onboarding_complete, false);
  await patchSettings('pod.identity', { user_slug: 'beta-tester' });
  await patchSettings('pod.reflect_cadence', { mode: 'manual_only', interval_seconds: null });
  await patchSettings('pod.capacity_profile', { profile: 'balanced' });
  await patchSettings('pod.adapters_profile', { profile: 'balanced' });
  await patchSettings('pod.location', { mode: 'local' });
  await patchSettings('pod.onboarding', {
    completed: true,
    version: 1,
    skipped: false,
    completed_at: new Date().toISOString(),
  });
  const runtimeAfter = await request('/pod/runtime');
  assert.equal(runtimeAfter.onboarding_complete, true);
  console.log('✓ First-run choices persist and release the onboarding gate');

  const memory = {
    actor_id: 'person-local',
    scope_alias: 'workspace',
    type: 'decision',
    content: 'Beta North Star: Pod gives every trusted agent one user-owned memory.',
    source_id: 'beta-acceptance-memory',
    operation_id: 'op_00000000000000000000000001',
  };
  const observed = await request('/pod/observe', { method: 'POST', body: memory });
  const replayed = await request('/pod/observe', { method: 'POST', body: memory });
  assert.equal(replayed.id, observed.id);

  await request('/pod/compile', {
    method: 'POST',
    body: {
      actor_id: 'person-local',
      scope_alias: 'workspace',
      use_llm: false,
      operation_id: 'op_00000000000000000000000002',
    },
  });
  const query = await request('/pod/query', {
    method: 'POST',
    body: {
      actor_id: 'person-local',
      scope_alias: 'workspace',
      query: 'Beta North Star user-owned memory',
      include_observations: true,
      use_llm: false,
      limit: 5,
    },
  });
  assert.ok(query.observations.some(item => item.snippet?.includes('Beta North Star')));
  console.log('✓ A user can remember, safely retry, compile, and retrieve useful memory');

  const paired = await request('/coffee/connect', {
    method: 'POST',
    body: {
      client_id: 'coffee-beta-acceptance',
      client_name: 'Coffee Beta Acceptance',
      pod_url: podUrl,
    },
  });
  assert.match(paired.client_token, /^cpod_/);
  const clientStatus = await request('/pod/status', { token: paired.client_token });
  assert.equal(clientStatus.pod.pod_id, env.podId);
  console.log('✓ Coffee receives a revocable, actor-bound client connection');

  const diagnostics = await request('/pod/diagnostics');
  assert.equal(diagnostics.privacy.memory_content_included, false);
  assert.equal(diagnostics.privacy.credentials_included, false);
  assert.equal(diagnostics.privacy.automatic_upload, false);
  console.log('✓ The owner can create a content-free support report');

  const backup = await request('/pod/export', {
    method: 'POST',
    body: { output_dir: backupDir, filename: 'beta-acceptance.tar.gz' },
  });
  assert.ok(backup.file_count > 0);
  assert.match(backup.warning, /private memory/);
  console.log('✓ The owner can create and verify a complete private backup');

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  assert.ok(Date.now() - startedAt < 5 * 60 * 1000, 'first-value workflow exceeded five minutes');
  console.log(`\nBeta acceptance passed in ${elapsedSeconds}s.`);
} finally {
  await app.close();
  await closeSmartwareCore();
  closeDb();
  await rm(rootDir, { recursive: true, force: true });
}

// Cleanup above closes the app, Smartware core and database, but a lingering
// handle keeps the process alive. Exit explicitly once acceptance has passed.
process.exit(0);
