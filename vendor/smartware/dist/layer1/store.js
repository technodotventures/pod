// Layer 1 — SQLite Claim Store
import Database from 'better-sqlite3';
import { compatibilityValidity, confidenceToBucket, epistemicToTag, inferredTime, knownTime, nullTime, statusToState, } from './types.js';
import { appendClaimVersion, iterAllClaimVersions, nextVersion } from './jsonl.js';
import { computeStructuredClaimFingerprint } from './fingerprint.js';
import { resolveEntity } from './entities.js';
import { dirname } from 'node:path';
import { ensurePrivateDirectory, ensurePrivateFile } from '../storage/private-fs.js';
const SCHEMA = `
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  type TEXT NOT NULL,
  scope TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entity_name ON entities(canonical_name);
CREATE INDEX IF NOT EXISTS idx_entity_scope ON entities(scope);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES entities(id),
  subject_name TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_value TEXT NOT NULL,
  scope TEXT NOT NULL,
  validity_from TEXT NOT NULL,
  validity_to TEXT,
  t_ingested_value TEXT,
  t_ingested_state TEXT NOT NULL DEFAULT 'known',
  t_ingested_basis TEXT,
  t_invalidated_value TEXT,
  t_invalidated_state TEXT NOT NULL DEFAULT 'null',
  t_invalidated_basis TEXT,
  t_valid_from_value TEXT,
  t_valid_from_state TEXT NOT NULL DEFAULT 'null',
  t_valid_from_basis TEXT,
  t_valid_to_value TEXT,
  t_valid_to_state TEXT NOT NULL DEFAULT 'null',
  t_valid_to_basis TEXT,
  source_event_id TEXT NOT NULL,
  extraction_event_id TEXT NOT NULL,
  supporting_evidence TEXT NOT NULL DEFAULT '[]',
  extraction_method TEXT NOT NULL,
  extraction_model TEXT,
  compiler_version TEXT NOT NULL,
  prompt_hash TEXT,
  extracted_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  epistemic TEXT NOT NULL,
  confidence REAL NOT NULL,
  sensitive INTEGER NOT NULL DEFAULT 0,
  superseded_by TEXT,
  contested_by TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_claim_canonical_key ON claims(subject_id, predicate, scope, validity_from);
CREATE INDEX IF NOT EXISTS idx_claim_subject ON claims(subject_id);
CREATE INDEX IF NOT EXISTS idx_claim_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claim_scope ON claims(scope);
CREATE INDEX IF NOT EXISTS idx_claim_predicate ON claims(predicate);

CREATE TABLE IF NOT EXISTS layer1_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Adjacency table for typed temporal claim-to-claim relations (Spec v1.6.16
-- §6). Latest-version-only: on each new claim version, prior rows for the
-- source_claim_id are deleted and rows for the new version's relations are
-- inserted. Canonical authority is the inline relations array in the JSONL
-- claim version record; this table is a derived query index.
CREATE TABLE IF NOT EXISTS claim_relations (
  relation_id               TEXT NOT NULL,
  source_claim_id           TEXT NOT NULL,
  source_version            INTEGER NOT NULL DEFAULT 1,
  kind                      TEXT NOT NULL,
  target_claim_id           TEXT NOT NULL,
  valid_at                  TEXT NOT NULL,
  invalid_at                TEXT,
  origin                    TEXT,
  asserted_in_source_version INTEGER,
  target_claim_version      INTEGER,
  provenance_json           TEXT,
  PRIMARY KEY (relation_id)
);

CREATE INDEX IF NOT EXISTS idx_rel_source ON claim_relations(source_claim_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON claim_relations(target_claim_id);
CREATE INDEX IF NOT EXISTS idx_rel_kind ON claim_relations(kind);
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
function serialiseTime(value) {
    return [value.value, value.state, value.basis ?? null];
}
function rowToTime(row, prefix, fallback) {
    const state = row[`${prefix}_state`];
    const value = row[`${prefix}_value`];
    const basis = row[`${prefix}_basis`];
    if (!state)
        return fallback;
    return {
        value: value ?? null,
        state: state,
        basis: basis ?? undefined,
    };
}
function rowToClaimRelation(row) {
    const origin = row['origin'] ?? 'user';
    const aisv = row['asserted_in_source_version'];
    const tcv = row['target_claim_version'];
    let provenance;
    const provenanceJson = row['provenance_json'];
    if (typeof provenanceJson === 'string' && provenanceJson) {
        try {
            provenance = JSON.parse(provenanceJson);
        }
        catch {
            provenance = { origin: 'user' };
        }
    }
    else if (aisv != null) {
        provenance = {
            origin: origin,
            asserted_in_source_version: aisv,
            target_claim_version: tcv ?? 1,
            observation_ids: [],
        };
    }
    else {
        provenance = { origin: 'user' };
    }
    return {
        relation_id: row['relation_id'] ?? '',
        kind: row['kind'],
        target: row['target_claim_id'],
        valid_at: row['valid_at'],
        invalid_at: row['invalid_at'] ?? null,
        provenance,
    };
}
export class ClaimStore {
    db;
    /** Pod data directory — set after construction by SmartwareCore. Used
     *  for the L1 JSONL canonical surface (PR-14). When null, JSONL writes
     *  are skipped (test/legacy paths). */
    dataDir = null;
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
        this.migrateSchema();
    }
    /** Set after construction. SmartwareCore.open() wires this. */
    setDataDir(dataDir) {
        this.dataDir = dataDir;
        const latestByClaim = new Map();
        for (const version of iterAllClaimVersions(dataDir)) {
            const latest = latestByClaim.get(version.claim_id);
            if (!latest || version.version > latest.version)
                latestByClaim.set(version.claim_id, version);
        }
        for (const version of latestByClaim.values())
            this.syncFromJsonlVersion(version);
    }
    getDataDir() {
        return this.dataDir;
    }
    /** Append a claim version record to the L1 JSONL canonical surface. */
    appendVersionRecord(record) {
        if (!this.dataDir)
            return;
        appendClaimVersion(this.dataDir, record);
    }
    /** Compute the next version number for a claim_id (1 if no history). */
    nextVersionFor(claimId) {
        if (!this.dataDir)
            return 1;
        return nextVersion(this.dataDir, claimId);
    }
    migrateSchema() {
        ensureColumn(this.db, 'claims', 't_ingested_value', 'TEXT');
        ensureColumn(this.db, 'claims', 't_ingested_state', "TEXT NOT NULL DEFAULT 'known'");
        ensureColumn(this.db, 'claims', 't_ingested_basis', 'TEXT');
        ensureColumn(this.db, 'claims', 't_invalidated_value', 'TEXT');
        ensureColumn(this.db, 'claims', 't_invalidated_state', "TEXT NOT NULL DEFAULT 'null'");
        ensureColumn(this.db, 'claims', 't_invalidated_basis', 'TEXT');
        ensureColumn(this.db, 'claims', 't_valid_from_value', 'TEXT');
        ensureColumn(this.db, 'claims', 't_valid_from_state', "TEXT NOT NULL DEFAULT 'null'");
        ensureColumn(this.db, 'claims', 't_valid_from_basis', 'TEXT');
        ensureColumn(this.db, 'claims', 't_valid_to_value', 'TEXT');
        ensureColumn(this.db, 'claims', 't_valid_to_state', "TEXT NOT NULL DEFAULT 'null'");
        ensureColumn(this.db, 'claims', 't_valid_to_basis', 'TEXT');
        // ── Spec v1.5.4.2 fields (PR-4 / A3) ────────────────────────────────
        ensureColumn(this.db, 'claims', 'state', "TEXT NOT NULL DEFAULT 'active'");
        ensureColumn(this.db, 'claims', 'author', "TEXT NOT NULL DEFAULT 'agent'");
        ensureColumn(this.db, 'claims', 'epistemic_owner', "TEXT NOT NULL DEFAULT 'agent'");
        ensureColumn(this.db, 'claims', 'claim_type', "TEXT NOT NULL DEFAULT 'finding'");
        ensureColumn(this.db, 'claims', 'claim_role', "TEXT NOT NULL DEFAULT 'memory'");
        ensureColumn(this.db, 'claims', 'version_at', 'TEXT');
        ensureColumn(this.db, 'claims', 'created_at', 'TEXT');
        ensureColumn(this.db, 'claims', 'operation_id', 'TEXT');
        ensureColumn(this.db, 'claims', 'actor_id', 'TEXT');
        ensureColumn(this.db, 'claims', 'relations', "TEXT NOT NULL DEFAULT '[]'");
        this.db.exec(`
      UPDATE claims
      SET
        t_ingested_value = COALESCE(t_ingested_value, extracted_at),
        t_ingested_state = COALESCE(NULLIF(t_ingested_state, ''), 'known'),
        t_valid_from_value = COALESCE(t_valid_from_value, validity_from),
        t_valid_from_state = CASE
          WHEN COALESCE(NULLIF(t_valid_from_state, ''), '') != '' THEN t_valid_from_state
          WHEN validity_from IS NOT NULL AND validity_from != '' THEN 'inferred'
          ELSE 'null'
        END,
        t_valid_from_basis = COALESCE(t_valid_from_basis, CASE
          WHEN validity_from IS NOT NULL AND validity_from != '' THEN 'legacy_validity_from'
          ELSE NULL
        END),
        t_valid_to_value = COALESCE(t_valid_to_value, validity_to),
        t_valid_to_state = CASE
          WHEN COALESCE(NULLIF(t_valid_to_state, ''), '') != '' THEN t_valid_to_state
          WHEN validity_to IS NOT NULL AND validity_to != '' THEN 'inferred'
          ELSE 'null'
        END,
        t_valid_to_basis = COALESCE(t_valid_to_basis, CASE
          WHEN validity_to IS NOT NULL AND validity_to != '' THEN 'legacy_validity_to'
          ELSE NULL
        END),
        t_invalidated_state = COALESCE(NULLIF(t_invalidated_state, ''), 'null')
    `);
        // Backfill spec-conformant columns on legacy rows.
        // state: project status → {active, forgotten}. retracted → forgotten;
        // everything else (active/superseded/contested/stale) → active.
        this.db.exec(`
      UPDATE claims
      SET state = CASE WHEN status = 'retracted' THEN 'forgotten' ELSE 'active' END
      WHERE state IS NULL OR state = '' OR (state = 'active' AND status = 'retracted')
    `);
        this.db.exec(`
      UPDATE claims
      SET epistemic_owner = author
      WHERE epistemic_owner IS NULL OR epistemic_owner = ''
    `);
        // version_at, created_at: backfill from extracted_at when absent.
        this.db.exec(`
      UPDATE claims
      SET version_at = COALESCE(version_at, extracted_at),
          created_at = COALESCE(created_at, extracted_at)
      WHERE version_at IS NULL OR created_at IS NULL
    `);
        // v0.6.0: claim_relations needs relation_id as PK + new columns.
        // The table is a derived index, safe to drop and recreate.
        if (!hasColumn(this.db, 'claim_relations', 'relation_id')) {
            this.db.exec('DROP TABLE IF EXISTS claim_relations');
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS claim_relations (
          relation_id               TEXT NOT NULL,
          source_claim_id           TEXT NOT NULL,
          source_version            INTEGER NOT NULL DEFAULT 1,
          kind                      TEXT NOT NULL,
          target_claim_id           TEXT NOT NULL,
          valid_at                  TEXT NOT NULL,
          invalid_at                TEXT,
          origin                    TEXT,
          asserted_in_source_version INTEGER,
          target_claim_version      INTEGER,
          provenance_json           TEXT,
          PRIMARY KEY (relation_id)
        )
      `);
            this.db.exec('CREATE INDEX IF NOT EXISTS idx_rel_source ON claim_relations(source_claim_id)');
            this.db.exec('CREATE INDEX IF NOT EXISTS idx_rel_target ON claim_relations(target_claim_id)');
            this.db.exec('CREATE INDEX IF NOT EXISTS idx_rel_kind ON claim_relations(kind)');
        }
        ensureColumn(this.db, 'claim_relations', 'provenance_json', 'TEXT');
    }
    insertEntity(entity) {
        this.db.prepare(`
      INSERT OR IGNORE INTO entities (id, canonical_name, aliases, type, scope, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(entity.id, entity.canonical_name, JSON.stringify(entity.aliases), entity.type, entity.scope, entity.created_at);
    }
    getEntity(id) {
        const row = this.db.prepare('SELECT * FROM entities WHERE id = ?').get(id);
        return row ? this.rowToEntity(row) : undefined;
    }
    findEntityByName(name, scope) {
        let sql = 'SELECT * FROM entities WHERE canonical_name = ?';
        const params = [name];
        if (scope) {
            sql += ' AND scope = ?';
            params.push(scope);
        }
        const row = this.db.prepare(sql).get(...params);
        return row ? this.rowToEntity(row) : undefined;
    }
    getAllEntities(scope) {
        const sql = scope
            ? 'SELECT * FROM entities WHERE scope = ? ORDER BY canonical_name'
            : 'SELECT * FROM entities ORDER BY canonical_name';
        const rows = scope
            ? this.db.prepare(sql).all(scope)
            : this.db.prepare(sql).all();
        return rows.map(row => this.rowToEntity(row));
    }
    updateEntityType(id, type) {
        this.db.prepare('UPDATE entities SET type = ? WHERE id = ?').run(type, id);
    }
    rowToEntity(row) {
        return {
            id: row['id'],
            canonical_name: row['canonical_name'],
            aliases: JSON.parse(row['aliases']),
            type: row['type'],
            scope: row['scope'],
            created_at: row['created_at'],
        };
    }
    insertClaim(claim) {
        const [tIngestedValue, tIngestedState, tIngestedBasis] = serialiseTime(claim.t_ingested);
        const [tInvalidatedValue, tInvalidatedState, tInvalidatedBasis] = serialiseTime(claim.t_invalidated);
        const [tValidFromValue, tValidFromState, tValidFromBasis] = serialiseTime(claim.t_valid_from);
        const [tValidToValue, tValidToState, tValidToBasis] = serialiseTime(claim.t_valid_to);
        // Spec-conformant fields default to spec-compliant values when the
        // caller hasn't supplied them. Legacy callers continue to work; new
        // emitters (PR-5+) populate explicitly.
        const state = claim.state ?? statusToState(claim.status);
        const author = claim.author ?? 'agent';
        const epistemicOwner = claim.epistemic_owner ?? author;
        const claimType = claim.claim_type ?? 'finding';
        const claimRole = claim.claim_role ?? 'memory';
        const versionAt = claim.version_at ?? claim.extraction.extracted_at;
        const createdAt = claim.created_at ?? claim.extraction.extracted_at;
        const operationId = claim.operation_id ?? null;
        const actorId = claim.actor_id ?? null;
        const relations = claim.relations ?? [];
        this.db.prepare(`
      INSERT OR REPLACE INTO claims
        (id, subject_id, subject_name, predicate, object_type, object_value,
         scope, validity_from, validity_to,
         t_ingested_value, t_ingested_state, t_ingested_basis,
         t_invalidated_value, t_invalidated_state, t_invalidated_basis,
         t_valid_from_value, t_valid_from_state, t_valid_from_basis,
         t_valid_to_value, t_valid_to_state, t_valid_to_basis,
         source_event_id, extraction_event_id,
         supporting_evidence, extraction_method, extraction_model, compiler_version,
         prompt_hash, extracted_at, status, epistemic, confidence, sensitive,
         superseded_by, contested_by,
         state, author, epistemic_owner, claim_type, claim_role,
         version_at, created_at, operation_id, actor_id, relations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?)
    `).run(claim.id, claim.subject_id, claim.subject_name, claim.predicate, claim.object.type, JSON.stringify(claim.object.value), claim.scope, claim.validity.from, claim.validity.to ?? null, tIngestedValue, tIngestedState, tIngestedBasis, tInvalidatedValue, tInvalidatedState, tInvalidatedBasis, tValidFromValue, tValidFromState, tValidFromBasis, tValidToValue, tValidToState, tValidToBasis, claim.source_event_id, claim.extraction_event_id, JSON.stringify(claim.supporting_evidence), claim.extraction.method, claim.extraction.model ?? null, claim.extraction.compiler_version, claim.extraction.prompt_hash ?? null, claim.extraction.extracted_at, claim.status, claim.epistemic, claim.confidence, claim.sensitive ? 1 : 0, claim.superseded_by ?? null, JSON.stringify(claim.contested_by), state, author, epistemicOwner, claimType, claimRole, versionAt, createdAt, operationId, actorId, JSON.stringify(relations));
        // Latest-version-only adjacency maintenance (Reference Impl v0.1.2):
        // delete any prior rows for this claim, then insert rows for the new
        // version's relations.
        this.refreshAdjacency(claim.id, relations);
        // L1 JSONL append (PR-14). One line per insertClaim invocation. The
        // version chain on disk grows monotonically; the SQLite row above is
        // a "latest active view" derived from these canonical records.
        if (this.dataDir) {
            const contentStr = typeof claim.object.value === 'string'
                ? claim.object.value
                : JSON.stringify(claim.object.value);
            const version = this.nextVersionFor(claim.id);
            const opId = operationId ?? 'op_LEGACY00000000000000000000';
            const actId = actorId ?? 'substrate:legacy';
            const fp = computeStructuredClaimFingerprint(claim.subject_name, claim.predicate, claim.object, claim.scope, claimType);
            const base = {
                claim_id: claim.id,
                version,
                claim_type: claimType,
                claim_role: claimRole,
                author,
                epistemic_owner: epistemicOwner,
                fingerprint: fp,
                confidence: confidenceToBucket(claim.confidence),
                epistemic_tag: epistemicToTag(claim.epistemic, claim.status),
                scope: claim.scope,
                derived_from: claim.supporting_evidence,
                relations,
                created_at: createdAt,
                version_at: versionAt,
                operation_id: opId,
                actor_id: actId,
                tags: [],
            };
            const record = state === 'active'
                ? {
                    ...base,
                    state: 'active',
                    content: contentStr,
                    semantic: {
                        subject_name: claim.subject_name,
                        subject_type: this.getEntity(claim.subject_id)?.type ?? 'concept',
                        predicate: claim.predicate,
                        object: claim.object,
                        t_valid_from: claim.t_valid_from,
                        t_valid_to: claim.t_valid_to,
                        extracted_epistemic: claim.epistemic,
                        extracted_confidence: claim.confidence,
                        sensitive: claim.sensitive,
                        extraction: claim.extraction,
                    },
                }
                : { ...base, state: 'forgotten', tombstone_id: `tomb_${claim.id.slice(6)}`, forgotten_at: versionAt, forgotten_by: actId };
            this.appendVersionRecord(record);
        }
    }
    /**
     * Replace adjacency rows for a single claim with the supplied relations.
     * Always invoked from insertClaim; safe to call standalone.
     */
    refreshAdjacency(claimId, relations) {
        this.db.prepare('DELETE FROM claim_relations WHERE source_claim_id = ?').run(claimId);
        const insertRel = this.db.prepare(`
      INSERT OR IGNORE INTO claim_relations
        (relation_id, source_claim_id, source_version, kind, target_claim_id,
         valid_at, invalid_at, origin, asserted_in_source_version,
         target_claim_version, provenance_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        for (const rel of relations) {
            insertRel.run(rel.relation_id, claimId, 'asserted_in_source_version' in rel.provenance
                ? rel.provenance.asserted_in_source_version
                : 1, rel.kind, rel.target, rel.valid_at, rel.invalid_at, rel.provenance.origin, 'asserted_in_source_version' in rel.provenance ? rel.provenance.asserted_in_source_version : null, 'target_claim_version' in rel.provenance ? rel.provenance.target_claim_version : null, JSON.stringify(rel.provenance));
        }
    }
    /** Outbound: source has relation `kind` to target. */
    getOutboundRelations(claimId, kind) {
        const sql = kind
            ? 'SELECT * FROM claim_relations WHERE source_claim_id = ? AND kind = ?'
            : 'SELECT * FROM claim_relations WHERE source_claim_id = ?';
        const rows = kind
            ? this.db.prepare(sql).all(claimId, kind)
            : this.db.prepare(sql).all(claimId);
        return rows.map(rowToClaimRelation);
    }
    /** Inbound: who has a relation pointing at this claim? */
    getInboundRelations(targetId, kind) {
        const sql = kind
            ? 'SELECT * FROM claim_relations WHERE target_claim_id = ? AND kind = ?'
            : 'SELECT * FROM claim_relations WHERE target_claim_id = ?';
        const rows = kind
            ? this.db.prepare(sql).all(targetId, kind)
            : this.db.prepare(sql).all(targetId);
        return rows.map((row) => ({
            ...rowToClaimRelation(row),
            source: row['source_claim_id'],
        }));
    }
    getClaim(id) {
        const row = this.db.prepare('SELECT * FROM claims WHERE id = ?').get(id);
        return row ? this.rowToClaim(row) : undefined;
    }
    findByCanonicalKey(subjectId, predicate, scope, validityFrom) {
        const row = this.db.prepare('SELECT * FROM claims WHERE subject_id = ? AND predicate = ? AND scope = ? AND validity_from = ?').get(subjectId, predicate, scope, validityFrom);
        return row ? this.rowToClaim(row) : undefined;
    }
    getClaimsBySubject(subjectId, status) {
        const sql = status
            ? 'SELECT * FROM claims WHERE subject_id = ? AND status = ?'
            : 'SELECT * FROM claims WHERE subject_id = ?';
        const rows = status
            ? this.db.prepare(sql).all(subjectId, status)
            : this.db.prepare(sql).all(subjectId);
        return rows.map(row => this.rowToClaim(row));
    }
    getActiveClaims(scope) {
        const sql = scope
            ? "SELECT * FROM claims WHERE status IN ('active', 'stale') AND scope = ?"
            : "SELECT * FROM claims WHERE status IN ('active', 'stale')";
        const rows = scope
            ? this.db.prepare(sql).all(scope)
            : this.db.prepare(sql).all();
        return rows.map(row => this.rowToClaim(row));
    }
    getAllClaims(scope) {
        const rows = scope
            ? this.db.prepare('SELECT * FROM claims WHERE scope = ?').all(scope)
            : this.db.prepare('SELECT * FROM claims').all();
        return rows.map(row => this.rowToClaim(row));
    }
    syncFromJsonlVersion(v, entityHint) {
        const existing = this.getClaim(v.claim_id);
        const content = v.state === 'active' ? v.content : '';
        const semantic = v.state === 'active' ? v.semantic : undefined;
        const confNum = v.confidence === 'high' ? 0.9 : v.confidence === 'medium' ? 0.5 : 0.2;
        const epist = v.epistemic_tag === 'fact' ? 'user_confirmed' : 'inferred';
        const status = v.state === 'active' ? 'active' : 'retracted';
        const now = v.created_at;
        const existingEntity = existing ? this.getEntity(existing.subject_id) : undefined;
        const entityName = semantic?.subject_name
            ?? entityHint?.name
            ?? existing?.subject_name
            ?? (content.slice(0, 50) || 'observation');
        const entityType = semantic?.subject_type ?? entityHint?.type ?? existingEntity?.type ?? 'concept';
        const predicate = semantic?.predicate ?? entityHint?.predicate ?? existing?.predicate ?? 'content_is';
        const object = semantic?.object ?? { type: 'text', value: content };
        const tValidFrom = semantic?.t_valid_from ?? existing?.t_valid_from ?? knownTime(now);
        const tValidTo = semantic?.t_valid_to ?? existing?.t_valid_to ?? nullTime();
        const [tValidFromValue, tValidFromState, tValidFromBasis] = serialiseTime(tValidFrom);
        const [tValidToValue, tValidToState, tValidToBasis] = serialiseTime(tValidTo);
        const validityFrom = tValidFrom.value ?? now;
        const validityTo = tValidTo.value;
        const sensitive = Number(semantic?.sensitive
            ?? entityHint?.sensitive
            ?? existing?.sensitive
            ?? false);
        const extraction = semantic?.extraction ?? existing?.extraction;
        const resolved = resolveEntity(entityName, entityType, v.scope, this);
        const entityId = resolved.id;
        const vals = [
            v.claim_id, entityId, entityName, predicate, object.type, JSON.stringify(object.value),
            v.scope, validityFrom, validityTo,
            now, 'known', null,
            null, 'null', null,
            tValidFromValue, tValidFromState, tValidFromBasis,
            tValidToValue, tValidToState, tValidToBasis,
            existing?.source_event_id ?? v.derived_from[0] ?? '',
            existing?.extraction_event_id ?? '',
            JSON.stringify(v.derived_from), extraction?.method ?? 'deterministic',
            extraction?.model ?? null, extraction?.compiler_version ?? '0.6.1',
            extraction?.prompt_hash ?? null, extraction?.extracted_at ?? now, status, epist, confNum, sensitive,
            existing?.superseded_by ?? null, JSON.stringify(existing?.contested_by ?? []),
            v.state, v.author, v.epistemic_owner, v.claim_type, v.claim_role,
            v.version_at, v.created_at, v.operation_id, v.actor_id, JSON.stringify(v.relations),
        ];
        const placeholders = vals.map(() => '?').join(', ');
        this.db.prepare(`
      INSERT OR REPLACE INTO claims
        (id, subject_id, subject_name, predicate, object_type, object_value,
         scope, validity_from, validity_to,
         t_ingested_value, t_ingested_state, t_ingested_basis,
         t_invalidated_value, t_invalidated_state, t_invalidated_basis,
         t_valid_from_value, t_valid_from_state, t_valid_from_basis,
         t_valid_to_value, t_valid_to_state, t_valid_to_basis,
         source_event_id, extraction_event_id,
         supporting_evidence, extraction_method, extraction_model, compiler_version,
         prompt_hash, extracted_at, status, epistemic, confidence, sensitive,
         superseded_by, contested_by,
         state, author, epistemic_owner, claim_type, claim_role,
         version_at, created_at, operation_id, actor_id, relations)
      VALUES (${placeholders})
    `).run(...vals);
        this.refreshAdjacency(v.claim_id, v.relations);
    }
    updateClaimStatus(id, status, supersededBy, invalidatedAt) {
        const claim = this.getClaim(id);
        if (!claim)
            return;
        claim.status = status;
        claim.state = statusToState(status);
        if (supersededBy !== undefined) {
            claim.superseded_by = supersededBy;
        }
        if (invalidatedAt) {
            claim.t_invalidated = invalidatedAt;
        }
        claim.validity = compatibilityValidity(claim.t_valid_from, claim.t_valid_to, claim.t_ingested);
        this.insertClaim(claim);
    }
    updateClaimSupportingEvidence(id, evidence) {
        const claim = this.getClaim(id);
        if (!claim)
            return;
        claim.supporting_evidence = evidence;
        this.insertClaim(claim);
    }
    updateClaimConfidence(id, confidence) {
        const claim = this.getClaim(id);
        if (!claim)
            return;
        claim.confidence = confidence;
        this.insertClaim(claim);
    }
    markContested(id1, id2) {
        const first = this.getClaim(id1);
        const second = this.getClaim(id2);
        if (!first || !second)
            return;
        first.contested_by = [...new Set([...first.contested_by, id2])];
        second.contested_by = [...new Set([...second.contested_by, id1])];
        first.status = 'contested';
        second.status = 'contested';
        this.insertClaim(first);
        this.insertClaim(second);
    }
    redactClaim(id) {
        const claim = this.getClaim(id);
        if (!claim)
            return;
        claim.object = { type: 'text', value: '[redacted]' };
        this.insertClaim(claim);
    }
    deleteAllClaims() {
        this.db.exec('DELETE FROM claims');
        this.db.exec('DELETE FROM entities');
    }
    setLastReplayedSequence(seq) {
        this.db.prepare("INSERT OR REPLACE INTO layer1_state (key, value) VALUES ('last_replayed_sequence', ?)")
            .run(String(seq));
    }
    getLastReplayedSequence() {
        const row = this.db.prepare("SELECT value FROM layer1_state WHERE key = 'last_replayed_sequence'").get();
        return row ? parseInt(row.value, 10) : 0;
    }
    claimCount() {
        return this.db.prepare('SELECT COUNT(*) as count FROM claims').get().count;
    }
    entityCount() {
        return this.db.prepare('SELECT COUNT(*) as count FROM entities').get().count;
    }
    rowToClaim(row) {
        const extractedAt = row['extracted_at'];
        const fallbackIngested = knownTime(extractedAt);
        const tIngested = rowToTime(row, 't_ingested', fallbackIngested);
        const tInvalidated = rowToTime(row, 't_invalidated', nullTime());
        const legacyValidFrom = row['validity_from'];
        const legacyValidTo = row['validity_to'];
        const tValidFrom = rowToTime(row, 't_valid_from', legacyValidFrom ? inferredTime(legacyValidFrom, 'legacy_validity_from') : nullTime());
        const tValidTo = rowToTime(row, 't_valid_to', legacyValidTo ? inferredTime(legacyValidTo, 'legacy_validity_to') : nullTime());
        const validity = compatibilityValidity(tValidFrom, tValidTo, tIngested);
        return {
            id: row['id'],
            subject_id: row['subject_id'],
            subject_name: row['subject_name'],
            predicate: row['predicate'],
            object: {
                type: row['object_type'],
                value: JSON.parse(row['object_value']),
            },
            scope: row['scope'],
            validity,
            t_ingested: tIngested,
            t_invalidated: tInvalidated,
            t_valid_from: tValidFrom,
            t_valid_to: tValidTo,
            source_event_id: row['source_event_id'],
            extraction_event_id: row['extraction_event_id'],
            supporting_evidence: JSON.parse(row['supporting_evidence']),
            extraction: {
                method: row['extraction_method'],
                model: row['extraction_model'],
                compiler_version: row['compiler_version'],
                prompt_hash: row['prompt_hash'],
                extracted_at: extractedAt,
            },
            status: row['status'],
            epistemic: row['epistemic'],
            confidence: row['confidence'],
            sensitive: !!row['sensitive'],
            superseded_by: row['superseded_by'],
            contested_by: JSON.parse(row['contested_by']),
            // Spec v1.5.4.2 fields. Backfilled on legacy rows during migrateSchema.
            state: (row['state'] ?? statusToState(row['status'])),
            author: (row['author'] ?? 'agent'),
            epistemic_owner: (row['epistemic_owner']
                ?? row['author']
                ?? 'agent'),
            claim_type: (row['claim_type'] ?? 'finding'),
            claim_role: (row['claim_role'] ?? 'memory'),
            version_at: (row['version_at'] ?? extractedAt),
            created_at: (row['created_at'] ?? extractedAt),
            operation_id: row['operation_id'] ?? null,
            actor_id: row['actor_id'] ?? null,
            relations: row['relations']
                ? JSON.parse(row['relations'])
                : [],
        };
    }
    close() {
        this.db.close();
    }
    getDB() {
        return this.db;
    }
}
//# sourceMappingURL=store.js.map