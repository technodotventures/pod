#!/usr/bin/env node
/**
 * End-to-end test of the permission layer:
 * - audit log records calls
 * - grant request flow (create → approve → grant exists)
 * - denied calls are denied (and recorded)
 * - revoked grants stop working
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { getDb, closeDb } = await import(path.join(REPO_ROOT, 'src/pod/db.ts'));
const { createConnectionGrant, checkConnectionGrant, revokeConnectionGrant } = await import(path.join(REPO_ROOT, 'src/services/connections/grants.ts'));
const { recordMcpCall, listMcpCalls } = await import(path.join(REPO_ROOT, 'src/services/connections/audit.ts'));
const { createGrantRequest, listGrantRequests, approveGrantRequest, denyGrantRequest } = await import(path.join(REPO_ROOT, 'src/services/connections/grant-requests.ts'));

const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-perm-test-'));
const env = {
  host: '127.0.0.1', port: 0, dataDir, ownerId: undefined,
  podId: 'test', podName: 'test', apiToken: undefined,
  mcpClientEnabled: false, mcpDockerCommand: 'docker', mcpPortBase: 5100,
};

const expect = (cond, msg) => { if (!cond) { console.error('  ✗', msg); process.exitCode = 1; } else console.log('  ✓', msg); };

try {
  const db = getDb(env);

  console.log('▸ Grant request flow');
  const req = createGrantRequest(db, {
    actor_id: 'agent-coffee-workspace',
    service_id: 'google-drive',
    tool_pattern: 'google_drive_search_*',
    reason: 'Read-only search to find user docs for the morning brief',
  });
  expect(req.status === 'pending', 'request starts pending');
  expect(checkConnectionGrant(db, 'agent-coffee-workspace', 'google-drive', 'google_drive_search_documents') === null,
    'no grant exists yet — agent is denied');

  const pending = listGrantRequests(db, { status: 'pending' });
  expect(pending.length === 1, 'one pending request visible to owner');

  const approval = approveGrantRequest(db, req.id, 'owner');
  expect(approval.grant.actor_id === 'agent-coffee-workspace', 'approval creates grant');
  expect(approval.grant.tool_pattern === 'google_drive_search_*', 'grant inherits requested pattern');
  expect(approval.request.status === 'approved', 'request marked approved');
  expect(checkConnectionGrant(db, 'agent-coffee-workspace', 'google-drive', 'google_drive_search_documents') !== null,
    'agent can now call search_documents');
  expect(checkConnectionGrant(db, 'agent-coffee-workspace', 'google-drive', 'google_drive_get_document_by_id') === null,
    'agent still cannot call get_document_by_id (pattern is search_*)');

  console.log('\n▸ Deny flow');
  const req2 = createGrantRequest(db, {
    actor_id: 'agent-bad',
    service_id: 'google-drive',
    tool_pattern: '*',
    reason: 'Give me everything',
  });
  const denied = denyGrantRequest(db, req2.id, 'owner');
  expect(denied.status === 'denied', 'request marked denied');
  expect(checkConnectionGrant(db, 'agent-bad', 'google-drive', 'google_drive_search_documents') === null,
    'denied actor still has no grant');

  console.log('\n▸ Audit recording');
  recordMcpCall(db, {
    actor_id: 'agent-coffee-workspace', service_id: 'google-drive',
    tool_name: 'google_drive_search_documents', args: { query: 'morning brief' },
    status: 'ok', duration_ms: 1234, grant_id: approval.grant.id, caller_kind: 'client',
  });
  recordMcpCall(db, {
    actor_id: 'agent-bad', service_id: 'google-drive',
    tool_name: 'google_drive_empty_trash', args: {},
    status: 'error', error_kind: 'grant_denied', duration_ms: 0, grant_id: null, caller_kind: 'client',
  });

  const all = listMcpCalls(db);
  expect(all.length === 2, 'audit log has 2 entries');
  const denials = listMcpCalls(db, { status: 'error' });
  expect(denials.length === 1, 'one error/denial entry');
  expect(denials[0].error_kind === 'grant_denied', 'error kind preserved');
  expect(denials[0].args_summary === '{}', 'args summary captured');

  const okCalls = listMcpCalls(db, { actor_id: 'agent-coffee-workspace', status: 'ok' });
  expect(okCalls.length === 1, 'filter by actor + status works');
  expect(okCalls[0].grant_id === approval.grant.id, 'audit entry links to authorizing grant');

  console.log('\n▸ Revocation cascade');
  revokeConnectionGrant(db, approval.grant.id);
  expect(checkConnectionGrant(db, 'agent-coffee-workspace', 'google-drive', 'google_drive_search_documents') === null,
    'after revoke, agent loses access');

  console.log('\n▸ Idempotency');
  const reApprove = approveGrantRequest(db, req.id, 'owner');
  expect(reApprove === null, 'cannot approve already-approved request');
  const reDeny = denyGrantRequest(db, req2.id, 'owner');
  expect(reDeny === null, 'cannot deny already-denied request');

  console.log('\n▸ Args summarization (200 char cap)');
  const long = 'x'.repeat(500);
  recordMcpCall(db, {
    actor_id: 'agent-test', service_id: 'google-drive',
    tool_name: 'test', args: { big: long },
    status: 'ok', duration_ms: 1, grant_id: null, caller_kind: 'owner',
  });
  const latest = listMcpCalls(db, { actor_id: 'agent-test' });
  expect(latest[0].args_summary.length <= 200, 'args summary capped at 200 chars');
  expect(latest[0].args_summary.endsWith('…'), 'truncation marker present');

  console.log('\n✅ Permission flow tests passed');
} catch (err) {
  console.error('\n❌ Test failed:', err);
  process.exitCode = 1;
} finally {
  closeDb();
  await rm(dataDir, { recursive: true, force: true });
}
