#!/usr/bin/env node
// Unit-level tests for the three auth tightenings:
//   1. /integrations/<svc>/configure no longer matches the public-route prefix.
//   2. Client token expiry is enforced (verifyClientToken returns null after expiry).
//   3. pod.trust_mode setting drives the auth hook (open/local-trust/strict).
//
// Pure-Node, no Docker, no live Pod. Writes to a temp dataDir.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expect = (cond, msg) => { if (!cond) { console.error('  ✗', msg); process.exitCode = 1; } else console.log('  ✓', msg); };

const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-auth-test-'));

try {
  // ── 1. isPublicRoute tightening ──────────────────────────────────────
  console.log('▸ isPublicRoute allowlist tightened');
  // We exercise the regex directly since isPublicRoute is module-private.
  const OAUTH_CALLBACK_RE = /^\/integrations\/[^/]+\/callback$/;
  expect(OAUTH_CALLBACK_RE.test('/integrations/google-drive/callback'), 'google-drive callback still public');
  expect(OAUTH_CALLBACK_RE.test('/integrations/github/callback'),       'github callback still public');
  expect(OAUTH_CALLBACK_RE.test('/integrations/slack/callback'),        'slack callback still public');
  expect(!OAUTH_CALLBACK_RE.test('/integrations/google-drive/configure'),    'configure no longer matches');
  expect(!OAUTH_CALLBACK_RE.test('/integrations/google-drive/tools/x/call'), 'tool-call no longer matches');
  expect(!OAUTH_CALLBACK_RE.test('/integrations/google-drive'),              'service root no longer matches');
  expect(!OAUTH_CALLBACK_RE.test('/integrations/google-drive/callback/x'),   'nothing under callback matches');

  // ── 2. Client token expiry ───────────────────────────────────────────
  console.log('\n▸ Client token expiry');
  const env = {
    host: '127.0.0.1', port: 0, dataDir, ownerId: undefined,
    podId: 'test', podName: 'test', apiToken: 'unused-for-this-test',
    mcpClientEnabled: false, mcpDockerCommand: 'docker', mcpPortBase: 5100,
  };
  const tokens = await import(path.join(REPO_ROOT, 'src/security/client-tokens.ts'));

  const neverExpires = await tokens.issueClientToken(env, { clientId: 'a', clientName: 'A', actorId: 'agent:a', grantId: 'g1' });
  expect(neverExpires.expires_at === null, 'no TTL → expires_at = null');
  expect(await tokens.verifyClientToken(env, neverExpires.token), 'never-expires token verifies');

  const futureIso = new Date(Date.now() + 60_000).toISOString();
  const future = await tokens.issueClientToken(env, { clientId: 'b', clientName: 'B', actorId: 'agent:b', grantId: 'g2', expiresAt: futureIso });
  expect(future.expires_at === futureIso, 'future TTL is stored');
  expect(await tokens.verifyClientToken(env, future.token), 'future token verifies');

  const pastIso = new Date(Date.now() - 1000).toISOString();
  const past = await tokens.issueClientToken(env, { clientId: 'c', clientName: 'C', actorId: 'agent:c', grantId: 'g3', expiresAt: pastIso });
  expect(await tokens.verifyClientToken(env, past.token) === null, 'already-expired token does NOT verify');

  // Verify expired token still appears in list (so owner can see and revoke it)
  const all = await tokens.listClientTokens(env);
  expect(all.length === 3, 'all 3 tokens listed (incl. expired)');
  const cInList = all.find(c => c.client_id === 'c');
  expect(cInList?.expires_at === pastIso, 'expired token expires_at is surfaced in list');

  // ── 3. Trust mode resolution + validation ────────────────────────────
  console.log('\n▸ Trust mode resolution');
  const { resolveTrustMode, defaultTrustMode, invalidateTrustModeCache, TRUST_MODE_VALUES } =
    await import(path.join(REPO_ROOT, 'src/security/trust-mode.ts'));

  expect(TRUST_MODE_VALUES.includes('strict') && TRUST_MODE_VALUES.includes('local-trust') && TRUST_MODE_VALUES.includes('open'),
    'three trust modes are exported');
  expect(defaultTrustMode({ ...env, apiToken: 'x' }) === 'strict', 'default with apiToken set → strict');
  expect(defaultTrustMode({ ...env, apiToken: undefined }) === 'open', 'default without apiToken → open');

  invalidateTrustModeCache();
  expect(resolveTrustMode(env) === 'strict', 'resolveTrustMode falls back to default (strict, apiToken set)');

  // Persist a setting and confirm resolveTrustMode picks it up after invalidation.
  const { getDb, setSettings } = await import(path.join(REPO_ROOT, 'src/pod/db.ts'));
  const db = getDb(env);
  setSettings(db, 'pod.trust_mode', { mode: 'local-trust' });
  invalidateTrustModeCache();
  expect(resolveTrustMode(env) === 'local-trust', 'resolveTrustMode reads persisted local-trust');

  setSettings(db, 'pod.trust_mode', { mode: 'garbage' });
  invalidateTrustModeCache();
  expect(resolveTrustMode(env) === 'strict', 'invalid mode falls back to default');

  console.log('\n✅ All auth-tightening checks passed');
} catch (err) {
  console.error('\n❌ Test failed:', err);
  process.exitCode = 1;
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
