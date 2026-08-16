// Layer 0 — Derived Current-State Index (SQLite)
// Computes effective observation state by replaying all mutation events.
// This is derived — delete and rebuild from JSONL at any time.
import Database from 'better-sqlite3';
import { TERMINAL_STATES, TRANSITIONS } from './types.js';
import { readAll } from './log.js';
import { dirname } from 'node:path';
import { ensurePrivateDirectory, ensurePrivateFile } from '../storage/private-fs.js';
const SCHEMA = `
CREATE TABLE IF NOT EXISTS observations (
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
  hash TEXT NOT NULL DEFAULT '',
  idempotency_actor_id TEXT,
  idempotency_key TEXT,
  payload_hash TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dedup ON observations(app, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scope ON observations(scope);
CREATE INDEX IF NOT EXISTS idx_effective_status ON observations(effective_status);
CREATE INDEX IF NOT EXISTS idx_type ON observations(type);
CREATE INDEX IF NOT EXISTS idx_sequence ON observations(sequence);

-- Track last replayed sequence for incremental updates
CREATE TABLE IF NOT EXISTS replay_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
function hasColumn(db, table, column) {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all();
    return rows.some(row => row.name === column);
}
function ensureColumn(db, table, column, definition) {
    if (!hasColumn(db, table, column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}
export class Layer0Index {
    db;
    constructor(dbPath) {
        if (dbPath !== ':memory:')
            ensurePrivateDirectory(dirname(dbPath));
        this.db = new Database(dbPath);
        if (dbPath !== ':memory:')
            ensurePrivateFile(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('busy_timeout = 5000');
        this.db.pragma('foreign_keys = ON');
        this.db.exec(SCHEMA);
        ensureColumn(this.db, 'observations', 'idempotency_actor_id', 'TEXT');
        ensureColumn(this.db, 'observations', 'idempotency_key', 'TEXT');
        ensureColumn(this.db, 'observations', 'payload_hash', 'TEXT');
        this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency ON observations(idempotency_actor_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;
    `);
    }
    /** Rebuild the entire derived index from JSONL files */
    rebuildIndex(evidenceDir) {
        this.db.exec('DELETE FROM observations');
        this.db.exec('DELETE FROM replay_state');
        let lastSeq = 0;
        for (const obs of readAll(evidenceDir)) {
            this.insertOrSkip(obs);
            if (obs.type === 'tombstone' || obs.type === 'redaction' || obs.type === 'quarantine_review') {
                this.applyMutationEvent(obs);
            }
            lastSeq = obs.integrity.sequence;
        }
        this.db.prepare("INSERT OR REPLACE INTO replay_state (key, value) VALUES ('last_sequence', ?)")
            .run(String(lastSeq));
    }
    /** Replay only new events since last known sequence */
    catchUp(evidenceDir) {
        const row = this.db.prepare("SELECT value FROM replay_state WHERE key = 'last_sequence'").get();
        const lastSeq = row ? parseInt(row.value, 10) : 0;
        let newLastSeq = lastSeq;
        for (const obs of readAll(evidenceDir)) {
            if (obs.integrity.sequence <= lastSeq)
                continue;
            this.insertOrSkip(obs);
            if (obs.type === 'tombstone' || obs.type === 'redaction' || obs.type === 'quarantine_review') {
                this.applyMutationEvent(obs);
            }
            newLastSeq = Math.max(newLastSeq, obs.integrity.sequence);
        }
        if (newLastSeq > lastSeq) {
            this.db.prepare("INSERT OR REPLACE INTO replay_state (key, value) VALUES ('last_sequence', ?)")
                .run(String(newLastSeq));
        }
    }
    insertOrSkip(obs) {
        try {
            this.db.prepare(`
        INSERT OR IGNORE INTO observations
          (id, type, effective_status, app, source_id, actor_id, actor_type,
           scope, visibility, sensitive, pii_detected, captured_at, observed_at, sequence, writer_id, hash,
           idempotency_actor_id, idempotency_key, payload_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(obs.id, obs.type, obs.status, obs.source.app, obs.source.source_id ?? null, obs.source.actor.id, obs.source.actor.type, obs.scope, obs.visibility, obs.policy.sensitive ? 1 : 0, obs.policy.pii_detected ? 1 : 0, obs.source.captured_at, obs.source.observed_at, obs.integrity.sequence, obs.integrity.writer_id, obs.integrity.hash, obs.idempotency?.actor_id ?? null, obs.idempotency?.key ?? null, obs.idempotency?.payload_hash ?? null);
        }
        catch {
            // Duplicate insert — skip
        }
    }
    /** Apply a mutation event (tombstone / redaction / quarantine_review) */
    applyMutationEvent(event) {
        const body = event.content.body;
        const targetId = body['target_id'];
        const targetKind = body['target_kind'] ?? 'observation';
        if (!targetId || targetKind !== 'observation')
            return;
        const target = this.db.prepare('SELECT effective_status FROM observations WHERE id = ?').get(targetId);
        if (!target)
            return;
        const currentStatus = target.effective_status;
        if (TERMINAL_STATES.has(currentStatus)) {
            return;
        }
        let transitionKey = event.type;
        if (event.type === 'quarantine_review') {
            const action = body['action'];
            transitionKey = `quarantine_review:${action}`;
        }
        const transitions = TRANSITIONS[currentStatus];
        const newStatus = transitions?.[transitionKey];
        if (newStatus) {
            this.db.prepare('UPDATE observations SET effective_status = ? WHERE id = ?')
                .run(newStatus, targetId);
        }
    }
    /** Check dedup: return existing obs ID if source_id already seen for this app */
    checkDedup(app, sourceId) {
        const row = this.db.prepare('SELECT id FROM observations WHERE app = ? AND source_id = ?').get(app, sourceId);
        return row?.id ?? null;
    }
    checkIdempotency(actorId, key) {
        const row = this.db.prepare('SELECT id, payload_hash FROM observations WHERE idempotency_actor_id = ? AND idempotency_key = ?').get(actorId, key);
        return row ?? null;
    }
    /** Get effective state of an observation */
    getEffectiveStatus(obsId) {
        const row = this.db.prepare('SELECT effective_status FROM observations WHERE id = ?').get(obsId);
        return row?.effective_status ?? null;
    }
    getLastSequence() {
        const row = this.db.prepare('SELECT MAX(sequence) as s FROM observations').get();
        return row?.s ?? 0;
    }
    getLatestHashForWriter(writerId) {
        const row = this.db.prepare('SELECT hash FROM observations WHERE writer_id = ? ORDER BY sequence DESC LIMIT 1').get(writerId);
        return row?.hash ?? null;
    }
    countByStatus() {
        const rows = this.db.prepare('SELECT effective_status, COUNT(*) as count FROM observations GROUP BY effective_status').all();
        return Object.fromEntries(rows.map(row => [row.effective_status, row.count]));
    }
    getByScope(scope) {
        return this.db.prepare(`
      SELECT id, type, captured_at, observed_at FROM observations
      WHERE scope = ? AND effective_status = 'accepted'
      ORDER BY sequence ASC
    `).all(scope);
    }
    totalCount() {
        return this.db.prepare('SELECT COUNT(*) as count FROM observations').get().count;
    }
    close() {
        this.db.close();
    }
    getDB() {
        return this.db;
    }
}
//# sourceMappingURL=index.js.map