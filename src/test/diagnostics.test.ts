import assert from 'node:assert/strict';
import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeDb } from '../pod/db.js';
import {
  assertDiagnosticsSafe,
  recordDiagnosticRequestError,
  type DiagnosticReport,
} from '../services/diagnostics.js';
import { closeSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'diagnostics-test',
    podName: 'Diagnostics Test Pod',
    apiToken: 'cpod_owner_diagnostics_fixture_token',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('owner can preview actionable diagnostics without leaking memory, identifiers, paths, or secrets', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-diagnostics-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);
  const auth = { authorization: `Bearer ${env.apiToken}` };
  const memorySentinel = 'PRIVATE_MEMORY_SENTINEL_7c83d1';
  const errorSentinel = 'PRIVATE_ERROR_SENTINEL_c3189a';
  const integrationSecret = 'sk-private-diagnostics-secret-123456789';
  const observeOperationId = 'op_01ARZ3NDEKTSV4RRFFQ69G5FAV';
  const malformedIntentId = 'op_01ARZ3NDEKTSV4RRFFQ69G5FAW';

  try {
    const blocked = await app.inject({ method: 'GET', url: '/pod/diagnostics' });
    assert.equal(blocked.statusCode, 401);

    const observed = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      headers: auth,
      payload: {
        actor_id: 'person-local',
        scope_alias: 'workspace',
        type: 'decision',
        content: memorySentinel,
        operation_id: observeOperationId,
      },
    });
    assert.equal(observed.statusCode, 200, observed.payload);

    const failedRequest = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      headers: auth,
      payload: { content: errorSentinel, operation_id: 'op_01ARZ3NDEKTSV4RRFFQ69G5FAX' },
    });
    assert.equal(failedRequest.statusCode, 500);

    const integrationsDir = path.join(dataDir, 'integrations');
    await mkdir(integrationsDir, { recursive: true });
    await writeFile(
      path.join(integrationsDir, 'openai.json'),
      `${JSON.stringify({ api_key: integrationSecret, configured_at: new Date().toISOString() })}\n`,
      { mode: 0o600 },
    );

    const intentsDir = path.join(dataDir, 'operations', 'intents');
    await mkdir(intentsDir, { recursive: true });
    await writeFile(
      path.join(intentsDir, `${malformedIntentId}.json`),
      `${JSON.stringify({ operation_id: malformedIntentId, content: memorySentinel })}\n`,
      { mode: 0o600 },
    );

    const recordedError = new Error(errorSentinel) as Error & { code?: string };
    recordedError.code = 'ERR_DIAGNOSTIC_FIXTURE';
    await recordDiagnosticRequestError(dataDir, {
      method: 'GET',
      route: '/pod/objects/:id',
      statusCode: 500,
      error: recordedError,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/pod/diagnostics',
      headers: auth,
    });
    assert.equal(response.statusCode, 200, response.payload);
    assert.equal(response.headers['cache-control'], 'no-store');

    const report = response.json() as DiagnosticReport;
    assert.equal(report.schema_version, 'coffee-pod-diagnostics/1');
    assert.equal(report.privacy.memory_content_included, false);
    assert.equal(report.privacy.user_identifiers_included, false);
    assert.equal(report.privacy.credentials_included, false);
    assert.equal(report.privacy.raw_logs_included, false);
    assert.equal(report.privacy.automatic_upload, false);
    assert.equal(report.pod_database.quick_check, 'ok');
    assert.equal(report.smartware.available, true);
    assert.equal(report.smartware.layer0.total, 1);
    assert.equal(report.operations.total, 1);
    assert.equal(report.operations.by_type['observe'], 1);
    assert.equal(report.operations.intent_records, 1);
    assert.equal(report.operations.malformed_intent_records, 1);
    assert.equal(report.integrations.find(item => item.id === 'openai')?.status, 'active');
    assert.equal(report.recent_errors.events.length, 2);
    assert.ok(report.recent_errors.events.some(event => event.route === '/pod/observe'));
    assert.ok(report.recent_errors.events.some(event => event.error_code === 'ERR_DIAGNOSTIC_FIXTURE'));
    assert.ok(report.summary.issue_codes.includes('operation_intents_malformed'));
    assert.ok(report.summary.issue_codes.includes('recent_request_errors'));
    assertDiagnosticsSafe(report);

    const serialized = JSON.stringify(report);
    for (const forbidden of [
      memorySentinel,
      errorSentinel,
      integrationSecret,
      env.apiToken!,
      dataDir,
      'person-local',
      observeOperationId,
      malformedIntentId,
    ]) {
      assert.ok(!serialized.includes(forbidden), `diagnostics leaked forbidden value: ${forbidden}`);
    }

    const diagnosticFile = await stat(path.join(dataDir, 'diagnostics', 'events.jsonl'));
    assert.equal(diagnosticFile.mode & 0o777, 0o600);

    const paired = await app.inject({
      method: 'POST',
      url: '/coffee/connect',
      headers: auth,
      payload: {
        client_id: 'diagnostics-client',
        client_name: 'Diagnostics Client',
        pod_url: 'http://127.0.0.1:8732',
      },
    });
    assert.equal(paired.statusCode, 200, paired.payload);
    const clientTelemetry = await app.inject({
      method: 'GET',
      url: '/pod/telemetry',
      headers: { authorization: `Bearer ${paired.json().client_token}` },
    });
    assert.equal(clientTelemetry.statusCode, 403, 'actor-level telemetry must remain owner-only');
  } finally {
    await app.close();
    await closeSmartwareCore();
    closeDb();
  }
});

test('diagnostics privacy scanner fails closed on prohibited keys, secrets, and user paths', () => {
  assert.throws(
    () => assertDiagnosticsSafe({ content: 'not allowed' }),
    /privacy check rejected key/,
  );
  assert.throws(
    () => assertDiagnosticsSafe({ safe_label: 'Bearer cpod_secret_123456789' }),
    /privacy check rejected value/,
  );
  assert.throws(
    () => assertDiagnosticsSafe({ safe_label: '/Users/example/private/file.txt' }),
    /privacy check rejected value/,
  );
});
