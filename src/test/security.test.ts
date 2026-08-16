/**
 * Security regression tests for the Mac beta hardening pass.
 * See docs/security/beta-review.md for the corresponding finding IDs.
 *
 * Every test boots the app with a known apiToken so the global gate is
 * active. Public routes (PIN, OAuth callback, /health, /docs) are explicitly
 * verified to remain accessible without auth.
 */
import { chmod, mkdtemp, stat as fsStat, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
    podId: 'founder-test',
    podName: 'Founder Test Pod',
    apiToken: 'sec-test-token',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
    ...overrides,
  };
}

test('CP-SEC-001 · authenticated routes refuse calls without a token', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-sec-auth-'));
  const app = await buildApp(testEnv(dataDir), false);
  try {
    for (const route of ['/pod/capabilities', '/pod/objects', '/pod/events', '/pod/grants']) {
      const res = await app.inject({ method: 'GET', url: route });
      assert.equal(res.statusCode, 401, `${route} should require auth, got ${res.statusCode}`);
    }
    // Mutations that previously had no explicit guard now demand owner-level
    // auth even with a valid client token.
    for (const route of ['/pod/collections/inbox', '/pod/objects/x', '/pod/memories/saved-views/x']) {
      const res = await app.inject({ method: 'DELETE', url: route });
      assert.equal(res.statusCode, 401, `${route} should require auth`);
    }
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('CP-SEC-001 · public routes remain accessible without a token', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-sec-public-'));
  const app = await buildApp(testEnv(dataDir), false);
  try {
    for (const route of ['/health', '/pod/pin/status']) {
      const res = await app.inject({ method: 'GET', url: route });
      assert.equal(res.statusCode, 200, `${route} should be public, got ${res.statusCode}`);
    }
    const docs = await app.inject({ method: 'GET', url: '/docs/' });
    assert.equal(docs.statusCode, 200, `/docs/ should be public, got ${docs.statusCode}`);
    assert.match(docs.headers['content-type'] ?? '', /^text\/html/);

    for (const route of ['/assets/missing.js', '/brand/missing.png', '/fonts/missing.woff2']) {
      const res = await app.inject({ method: 'GET', url: route });
      assert.notEqual(res.statusCode, 401, `${route} static assets must not require bearer auth`);
    }
    for (const route of ['/assets/%2e%2e/package.json', '/brand/..%2fpackage.json']) {
      const res = await app.inject({ method: 'GET', url: route });
      assert.notEqual(res.statusCode, 200, `${route} must not escape its static root`);
    }
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('CP-SEC-013 · Pod corrects permissive local data and credential permissions', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'coffee-pod-sec-permissions-'));
  const dataDir = path.join(parent, 'data');
  const integrationsDir = path.join(dataDir, 'integrations');
  const googleConfig = path.join(integrationsDir, 'google-drive.json');
  await mkdir(integrationsDir, { recursive: true });
  await writeFile(googleConfig, '{}\n');
  await chmod(dataDir, 0o755);
  await chmod(integrationsDir, 0o755);
  await chmod(googleConfig, 0o644);

  const app = await buildApp(testEnv(dataDir), false);
  try {
    const configured = await app.inject({
      method: 'POST',
      url: '/integrations/google-drive/configure',
      headers: { authorization: 'Bearer sec-test-token' },
      payload: { client_id: 'id.apps.googleusercontent.com', client_secret: 'secret' },
    });
    assert.equal(configured.statusCode, 200);
    assert.equal((await fsStat(dataDir)).mode & 0o777, 0o700);
    assert.equal((await fsStat(integrationsDir)).mode & 0o777, 0o700);
    assert.equal((await fsStat(googleConfig)).mode & 0o777, 0o600);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('CP-SEC-003 · OAuth callback rejects mismatched state', async () => {
  // Duplicated lightly from pod-flow.test.ts so the security suite stands
  // alone when run in isolation. The pod-flow version is the primary.
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-sec-oauth-'));
  const app = await buildApp(testEnv(dataDir), false);
  try {
    const configure = await app.inject({
      method: 'POST',
      url: '/integrations/google-drive/configure',
      headers: { authorization: 'Bearer sec-test-token' },
      payload: { client_id: 'id.apps.googleusercontent.com', client_secret: 'secret' },
    });
    assert.equal(configure.statusCode, 200);

    const callback = await app.inject({
      method: 'GET',
      url: '/integrations/google-drive/callback?code=injected&state=attacker',
    });
    assert.equal(callback.statusCode, 400);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('CP-SEC-004 · registry proxy rejects path traversal', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-sec-proxy-'));
  const app = await buildApp(testEnv(dataDir), false);
  try {
    for (const evil of ['../admin', '..%2Fadmin', 'foo/../../bar', 'a\\b']) {
      const res = await app.inject({
        method: 'GET',
        url: `/pod/skills/registry/clawhub/${encodeURIComponent(evil)}`,
        headers: { authorization: 'Bearer sec-test-token' },
      });
      assert.equal(res.statusCode, 400, `path ${evil} should be rejected`);
    }
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('CP-SEC-005 · client-token store is written 0o600', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-sec-clients-'));
  const app = await buildApp(testEnv(dataDir), false);
  try {
    const connect = await app.inject({
      method: 'POST',
      url: '/coffee/connect',
      headers: { authorization: 'Bearer sec-test-token' },
      payload: {
        client_id: 'sec-test-client',
        client_name: 'Sec Test Client',
        pod_url: 'http://127.0.0.1:8732',
      },
    });
    assert.equal(connect.statusCode, 200);

    const stats = await fsStat(path.join(dataDir, 'coffee-clients.json'));
    const mode = stats.mode & 0o777;
    assert.equal(mode, 0o600, `coffee-clients.json must be 0o600, got 0o${mode.toString(8)}`);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('CP-SEC-006 · repeated PIN-verify failures hit the 429 lockout', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-sec-pin-'));
  const app = await buildApp(testEnv(dataDir), false);
  try {
    const setPin = await app.inject({
      method: 'POST',
      url: '/pod/pin/set',
      headers: { authorization: 'Bearer sec-test-token' },
      payload: { pin: '1234' },
    });
    assert.equal(setPin.statusCode, 200);

    let saw429 = false;
    for (let i = 0; i < 14; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/pod/pin/verify',
        payload: { pin: '9999' },
      });
      if (res.statusCode === 429) {
        saw429 = true;
        break;
      }
    }
    assert.ok(saw429, 'PIN verify should eventually return 429 after sustained brute-force attempts');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('CP-SEC-007 · folder import refuses forbidden roots', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-sec-import-'));
  const app = await buildApp({ ...testEnv(dataDir), apiToken: undefined }, false);
  try {
    const res = await app.inject({
      method: 'POST',
      url: '/pod/import/folder',
      payload: { actor_id: 'person-local', path: '/etc' },
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error, 'forbidden_path');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('CP-SEC-007 · folder import allows legitimate user folders', async () => {
  // Sanity check: blocking sensitive roots must not break ordinary imports
  // from user-owned scratch directories.
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-sec-import-ok-'));
  const folder = await mkdtemp(path.join(tmpdir(), 'coffee-pod-sec-import-src-'));
  await mkdir(path.join(folder, 'notes'));
  await writeFile(path.join(folder, 'notes', 'a.md'), '# Hello\n');
  const app = await buildApp({ ...testEnv(dataDir), apiToken: undefined }, false);
  try {
    const res = await app.inject({
      method: 'POST',
      url: '/pod/import/folder',
      payload: { actor_id: 'person-local', path: folder },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().imported.length, 1);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('CP-SEC-009 · OAuth callback HTML escapes error parameter', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-sec-html-'));
  const app = await buildApp(testEnv(dataDir), false);
  try {
    const res = await app.inject({
      method: 'GET',
      url: '/integrations/google-drive/callback?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E',
    });
    assert.equal(res.statusCode, 400);
    assert.ok(!res.body.includes('<script>alert(1)</script>'), 'raw <script> must not appear in response');
    assert.ok(res.body.includes('&lt;script&gt;'), 'error must be HTML-encoded');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});
