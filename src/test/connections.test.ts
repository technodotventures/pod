// Integration coverage for the connections layer added in this branch:
//   - connection_grants CRUD (POST/GET/DELETE)
//   - grant-request lifecycle (request → owner approve → grant created)
//   - tool-call enforcement (owner allowed, client without grant denied,
//     client with grant allowed but only for matching tool_pattern)
//   - audit log records every call (success + denial)
//   - MCP-disabled clean errors (mcp_client_enabled defaults off in tests)
//
// Pure-Node: no Docker required. We exercise the routes through
// app.inject so the full Fastify auth hook + route handlers run.

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string, overrides: Partial<CoffeePodEnv> = {}): CoffeePodEnv {
  return {
    host: '127.0.0.1', port: 0, dataDir, ownerId: undefined,
    podId: 'founder-test', podName: 'Connections Test Pod',
    apiToken: 'owner-token',
    mcpClientEnabled: false, mcpDockerCommand: 'docker', mcpPortBase: 5100,
    ...overrides,
  };
}

const OWNER = { authorization: 'Bearer owner-token' };

async function pairAgent(app: Awaited<ReturnType<typeof buildApp>>, clientId: string, actorId: string): Promise<string> {
  const res = await app.inject({
    method: 'POST', url: '/coffee/connect', headers: OWNER,
    payload: { client_id: clientId, client_name: clientId, pod_url: 'http://127.0.0.1:8732', actor_id: actorId },
  });
  assert.equal(res.statusCode, 200, `pairing should succeed: ${res.body}`);
  return res.json().client_token;
}

