import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string, overrides: Partial<CoffeePodEnv> = {}): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'pin-test',
    podName: 'PIN Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
    ...overrides,
  };
}

test('PIN routes keep verification public and setup owner-only', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-pin-'));
  const app = await buildApp(testEnv(dataDir, { apiToken: 'owner-token' }), false);

  try {
    const initial = await app.inject({ method: 'GET', url: '/pod/pin/status' });
    assert.equal(initial.statusCode, 200);
    assert.deepEqual(initial.json(), { has_pin: false, pin_length: null, hint: null, show_hint: false });

    const blockedSet = await app.inject({
      method: 'POST',
      url: '/pod/pin/set',
      payload: { pin: '123456', hint: 'first six' },
    });
    assert.equal(blockedSet.statusCode, 401);

    const set = await app.inject({
      method: 'POST',
      url: '/pod/pin/set',
      headers: { authorization: 'Bearer owner-token' },
      payload: { pin: '123456', hint: 'first six' },
    });
    assert.equal(set.statusCode, 200);
    assert.equal(set.json().success, true);

    const pinFile = path.join(dataDir, 'pin.json');
    const stored = JSON.parse(await readFile(pinFile, 'utf-8')) as { algorithm?: string; hash: string; salt: string; length?: number; hint?: string };
    assert.notEqual(stored.hash, '123456');
    assert.equal(stored.algorithm, 'scrypt');
    assert.equal(stored.length, 6);
    assert.equal(stored.hint, 'first six');
    assert.equal((await stat(pinFile)).mode & 0o777, 0o600);

    const configured = await app.inject({ method: 'GET', url: '/pod/pin/status' });
    assert.deepEqual(configured.json(), { has_pin: true, pin_length: 6, hint: null, show_hint: false });

    const badShape = await app.inject({
      method: 'POST',
      url: '/pod/pin/verify',
      payload: { pin: 'abcd' },
    });
    assert.equal(badShape.statusCode, 400);

    for (let i = 0; i < 2; i += 1) {
      const wrong = await app.inject({
        method: 'POST',
        url: '/pod/pin/verify',
        payload: { pin: '999999' },
      });
      assert.equal(wrong.statusCode, 200);
      assert.equal(wrong.json().success, false);
      assert.equal(wrong.json().show_hint, false);
    }

    const wrongWithHint = await app.inject({
      method: 'POST',
      url: '/pod/pin/verify',
      payload: { pin: '999999' },
    });
    assert.equal(wrongWithHint.statusCode, 200);
    assert.equal(wrongWithHint.json().success, false);
    assert.equal(wrongWithHint.json().show_hint, true);
    assert.equal(wrongWithHint.json().hint, 'first six');

    const verify = await app.inject({
      method: 'POST',
      url: '/pod/pin/verify',
      payload: { pin: '123456' },
    });
    assert.equal(verify.statusCode, 200);
    assert.equal(verify.json().success, true);

    const blockedDelete = await app.inject({
      method: 'DELETE',
      url: '/pod/pin',
      payload: { pin: '123456' },
    });
    assert.equal(blockedDelete.statusCode, 401);

    const wrongDelete = await app.inject({
      method: 'DELETE',
      url: '/pod/pin',
      headers: { authorization: 'Bearer owner-token' },
      payload: { pin: '999999' },
    });
    assert.equal(wrongDelete.statusCode, 403);

    const deleted = await app.inject({
      method: 'DELETE',
      url: '/pod/pin',
      headers: { authorization: 'Bearer owner-token' },
      payload: { pin: '123456' },
    });
    assert.equal(deleted.statusCode, 200);
    assert.equal(deleted.json().success, true);

    const finalStatus = await app.inject({ method: 'GET', url: '/pod/pin/status' });
    assert.deepEqual(finalStatus.json(), { has_pin: false, pin_length: null, hint: null, show_hint: false });

    const legacySalt = 'legacy-salt';
    const legacyHash = createHash('sha256').update(`1234:${legacySalt}`).digest('hex');
    await writeFile(pinFile, JSON.stringify({
      hash: legacyHash,
      salt: legacySalt,
      attempts: 0,
      created_at: new Date().toISOString(),
    }));
    const legacyStatus = await app.inject({ method: 'GET', url: '/pod/pin/status' });
    assert.equal(legacyStatus.json().pin_length, 4);

    const legacyVerify = await app.inject({
      method: 'POST',
      url: '/pod/pin/verify',
      payload: { pin: '1234' },
    });
    assert.equal(legacyVerify.statusCode, 200);
    assert.equal(legacyVerify.json().success, true);

    const migrated = JSON.parse(await readFile(pinFile, 'utf-8')) as { algorithm?: string; hash: string; salt: string; length?: number };
    assert.equal(migrated.algorithm, 'scrypt');
    assert.equal(migrated.length, 4);
    assert.notEqual(migrated.hash, legacyHash);
    assert.notEqual(migrated.salt, legacySalt);
    assert.equal((await stat(pinFile)).mode & 0o777, 0o600);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});
