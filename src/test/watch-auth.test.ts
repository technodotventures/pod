import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeSmartwareCore, getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { getDb, upsertAgent } from '../pod/db.js';
import { syncAgentAccessGrant } from '../pod/agent-access.js';

/**
 * POD-AUDIT-003: /pod/watch must bind the subscription identity to the
 * caller's authenticated principal. Before the fix, any caller could supply
 * `?actor_id=<any registered actor>` — including the Pod owner — without
 * presenting any credential, and receive that actor's event stream.
 */

function testEnv(dataDir: string, overrides: Partial<CoffeePodEnv> = {}): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: 'owner-test',
    podId: 'watch-auth-test',
    podName: 'Watch Auth Test Pod',
    apiToken: 'test-owner-token',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
    ...overrides,
  };
}

interface UpgradeResult {
  status: number;
  note?: string;
}

/** Raw WebSocket upgrade attempt; resolves with the HTTP status (101 on accept). */
function watchUpgrade(port: number, urlPath: string, headers: Record<string, string> = {}): Promise<UpgradeResult> {
  return new Promise(resolve => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: urlPath,
      agent: false,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
        'Sec-WebSocket-Version': '13',
        ...headers,
      },
    });
    const timer = setTimeout(() => {
      req.destroy();
      resolve({ status: 0, note: 'timeout' });
    }, 5000);
    const done = (result: UpgradeResult): void => {
      clearTimeout(timer);
      resolve(result);
    };
    req.on('upgrade', (res, socket) => {
      socket.destroy();
      done({ status: res.statusCode ?? 101 });
    });
    req.on('response', res => {
      res.resume();
      done({ status: res.statusCode ?? 0 });
    });
    req.on('error', error => {
      done({ status: 0, note: String(error) });
    });
    req.end();
  });
}

test('watch subscriptions bind the actor to the caller identity (POD-AUDIT-003)', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-watch-auth-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);

  // An "attacker" agent: valid token, but must never be able to claim another actor.
  const agent = upsertAgent(getDb(env), { name: 'watch-test-agent', access_mode: 'all' });
  const agentToken = agent.auth_token ?? '';
  assert.ok(agentToken.startsWith('cpod_agent_'), 'agent token minted');
  const core = await getSmartwareCore(env);
  syncAgentAccessGrant(core, getPodProfile(core, env), agent);

  try {
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const port = Number(new URL(address).port);

    // 1. No credentials at all, claiming the owner actor — must be refused.
    const anon = await watchUpgrade(port, '/pod/watch?actor_id=owner-test');
    assert.equal(anon.status, 401, `anonymous owner impersonation must be 401, got ${anon.status} ${anon.note ?? ''}`);

    // 2. A wrong bearer, claiming the owner actor — must be refused.
    const wrong = await watchUpgrade(port, '/pod/watch?actor_id=owner-test', {
      Authorization: 'Bearer totally-wrong-token',
    });
    assert.equal(wrong.status, 401, `invalid bearer must be 401, got ${wrong.status} ${wrong.note ?? ''}`);

    // 3. The owner's real api token — allowed (regression: owner access keeps working).
    const ownerOk = await watchUpgrade(port, '/pod/watch?actor_id=owner-test', {
      Authorization: 'Bearer test-owner-token',
    });
    assert.equal(ownerOk.status, 101, `owner subscription must connect, got ${ownerOk.status} ${ownerOk.note ?? ''}`);

    // 4. Agent token A claiming the owner actor — must be refused (the audit's core case).
    const spoof = await watchUpgrade(port, '/pod/watch?actor_id=owner-test', {
      Authorization: `Bearer ${agentToken}`,
    });
    assert.equal(spoof.status, 403, `agent impersonating owner must be 403, got ${spoof.status} ${spoof.note ?? ''}`);

    // 5. Agent token A claiming agent A — allowed (regression: agents keep their own stream).
    const self = await watchUpgrade(port, `/pod/watch?actor_id=${encodeURIComponent(agent.id)}`, {
      Authorization: `Bearer ${agentToken}`,
    });
    assert.equal(self.status, 101, `agent self-subscription must connect, got ${self.status} ${self.note ?? ''}`);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('open mode keeps unauthenticated local watch working (no api token, no PIN)', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-watch-open-'));
  const env = testEnv(dataDir, { apiToken: undefined });
  const app = await buildApp(env, false);
  try {
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const port = Number(new URL(address).port);
    const open = await watchUpgrade(port, '/pod/watch?actor_id=owner-test');
    assert.equal(open.status, 101, `open mode must connect, got ${open.status} ${open.note ?? ''}`);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});
