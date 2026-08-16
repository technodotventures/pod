#!/usr/bin/env node
/** Unit-level test for the connection_grants logic (no server, no docker). */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { getDb, closeDb } = await import(path.join(REPO_ROOT, 'src/pod/db.ts'));
const { createConnectionGrant, checkConnectionGrant, revokeConnectionGrant, listConnectionGrants } =
  await import(path.join(REPO_ROOT, 'src/services/connections/grants.ts'));

const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-grants-test-'));
const env = {
  host: '127.0.0.1', port: 0, dataDir, ownerId: undefined,
  podId: 'test', podName: 'test', apiToken: undefined,
  mcpClientEnabled: false, mcpDockerCommand: 'docker', mcpPortBase: 5100,
};

const expect = (cond, msg) => { if (!cond) { console.error('  ✗', msg); process.exitCode = 1; } else console.log('  ✓', msg); };

try {
  const db = getDb(env);

  console.log('▸ Create a read-only grant for alice on google-drive');
  const grant = createConnectionGrant(db, {
    actor_id: 'alice', service_id: 'google-drive',
    tool_pattern: 'google_drive_search_*', created_by: 'owner', note: 'test',
  });
  expect(grant.id.startsWith('cgrant_'), 'grant has an id');
  expect(grant.tool_pattern === 'google_drive_search_*', 'tool_pattern stored');

  console.log('\n▸ Pattern matching');
  expect(checkConnectionGrant(db, 'alice', 'google-drive', 'google_drive_search_documents') !== null, 'alice can search_documents (matches pattern)');
  expect(checkConnectionGrant(db, 'alice', 'google-drive', 'google_drive_search_and_retrieve_documents') !== null, 'alice can search_and_retrieve (matches pattern)');
  expect(checkConnectionGrant(db, 'alice', 'google-drive', 'google_drive_get_document_by_id') === null, 'alice CANNOT get_document_by_id (no match)');
  expect(checkConnectionGrant(db, 'alice', 'google-drive', 'google_drive_empty_trash') === null, 'alice CANNOT empty_trash (no match)');

  console.log('\n▸ Wrong service / wrong actor');
  expect(checkConnectionGrant(db, 'alice', 'gmail', 'google_drive_search_documents') === null, 'alice has no gmail grant');
  expect(checkConnectionGrant(db, 'bob', 'google-drive', 'google_drive_search_documents') === null, 'bob has no grant at all');

  console.log('\n▸ Wildcard grant for bob');
  createConnectionGrant(db, { actor_id: 'bob', service_id: 'google-drive', tool_pattern: '*', created_by: 'owner' });
  expect(checkConnectionGrant(db, 'bob', 'google-drive', 'google_drive_empty_trash') !== null, 'bob can call anything');

  console.log('\n▸ Expired grant');
  createConnectionGrant(db, {
    actor_id: 'carol', service_id: 'google-drive', tool_pattern: '*',
    expires_at: Date.now() - 1000, created_by: 'owner',
  });
  expect(checkConnectionGrant(db, 'carol', 'google-drive', 'google_drive_search_documents') === null, 'carol expired grant is denied');

  console.log('\n▸ Revoke flow');
  const all = listConnectionGrants(db, { actor_id: 'alice' });
  expect(all.length === 1, 'alice has 1 grant');
  const revoked = revokeConnectionGrant(db, all[0].id);
  expect(revoked.revoked_at !== null, 'grant has revoked_at after revoke');
  expect(checkConnectionGrant(db, 'alice', 'google-drive', 'google_drive_search_documents') === null, 'alice is denied after revoke');

  console.log('\n▸ List filters');
  const driveGrants = listConnectionGrants(db, { service_id: 'google-drive' });
  expect(driveGrants.length === 3, 'three grants total for google-drive');

  console.log('\n✅ All grants checks passed');
} catch (err) {
  console.error('\n❌ Test failed:', err);
  process.exitCode = 1;
} finally {
  closeDb();
  await rm(dataDir, { recursive: true, force: true });
}
