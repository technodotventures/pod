import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readIntegrationConfig, writeIntegrationConfig } from '@technodotventures/smartware-connectors';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeDb } from '../pod/db.js';
import { closeSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'email-integrations-test',
    podName: 'Email Integrations Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('connections advertise one Email capability while preserving provider-specific status', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-email-integrations-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);

  try {
    const list = await app.inject({ method: 'GET', url: '/integrations' });
    assert.equal(list.statusCode, 200, list.payload);
    const integrations = list.json().integrations as Array<{ id: string; name: string }>;
    assert.equal(integrations.find(integration => integration.id === 'gmail')?.name, 'Email');
    assert.equal(integrations.some(integration => integration.id === 'icloud-mail'), false);

    const configured = await app.inject({
      method: 'POST',
      url: '/integrations/gmail/configure',
      payload: {
        filters: { include_inbox: true, include_sent: true, max_age_days: 90 },
        cadence: { mode: 'manual' },
        signal_config: { skip_observe_low: true },
        scope_routing: { mode: 'single' },
      },
    });
    assert.equal(configured.statusCode, 200, configured.payload);
    const googleConfig = await readIntegrationConfig(env, 'gmail');
    assert.deepEqual(googleConfig['filters'], { include_inbox: true, include_sent: true, max_age_days: 90 });
    assert.deepEqual(googleConfig['cadence'], { mode: 'manual' });

    await writeIntegrationConfig(env, 'icloud-mail', {
      account_email: 'owner@icloud.com',
      credential_stored: true,
      credential_store: 'macos_keychain',
      connected_at: '2026-07-20T01:00:00.000Z',
    });
    const status = await app.inject({ method: 'GET', url: '/integrations/gmail/status' });
    assert.equal(status.statusCode, 200, status.payload);
    assert.equal(status.json().status, 'active');
    assert.equal(status.json().email_providers.icloud.status, 'active');
    assert.equal(status.json().email_providers.icloud.account_email, 'owner@icloud.com');
  } finally {
    await app.close();
    closeDb();
    await closeSmartwareCore();
  }
});
