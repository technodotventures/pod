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
import {
  closeDb,
  getAgent,
  getAgentByToken,
  getDb,
  rotateAgentToken,
  upsertAgent,
} from '../pod/db.js';
import { syncAgentAccessGrant } from '../pod/agent-access.js';

/**
 * POD-AUDIT-002: agent bearer tokens are stored plaintext in SQLite, unlike
 * client tokens which are hashed. These tests pin the fix:
 *   - at rest: only sha256(token) is stored — the raw bearer is never a row value
 *   - auth: the hash path resolves bearers (and only the live one)
 *   - reads: no ordinary read re-exposes the token; reveal rotates instead
 *   - migration: legacy plaintext rows are hashed on open, tokens keep working
 */

const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

function testEnv(dataDir: string, overrides: Partial<CoffeePodEnv> = {}): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: 'owner-test',
    podId: 'agent-token-hash-test',
    podName: 'Agent Token Hash Test Pod',
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

test('agent bearer tokens are stored as sha256 hashes and still authenticate (POD-AUDIT-002)', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-agent-hash-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);

  try {
    const db = getDb(env);
    const agent = upsertAgent(db, { name: 'hash-test-agent', access_mode: 'all' });
    const token = agent.auth_token ?? '';
    assert.ok(token.startsWith('cpod_agent_'), 'fresh bearer is returned once at mint');

    // At rest: only the hash. The raw token must not appear in any row value.
    const stored = db.prepare('SELECT auth_token FROM agents WHERE id = ?').get(agent.id) as { auth_token: string | null };
    assert.notEqual(stored.auth_token, token, 'raw bearer must not be stored');
    assert.equal(stored.auth_token, sha256(token), 'stored value is sha256(token)');
    const rawMatches = db.prepare('SELECT COUNT(*) AS c FROM agents WHERE auth_token = ?').get(token) as { c: number };
    assert.equal(rawMatches.c, 0, 'no row matches the raw bearer');

    // Hash-based lookup resolves the live bearer, and only the live one.
    assert.equal(getAgentByToken(db, token)?.id, agent.id, 'bearer resolves through the hash');
    assert.equal(getAgentByToken(db, `cpod_agent_${'x'.repeat(32)}`), null, 'unknown bearer does not resolve');

    // Ordinary reads never carry the token.
    const read = getAgent(db, agent.id);
    assert.equal(read?.auth_token ?? null, null, 'plain reads do not expose the bearer');

    // End-to-end: the bearer authenticates over HTTP (watch self-subscription).
    const core = await getSmartwareCore(env);
    syncAgentAccessGrant(core, getPodProfile(core, env), agent);
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const port = Number(new URL(address).port);

    const self = await watchUpgrade(port, `/pod/watch?actor_id=${encodeURIComponent(agent.id)}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(self.status, 101, `hashed bearer must authenticate, got ${self.status} ${self.note ?? ''}`);

    // Rotation: the old bearer dies, the new one works, and only its hash is stored.
    const rotated = rotateAgentToken(db, agent.id);
    assert.ok(rotated && rotated !== token, 'rotation returns a new bearer');
    const storedAfter = db.prepare('SELECT auth_token FROM agents WHERE id = ?').get(agent.id) as { auth_token: string };
    assert.equal(storedAfter.auth_token, sha256(rotated), 'rotated bearer is stored as a hash');

    const oldBearer = await watchUpgrade(port, `/pod/watch?actor_id=${encodeURIComponent(agent.id)}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(oldBearer.status, 401, `rotated-out bearer must be refused, got ${oldBearer.status}`);
    const newBearer = await watchUpgrade(port, `/pod/watch?actor_id=${encodeURIComponent(agent.id)}`, {
      Authorization: `Bearer ${rotated}`,
    });
    assert.equal(newBearer.status, 101, `rotated bearer must authenticate, got ${newBearer.status}`);
  } finally {
    await app.close();
    closeDb();
    await closeSmartwareCore();
  }
});