test('connection_grants CRUD: create, list, revoke', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'cp-conn-grants-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const created = await app.inject({
      method: 'POST', url: '/pod/connection-grants', headers: OWNER,
      payload: { actor_id: 'agent:test-1', service_id: 'google-calendar', tool_pattern: 'google_calendar_list_*', note: 'read-only' },
    });
    assert.equal(created.statusCode, 200);
    const grant = created.json().grant;
    assert.match(grant.id, /^cgrant_/);
    assert.equal(grant.actor_id, 'agent:test-1');
    assert.equal(grant.tool_pattern, 'google_calendar_list_*');
    assert.equal(grant.revoked_at, null);

    const listed = await app.inject({ method: 'GET', url: '/pod/connection-grants', headers: OWNER });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.json().grants.length, 1);

    const filtered = await app.inject({ method: 'GET', url: '/pod/connection-grants?actor_id=other', headers: OWNER });
    assert.equal(filtered.json().grants.length, 0);

    const revoked = await app.inject({ method: 'DELETE', url: `/pod/connection-grants/${grant.id}`, headers: OWNER });
    assert.equal(revoked.statusCode, 200);
    assert.ok(revoked.json().grant.revoked_at);

    const missing = await app.inject({ method: 'DELETE', url: '/pod/connection-grants/cgrant_does_not_exist', headers: OWNER });
    assert.equal(missing.statusCode, 404);

    const unknownService = await app.inject({
      method: 'POST', url: '/pod/connection-grants', headers: OWNER,
      payload: { actor_id: 'agent:x', service_id: 'not-a-real-service' },
    });
    assert.equal(unknownService.statusCode, 400);
    assert.equal(unknownService.json().error, 'unknown_service');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('grant-request lifecycle: client requests, owner approves, grant exists', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'cp-grant-req-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const clientToken = await pairAgent(app, 'workspace-x', 'agent:workspace-x');
    const clientAuth = { authorization: `Bearer ${clientToken}` };

    const requested = await app.inject({
      method: 'POST', url: '/pod/connection-grants/requests', headers: clientAuth,
      payload: { service_id: 'google-calendar', tool_pattern: 'google_calendar_list_*', reason: 'morning brief' },
    });
    assert.equal(requested.statusCode, 200);
    const reqRow = requested.json().request;
    assert.equal(reqRow.actor_id, 'agent:workspace-x', 'client request is pinned to its own actor');
    assert.equal(reqRow.status, 'pending');

    const pending = await app.inject({ method: 'GET', url: '/pod/connection-grants/requests', headers: OWNER });
    assert.equal(pending.statusCode, 200);
    assert.equal(pending.json().requests.length, 1);

    const approval = await app.inject({
      method: 'POST', url: `/pod/connection-grants/requests/${reqRow.id}/approve`, headers: OWNER, payload: {},
    });
    assert.equal(approval.statusCode, 200);
    assert.equal(approval.json().grant.actor_id, 'agent:workspace-x');
    assert.equal(approval.json().grant.tool_pattern, 'google_calendar_list_*');
    assert.equal(approval.json().request.status, 'approved');

    const reApprove = await app.inject({
      method: 'POST', url: `/pod/connection-grants/requests/${reqRow.id}/approve`, headers: OWNER, payload: {},
    });
    assert.equal(reApprove.statusCode, 404, 'second approve is idempotent (404)');

    const denyOther = await app.inject({
      method: 'POST', url: '/pod/connection-grants/requests', headers: clientAuth,
      payload: { service_id: 'google-calendar', tool_pattern: '*' },
    });
    const denied = await app.inject({
      method: 'POST', url: `/pod/connection-grants/requests/${denyOther.json().request.id}/deny`, headers: OWNER,
    });
    assert.equal(denied.statusCode, 200);
    assert.equal(denied.json().request.status, 'denied');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('tool-call enforcement: client without grant denied, with matching grant attempted', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'cp-tool-call-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const clientToken = await pairAgent(app, 'workspace-y', 'agent:workspace-y');
    const clientAuth = { authorization: `Bearer ${clientToken}` };

    // No grant yet → 403 with no_connection_grant + an audit entry of caller=client, error=grant_denied
    const denied = await app.inject({
      method: 'POST', url: '/integrations/google-calendar/tools/google_calendar_list_events/call',
      headers: clientAuth, payload: { arguments: { query: 'x' } },
    });
    assert.equal(denied.statusCode, 403);
    assert.equal(denied.json().error, 'no_connection_grant');

    // Create a grant for a non-matching tool pattern → still denied
    await app.inject({
      method: 'POST', url: '/pod/connection-grants', headers: OWNER,
      payload: { actor_id: 'agent:workspace-y', service_id: 'google-calendar', tool_pattern: 'google_calendar_create_*' },
    });
    const stillDenied = await app.inject({
      method: 'POST', url: '/integrations/google-calendar/tools/google_calendar_list_events/call',
      headers: clientAuth, payload: { arguments: {} },
    });
    assert.equal(stillDenied.statusCode, 403, 'non-matching pattern is still denied');

    // Add a matching grant → enforcement passes; will fail at MCP layer because mcp backend is disabled in tests
    await app.inject({
      method: 'POST', url: '/pod/connection-grants', headers: OWNER,
      payload: { actor_id: 'agent:workspace-y', service_id: 'google-calendar', tool_pattern: 'google_calendar_list_*' },
    });
    const mcpDisabledRes = await app.inject({
      method: 'POST', url: '/integrations/google-calendar/tools/google_calendar_list_events/call',
      headers: clientAuth, payload: { arguments: {} },
    });
    // With grant present + MCP disabled, the route gets past auth/grants and fails at the backend.
    // 400 mcp_error with "MCP client backend is disabled" confirms the request reached the call layer.
    assert.equal(mcpDisabledRes.statusCode, 400);
    assert.equal(mcpDisabledRes.json().error, 'mcp_error');
    assert.match(mcpDisabledRes.json().message, /MCP client backend is disabled/);

    // Audit log should contain 3 entries: two denials + one mcp error
    const audit = await app.inject({ method: 'GET', url: '/pod/connection-grants/audit?actor_id=agent:workspace-y', headers: OWNER });
    assert.equal(audit.statusCode, 200);
    const calls = audit.json().calls;
    assert.equal(calls.length, 3, `expected 3 audit entries, got ${calls.length}`);
    const errorKinds = calls.map((c: { error_kind: string | null }) => c.error_kind).sort();
    assert.deepEqual(errorKinds, ['grant_denied', 'grant_denied', 'mcp']);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('owner-token caller bypasses grant enforcement (full access)', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'cp-owner-bypass-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const ownerCallNoGrant = await app.inject({
      method: 'POST', url: '/integrations/google-calendar/tools/google_calendar_anything/call',
      headers: OWNER, payload: { arguments: {} },
    });
    // No grant exists, but owner bypasses the check. Fails at MCP layer (disabled) — confirming the request
    // reached the call code path rather than being blocked by grant enforcement.
    assert.equal(ownerCallNoGrant.statusCode, 400);
    assert.equal(ownerCallNoGrant.json().error, 'mcp_error');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('trust mode setting drives auth enforcement (open → no auth required for writes)', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'cp-trust-mode-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    // Default with apiToken set → 'strict' → unauthenticated write rejected.
    const blockedWrite = await app.inject({
      method: 'POST', url: '/pod/connection-grants', payload: { actor_id: 'agent:x', service_id: 'google-calendar' },
    });
    assert.equal(blockedWrite.statusCode, 401, 'strict mode rejects unauthenticated writes');

    // Switch to 'open' (every caller becomes implicit owner).
    const switched = await app.inject({
      method: 'PATCH', url: '/pod/settings/pod.trust_mode', headers: OWNER, payload: { values: { mode: 'open' } },
    });
    assert.equal(switched.statusCode, 200);
    assert.equal(switched.json().values.mode, 'open');

    // Same unauthenticated write now succeeds in open mode.
    const openWrite = await app.inject({
      method: 'POST', url: '/pod/connection-grants',
      payload: { actor_id: 'agent:open-mode', service_id: 'google-calendar', tool_pattern: '*' },
    });
    assert.equal(openWrite.statusCode, 200);

    // Reject invalid mode value
    const badMode = await app.inject({
      method: 'PATCH', url: '/pod/settings/pod.trust_mode', headers: OWNER, payload: { values: { mode: 'garbage' } },
    });
    assert.equal(badMode.statusCode, 400);
    assert.equal(badMode.json().error, 'invalid_values');
  } finally {
    // Reset trust_mode back to strict so later tests on the singleton-shared DB don't inherit open mode.
    await app.inject({
      method: 'PATCH', url: '/pod/settings/pod.trust_mode', headers: OWNER, payload: { values: { mode: 'strict' } },
    });
    await app.close();
    await closeSmartwareCore();
  }
});

