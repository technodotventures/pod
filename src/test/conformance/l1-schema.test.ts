// L1 schema migration + adjacency table conformance tests (PR-4 / A3).
//
// We drive through SmartwareCore.open() (the substrate's public surface)
// and assert on the resulting SQLite db file. ClaimStore is internal; we
// don't reach into it directly.

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import Database from 'better-sqlite3';
import { SmartwareCore } from 'smartware';

async function openTestCore(): Promise<{ core: SmartwareCore; dataDir: string; dbPath: string }> {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-l1-schema-'));
  const core = await SmartwareCore.open({ dataDir });
  return { core, dataDir, dbPath: path.join(dataDir, 'smartware.db') };
}

test('A3: claims table has the spec v1.5.4.2 columns after SmartwareCore.open', async () => {
  const { core, dbPath } = await openTestCore();
  try {
    const db = new Database(dbPath, { readonly: true });
    const cols = (db.prepare('PRAGMA table_info(claims)').all() as Array<{ name: string }>).map((r) => r.name);
    db.close();

    for (const required of [
      'state',
      'author',
      'claim_type',
      'claim_role',
      'version_at',
      'created_at',
      'operation_id',
      'actor_id',
      'relations',
    ]) {
      assert.ok(
        cols.includes(required),
        `expected claims.${required} column after PR-4 migration; got ${cols.join(', ')}`,
      );
    }
  } finally {
    core.close();
  }
});

test('A3: claim_relations adjacency table exists with the spec shape', async () => {
  const { core, dbPath } = await openTestCore();
  try {
    const db = new Database(dbPath, { readonly: true });
    const cols = (db.prepare('PRAGMA table_info(claim_relations)').all() as Array<{ name: string }>).map(
      (r) => r.name,
    );
    db.close();

    for (const required of ['source_claim_id', 'source_version', 'kind', 'target_claim_id', 'valid_at', 'invalid_at']) {
      assert.ok(cols.includes(required), `claim_relations missing column ${required}; got ${cols.join(', ')}`);
    }
  } finally {
    core.close();
  }
});

test('A3: migration is idempotent — re-opening the same Pod does not duplicate columns', async () => {
  const { core, dataDir, dbPath } = await openTestCore();
  core.close();

  // The first open already ran migrateSchema. Re-opening should be a no-op.
  const secondCore = await SmartwareCore.open({ dataDir });
  try {
    const db = new Database(dbPath, { readonly: true });
    const cols = (db.prepare('PRAGMA table_info(claims)').all() as Array<{ name: string }>).map((r) => r.name);
    const stateCount = cols.filter((c) => c === 'state').length;
    db.close();

    assert.equal(stateCount, 1, 'state column should be present exactly once after re-open');
  } finally {
    secondCore.close();
  }
});