test('connection reveal rotates instead of re-reading a stored token (POD-AUDIT-002)', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-conn-reveal-'));
  const env = testEnv(dataDir, { apiToken: undefined });
  const app = await buildApp(env, false);

  try {
    const create = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: { name: 'reveal-test-agent', access_mode: 'all' },
    });
    assert.equal(create.statusCode, 200);
    const created = create.json().agent as { id: string; auth_token: string | null };
    assert.ok(created.auth_token && created.auth_token.startsWith('cpod_agent_'), 'create returns a fresh bearer');

    const db = getDb(env);
    const agentPath = `/pod/registry/agents/${encodeURIComponent(created.id)}/connection`;

    // Plain read: no token value can be reconstructed from storage.
    const plain = await app.inject({ method: 'GET', url: agentPath });
    assert.equal(plain.statusCode, 200);
    assert.equal(plain.json().connection.token ?? null, null, 'stored bearer is never re-readable');
    assert.equal(plain.json().connection.has_token, true, 'connection reports a bearer exists');

    // Reveal mints a fresh bearer and invalidates the previous one.
    const reveal1 = await app.inject({ method: 'GET', url: `${agentPath}?reveal=1` });
    assert.equal(reveal1.statusCode, 200);
    const t1 = reveal1.json().connection.token as string;
    assert.ok(t1.startsWith('cpod_agent_'), 'reveal returns a real bearer');
    assert.notEqual(t1, created.auth_token, 'reveal does not re-issue the create-time bearer');
    assert.equal(getAgentByToken(db, created.auth_token), null, 'previous bearer is dead after reveal');
    assert.equal(getAgentByToken(db, t1)?.id, created.id, 'revealed bearer resolves');

    const reveal2 = await app.inject({ method: 'GET', url: `${agentPath}?reveal=1` });
    const t2 = reveal2.json().connection.token as string;
    assert.notEqual(t2, t1, 'each reveal rotates');
    assert.equal(getAgentByToken(db, t1), null, 'previous reveal bearer is dead');
    assert.equal(getAgentByToken(db, t2)?.id, created.id, 'latest reveal bearer resolves');
  } finally {
    await app.close();
    closeDb();
    await closeSmartwareCore();
  }
});

test('legacy plaintext agent tokens are hashed on open and keep working (POD-AUDIT-002 migration)', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-agent-migration-'));
  const env = testEnv(dataDir, { podId: 'agent-token-migration-test' });

  try {
    const app = await buildApp(env, false);
    const db = getDb(env);
    const legacy = `cpod_agent_${'A'.repeat(32)}`;
    const ts = new Date().toISOString();
    db.prepare(`
      INSERT INTO agents (id, name, description, role, workspace_id, model, status, created_at, updated_at, created_by, metadata, auth_token, persona, access_mode, scopes, context_budget)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'agent:legacy-plaintext', 'Legacy plaintext', '', 'agent', null, null, 'active',
      ts, ts, 'user', null, legacy, null, 'scoped', null, null,
    );
    await app.close();

    // Re-open: close the cached handle first so migrate() runs again — the
    // migration should rewrite the legacy plaintext value in place.
    closeDb();
    const db2 = getDb(env);
    const stored = db2.prepare('SELECT auth_token FROM agents WHERE id = ?').get('agent:legacy-plaintext') as { auth_token: string };
    assert.equal(stored.auth_token, sha256(legacy), 'legacy plaintext is replaced by its hash');
    assert.equal(getAgentByToken(db2, legacy)?.id, 'agent:legacy-plaintext', 'legacy bearer keeps authenticating');

    // Idempotent: opening again must not double-hash or corrupt anything.
    closeDb();
    const db3 = getDb(env);
    const storedAgain = db3.prepare('SELECT auth_token FROM agents WHERE id = ?').get('agent:legacy-plaintext') as { auth_token: string };
    assert.equal(storedAgain.auth_token, sha256(legacy), 'migration is idempotent across opens');
    assert.equal(getAgentByToken(db3, legacy)?.id, 'agent:legacy-plaintext');
  } finally {
    closeDb();
    await closeSmartwareCore();
  }
});
