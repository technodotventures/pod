#!/usr/bin/env node
/**
 * End-to-end demo: a Coffee-workspace-style agent uses Pod as its permission
 * gateway to call external connections (Google Drive via Klavis MCP).
 *
 * Walks the full lifecycle so you can see audit + grant flow in one shot:
 *   1. Owner mints a client token for "workspace-demo-agent"
 *   2. Agent tries Drive search → 403 no_connection_grant (recorded in audit)
 *   3. Agent requests a grant via pod_connections_request_grant
 *   4. Owner approves it
 *   5. Agent retries Drive search → succeeds (recorded in audit, grant_id linked)
 *   6. Agent tries a tool outside its pattern → 403 (recorded)
 *   7. Owner inspects audit log — 4 entries telling the story
 *   8. Cleanup: revoke client token
 *
 * Requires:
 *   - Pod running locally with COFFEE_POD_MCP_CLIENT_ENABLED=true
 *   - COFFEE_POD_API_TOKEN set (owner token)
 *   - data/integrations/google-drive.json with a refresh_token
 *   - Colima/docker running (the demo will start the Klavis container on demand)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Read the owner token from .env so we can drive the demo end-to-end.
const envText = await readFile(path.join(REPO_ROOT, '.env'), 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const BASE_URL = `http://127.0.0.1:${env['COFFEE_POD_PORT'] ?? '8732'}`;
const OWNER_TOKEN = env['COFFEE_POD_API_TOKEN'];
if (!OWNER_TOKEN) { console.error('No COFFEE_POD_API_TOKEN in .env'); process.exit(1); }

let stepN = 0;
function step(title) { console.log(`\n${'━'.repeat(70)}\n▸ Step ${++stepN}: ${title}\n${'━'.repeat(70)}`); }
function ok(msg) { console.log(`   ✓ ${msg}`); }
function detail(label, value) { console.log(`   · ${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`); }
function bad(msg) { console.log(`   ✗ ${msg}`); }

async function http(method, url, token, body) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
  return { status: res.status, payload };
}

async function expect(label, { status, payload }, expectedStatus, additionalCheck) {
  if (status !== expectedStatus) {
    bad(`${label} — expected ${expectedStatus}, got ${status}: ${JSON.stringify(payload).slice(0, 200)}`);
    process.exitCode = 1;
    return false;
  }
  if (additionalCheck) {
    const err = additionalCheck(payload);
    if (err) { bad(`${label} — ${err}`); process.exitCode = 1; return false; }
  }
  ok(label);
  return true;
}

const CLIENT_ID = `workspace-demo-${Date.now().toString(36)}`;
const ACTOR_ID = `agent:${CLIENT_ID}`;
let CLIENT_TOKEN = null;
let CREATED_GRANT_ID = null;
let CREATED_REQUEST_ID = null;

try {
  step('Pre-flight: verify Pod is up and MCP backend is enabled');
  const probe = await http('GET', '/integrations/google-drive/tools', OWNER_TOKEN);
  if (probe.status === 0 || !probe.payload) {
    bad('Cannot reach Pod at ' + BASE_URL);
    console.log('   → Make sure Pod is running (e.g. npm run dev)');
    process.exit(1);
  }
  if (probe.status === 400 && /MCP client backend is disabled/.test(probe.payload?.message ?? '')) {
    bad('Pod is running but MCP backend is OFF');
    console.log('   → Add this to .env and restart Pod:');
    console.log('       COFFEE_POD_MCP_CLIENT_ENABLED=true');
    console.log('   → Then re-run this demo.');
    process.exit(2);
  }
  if (probe.status !== 200) {
    bad(`Unexpected pre-flight response: ${probe.status} ${JSON.stringify(probe.payload).slice(0, 200)}`);
    process.exit(1);
  }
  ok(`Pod reachable at ${BASE_URL}, MCP backend reports ${probe.payload.tools?.length ?? 0} Drive tools`);

  step('Owner mints a Pod client token for the workspace agent');
  const connectResp = await http('POST', '/coffee/connect', OWNER_TOKEN, {
    client_id: CLIENT_ID,
    client_name: 'Workspace Demo Agent',
    pod_url: BASE_URL,
    actor_id: ACTOR_ID,
  });
  if (!await expect('client provisioned', connectResp, 200, p => p.client_token ? null : 'no client_token in response')) throw new Error('cannot proceed');
  CLIENT_TOKEN = connectResp.payload.client_token;
  detail('actor_id', connectResp.payload.actor_id);
  detail('grant_id (Smartware-level)', connectResp.payload.grant_id);
  detail('token_prefix', connectResp.payload.token_prefix);

  step('Agent tries to call Drive search without a connection grant');
  const denied1 = await http('POST', '/integrations/google-drive/tools/google_drive_search_documents/call', CLIENT_TOKEN, {
    arguments: { query: 'TIG' },
  });
  await expect('denied with 403 + no_connection_grant', denied1, 403, p => p.error === 'no_connection_grant' ? null : `expected error=no_connection_grant, got ${p.error}`);
  detail('agent sees', denied1.payload.message);

  step('Agent requests a grant scoped to read-only Drive search');
  const reqResp = await http('POST', '/pod/connection-grants/requests', CLIENT_TOKEN, {
    service_id: 'google-drive',
    tool_pattern: 'google_drive_search_*',
    reason: 'Workspace agent needs read-only Drive search to find user documents for the morning brief.',
  });
  if (!await expect('grant request created', reqResp, 200, p => p.request?.status === 'pending' ? null : `status not pending`)) throw new Error('cannot proceed');
  const requestId = reqResp.payload.request.id;
  CREATED_REQUEST_ID = requestId;
  detail('request_id', requestId);
  detail('actor_id stored', reqResp.payload.request.actor_id);
  detail('tool_pattern', reqResp.payload.request.tool_pattern);

  step('Owner sees the pending request in the queue');
  const pendingList = await http('GET', '/pod/connection-grants/requests?status=pending', OWNER_TOKEN);
  await expect('pending list contains our request', pendingList, 200, p =>
    p.requests?.some(r => r.id === requestId) ? null : 'request not found in pending list');

  step('Owner approves the request → connection_grant is created');
  const approval = await http('POST', `/pod/connection-grants/requests/${requestId}/approve`, OWNER_TOKEN, {});
  if (!await expect('approved', approval, 200, p => p.grant?.actor_id === ACTOR_ID ? null : 'grant actor_id mismatch')) throw new Error('cannot proceed');
  CREATED_GRANT_ID = approval.payload.grant.id;
  detail('connection_grant.id', approval.payload.grant.id);
  detail('tool_pattern', approval.payload.grant.tool_pattern);

  step('Agent re-tries the same Drive search → now succeeds');
  const success = await http('POST', '/integrations/google-drive/tools/google_drive_search_documents/call', CLIENT_TOKEN, {
    arguments: { document_contains: ['TIG'], limit: 3 },
  });
  await expect('200 with content', success, 200, p => p.result?.content ? null : 'no content in result');
  const firstTextBlock = success.payload.result.content?.find(b => b.type === 'text');
  if (firstTextBlock) {
    const docs = JSON.parse(firstTextBlock.text);
    detail('documents returned', docs.documents_count ?? 0);
    if (docs.documents?.[0]) detail('first doc', docs.documents[0].name);
  }

  step('Agent tries a tool OUTSIDE its pattern (get_document_by_id)');
  const denied2 = await http('POST', '/integrations/google-drive/tools/google_drive_get_document_by_id/call', CLIENT_TOKEN, {
    arguments: { document_id: 'abc' },
  });
  await expect('denied with 403 (pattern only allows search_*)', denied2, 403, p => p.error === 'no_connection_grant' ? null : `expected no_connection_grant`);

  step('Owner inspects the audit log');
  const audit = await http('GET', `/pod/connection-grants/audit?actor_id=${encodeURIComponent(ACTOR_ID)}&limit=10`, OWNER_TOKEN);
  await expect('audit returned', audit, 200, p => Array.isArray(p.calls) ? null : 'calls not array');
  detail('total entries for this actor', audit.payload.calls.length);
  for (const call of audit.payload.calls.slice().reverse()) {
    const tag = call.status === 'ok' ? '✓' : '✗';
    const linked = call.grant_id ? `grant=${call.grant_id.slice(0, 14)}…` : 'no grant';
    console.log(`     ${tag} ${call.observed_at}  ${call.tool_name}  [${call.status}${call.error_kind ? '/' + call.error_kind : ''}]  ${linked}  ${call.duration_ms}ms`);
  }

  step('Owner revokes the workspace agent (cleanup)');
  const revoke = await http('POST', `/coffee/clients/${CLIENT_ID}/revoke`, OWNER_TOKEN);
  await expect('client token revoked', revoke, 200);
  const afterRevoke = await http('POST', '/integrations/google-drive/tools/google_drive_search_documents/call', CLIENT_TOKEN, { arguments: {} });
  await expect('revoked token gets 401', afterRevoke, 401);

  console.log(`\n${'━'.repeat(70)}\n✅ Workspace-as-client demo complete.\n${'━'.repeat(70)}`);
  console.log('\nSummary of what this proves:');
  console.log('  • An external app can pair with Pod and get a client token in one HTTP call');
  console.log('  • That client token is bound to an actor that needs grants to call connections');
  console.log('  • Grants are negotiated bidirectionally (agent requests, owner approves)');
  console.log('  • Pattern-scoped grants are enforced tool-by-tool, not all-or-nothing');
  console.log('  • Every call (success, denial, error) is recorded in the audit log');
  console.log('  • Token revocation cuts off access immediately');
} catch (err) {
  console.error('\n❌ Demo halted:', err.message);
  process.exitCode = 1;
} finally {
  // Always clean up state we created so re-runs start clean.
  if (CREATED_GRANT_ID) {
    const r = await http('DELETE', `/pod/connection-grants/${CREATED_GRANT_ID}`, OWNER_TOKEN);
    if (r.status === 200) console.log(`\n   ↻ cleanup: revoked connection_grant ${CREATED_GRANT_ID}`);
  }
  if (CLIENT_TOKEN) {
    const r = await http('POST', `/coffee/clients/${CLIENT_ID}/revoke`, OWNER_TOKEN);
    if (r.status === 200) console.log(`   ↻ cleanup: revoked client token ${CLIENT_ID}`);
  }
}
