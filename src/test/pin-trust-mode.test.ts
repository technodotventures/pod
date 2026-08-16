import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { defaultTrustMode } from '../security/trust-mode.js';
import { closeSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'pin-trust-test',
    podName: 'PIN Trust Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('defaultTrustMode is strict when only a PIN is configured', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-trust-'));
  const env = testEnv(dataDir);

  assert.equal(defaultTrustMode(env), 'open');
  await writeFile(path.join(dataDir, 'pin.json'), JSON.stringify({ hash: 'x', salt: 'y' }));
  assert.equal(defaultTrustMode(env), 'strict');
});

test('setting a PIN on a token-less pod immediately requires auth (no open bypass)', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-trust-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const set = await app.inject({
      method: 'POST',
      url: '/pod/pin/set',
      payload: { pin: '1234', hint: 'nums' },
    });
    assert.equal(set.statusCode, 200);

    const noAuth = await app.inject({
      method: 'POST',
      url: '/pod/pin/set',
      payload: { pin: '5678' },
    });
    assert.equal(noAuth.statusCode, 401);

    const verify = await app.inject({
      method: 'POST',
      url: '/pod/pin/verify',
      payload: { pin: '1234' },
    });
    assert.equal(verify.statusCode, 200);
    assert.equal(verify.json().success, true);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});