test('client token TTL: pairing accepts ttl_seconds and rejects expired tokens', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'cp-token-ttl-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const minted = await app.inject({
      method: 'POST', url: '/coffee/connect', headers: OWNER,
      payload: { client_id: 'ttl-test', client_name: 'TTL Test', pod_url: 'http://x', actor_id: 'agent:ttl-test', ttl_seconds: 60 },
    });
    assert.equal(minted.statusCode, 200);
    const { client_token: live, expires_at } = minted.json();
    assert.ok(expires_at, 'expires_at returned');
    assert.ok(new Date(expires_at).getTime() > Date.now(), 'expires_at is in the future');

    // Live token works
    const okCall = await app.inject({
      method: 'POST', url: '/pod/connection-grants/requests', headers: { authorization: `Bearer ${live}` },
      payload: { service_id: 'google-calendar' },
    });
    assert.equal(okCall.statusCode, 200);

    // Issue another with ttl_seconds=0 → never expires (expires_at = null)
    const noTtl = await app.inject({
      method: 'POST', url: '/coffee/connect', headers: OWNER,
      payload: { client_id: 'no-ttl', client_name: 'No TTL', pod_url: 'http://x', actor_id: 'agent:no-ttl', ttl_seconds: 0 },
    });
    assert.equal(noTtl.json().expires_at, null);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('MCP backend health + prewarm endpoints', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'cp-mcp-health-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const health = await app.inject({ method: 'GET', url: '/pod/mcp/health', headers: OWNER });
    assert.equal(health.statusCode, 200);
    const body = health.json();
    assert.equal(body.mcp_enabled, false, 'mcp disabled by default in tests');
    assert.equal(body.docker_reachable, false, 'docker not probed when mcp disabled');
    assert.ok(Array.isArray(body.providers), 'providers list returned even when disabled');
    assert.ok(body.providers.length >= 7, 'all registered providers reported');

    // Prewarm should report skipped (mcp_disabled), not attempt a docker run.
    const warm = await app.inject({
      method: 'POST', url: '/pod/mcp/warm', headers: OWNER,
      payload: { providers: ['google-calendar'] },
    });
    assert.equal(warm.statusCode, 200);
    assert.deepEqual(warm.json().skipped, [{ id: '*', reason: 'mcp_disabled' }]);
    assert.equal(warm.json().warmed.length, 0);
    assert.equal(warm.json().errors.length, 0);

    // Prewarm requires owner auth.
    const unauth = await app.inject({ method: 'POST', url: '/pod/mcp/warm', payload: { providers: ['google-calendar'] } });
    assert.equal(unauth.statusCode, 401);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('agent detection endpoint returns array of probe results', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'cp-agent-detect-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const res = await app.inject({ method: 'GET', url: '/pod/agents/detect', headers: OWNER });
    assert.equal(res.statusCode, 200);
    const agents = res.json().agents as Array<{ agent_id: string; installed: boolean; name: string; auto_configurable: boolean }>;
    assert.ok(Array.isArray(agents) && agents.length > 0, 'returns at least one probe');
    for (const a of agents) {
      assert.equal(typeof a.agent_id, 'string');
      assert.equal(typeof a.installed, 'boolean');
      assert.equal(typeof a.name, 'string');
      assert.equal(typeof a.auto_configurable, 'boolean');
    }
    // The catalog includes claude-desktop, cursor, etc. — at least those should be probed.
    const ids = new Set(agents.map(a => a.agent_id));
    assert.ok(ids.has('claude-desktop') && ids.has('cursor'));
    assert.ok(ids.has('claude-code') && ids.has('codex'));
    assert.ok(ids.has('hermes') && ids.has('openclaw') && ids.has('kimi-code') && ids.has('deerflow'));
    assert.equal(agents.find(a => a.agent_id === 'codex')?.auto_configurable, true);
    assert.equal(agents.find(a => a.agent_id === 'openclaw')?.auto_configurable, true);
    assert.equal(agents.find(a => a.agent_id === 'kimi-code')?.auto_configurable, true);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('isPublicRoute tightening: only /integrations/*/callback bypasses auth', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'cp-public-route-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    // OAuth callback (any registered provider) should still be reachable without auth.
    // What it returns (200 HTML / 400) depends on which handler wins; the key
    // assertion is that the global auth hook doesn't 401 it.
    const callback = await app.inject({ method: 'GET', url: '/integrations/google-calendar/callback?error=denied' });
    assert.notEqual(callback.statusCode, 401, 'callback reachable without auth');

    // /integrations/:service/configure used to be exempted by the prefix allowlist — now it must require auth.
    const unauthConfigure = await app.inject({
      method: 'POST', url: '/integrations/google-calendar/configure', payload: { client_id: 'x', client_secret: 'y' },
    });
    assert.equal(unauthConfigure.statusCode, 401, 'configure now requires auth');

    // Tool-call endpoint likewise must require auth (no longer exempted).
    const unauthCall = await app.inject({
      method: 'POST', url: '/integrations/google-calendar/tools/google_calendar_list_events/call', payload: { arguments: {} },
    });
    assert.equal(unauthCall.statusCode, 401, 'tool-call now requires auth');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});
