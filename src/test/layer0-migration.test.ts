import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { Layer0Index } from '../../vendor/smartware/dist/layer0/index.js';

test('Layer0Index migrates legacy observations before creating the idempotency index', async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-layer0-migration-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const dbPath = path.join(dataDir, 'smartware.db');

  const legacy = new Database(dbPath);
  legacy.exec(`
    CREATE TABLE observations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      effective_status TEXT NOT NULL DEFAULT 'accepted',
      app TEXT NOT NULL,
      source_id TEXT,
      actor_id TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      scope TEXT NOT NULL,
      visibility TEXT NOT NULL,
      sensitive INTEGER NOT NULL DEFAULT 0,
      pii_detected INTEGER NOT NULL DEFAULT 0,
      captured_at TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      writer_id TEXT NOT NULL,
      hash TEXT NOT NULL DEFAULT ''
    );
  `);
  legacy.close();

  const index = new Layer0Index(dbPath);
  index.close();

  const migrated = new Database(dbPath, { readonly: true });
  const columns = migrated.prepare('PRAGMA table_info(observations)').all() as Array<{ name: string }>;
  const indexes = migrated.prepare('PRAGMA index_list(observations)').all() as Array<{ name: string }>;
  migrated.close();

  assert.deepEqual(
    ['idempotency_actor_id', 'idempotency_key', 'payload_hash'].map(name => columns.some(column => column.name === name)),
    [true, true, true],
  );
  assert.ok(indexes.some(indexRow => indexRow.name === 'idx_idempotency'));
});
