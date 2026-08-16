/**
 * Pod SQLite database layer.
 * Replaces JSON file storage with better-sqlite3.
 * Single DB file at {dataDir}/pod.db — local-first, no network.
 */
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

import type { CoffeePodEnv } from '../config/env.js';
import { writeObjectToVault, deleteObjectFromVault, initVault } from '../services/vault-writer.js';
import {
  normaliseAgentAccessMode,
  scopesForAgentStorage,
  type AgentAccessMode,
} from './agent-access.js';

/* ── Types ── */

export const DEFAULT_WORKSPACE_ID = 'default';

export interface PodWorkspace {
  id: string;
  name: string;
  emoji: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface PodCollection {
  id: string;
  workspace_id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

export interface PodObject {
  id: string;
  workspace_id: string;
  collection_id: string;
  kind: string;
  title: string;
  content: unknown | null;
  origin: string | null;
  created_origin: string | null;
  last_modified_by: string | null;
  sync_status: string | null;
  processing_state: string | null;
  source_app: string | null;
  source_external_id: string | null;
  source_url: string | null;
  version: number;
  hash_algorithm: string;
  hash_value: string;
  summary: string | null;
  tags: string[];
  sensitive: boolean;
  deleted_at: string | null;
  redacted_at: string | null;
  archived_at: string | null;
  reflection_claim_count: number;
  needs_review: boolean;
  metadata: Record<string, unknown> | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PodObjectReference {
  source_object_id: string;
  target_object_id: string;
  reference_type: 'belongs_to' | 'related_to' | 'derived_from' | 'mentions' | 'other_links';
  source_kind: string;
  source_title: string;
  target_title: string;
  /** Original title key written by the source. Stable across target renames. */
  reference_key: string;
  created_at: string;
  updated_at: string;
}

export interface PodObjectMemoryObservation {
  observation_id: string;
  object_id: string;
  object_version: number;
  object_hash: string;
  source_app: string;
  source_id: string;
  scope: string;
  status: 'active' | 'retired';
  created_at: string;
  retired_at: string | null;
}

export interface PodGraphAnnotation {
  id: string;
  source_node_id: string;
  target_node_id: string;
  label: string | null;
  relation: string | null;
  direction: 'directed' | 'undirected';
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PodEvent {
  id: string;
  workspace_id: string;
  type: string;
  process: string;
  actor_id: string;
  scope: string;
  title: string;
  detail: string | null;
  content: unknown | null;
  requires_attention: boolean;
  resolved_at: string | null;
  dismissed_at: string | null;
  severity: string | null;
  attention_reason: string | null;
  attention_action_label: string | null;
  attention_action: string | null;
  observed_at: string;
}

export interface PodImport {
  id: string;
  workspace_id: string;
  source: string;
  file_count: number;
  destination: string;
  status: 'pending' | 'importing' | 'completed' | 'partial' | 'failed';
  errors: number;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PodSavedView {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface PodSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  source: 'coffee' | 'skills.sh' | 'skillsmp' | 'clawhub' | 'github' | 'local' | 'manual';
  source_slug: string | null;
  scope: string;
  status: 'approved' | 'installed' | 'review' | 'possible' | 'disabled' | 'flagged';
  trust_score: number;
  trust_level: 'high' | 'medium' | 'caution' | 'blocked';
  permissions: string[];
  grant_id: string | null;
  actor_id: string | null;
  equipped_to: string[];
  portability: 'local' | 'exportable' | 'synced';
  runs: number;
  failures: number;
  last_run: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

export interface PodSkillBinding {
  skill_id: string;
  agent_id: string;
  status: 'pending' | 'active' | 'disabled';
  grant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PodSkillRevision {
  id: string;
  skill_id: string;
  revision_number: number;
  version: string;
  status: 'draft' | 'approved' | 'superseded' | 'rejected';
  content_hash: string;
  revision_fingerprint: string;
  content: string | null;
  files: Record<string, string> | null;
  origin: PodSkill['source'];
  source_ref: string | null;
  created_by: string;
  summary: string;
  created_at: string;
  approved_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PodSkillDeployment {
  id: string;
  skill_id: string;
  agent_id: string;
  desired_revision_id: string | null;
  installed_revision_id: string | null;
  status: 'pending' | 'ready' | 'synced' | 'drifted' | 'blocked';
  adapter: string;
  target_path: string | null;
  installed_hash: string | null;
  last_error: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

export interface PodPluginPackageFile {
  encoding: 'utf8' | 'base64';
  content: string;
  size: number;
  sha256: string;
}

export interface PodPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  source: 'local' | 'github' | 'manual';
  source_ref: string | null;
  status: 'review' | 'approved' | 'disabled' | 'flagged';
  schema_version: string;
  trust_score: number;
  trust_level: 'high' | 'medium' | 'caution' | 'blocked';
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

export interface PodPluginRevision {
  id: string;
  plugin_id: string;
  revision_number: number;
  version: string;
  status: 'draft' | 'approved' | 'superseded' | 'rejected';
  package_hash: string;
  revision_fingerprint: string;
  schema_uri: string;
  manifest: Record<string, unknown>;
  files: Record<string, PodPluginPackageFile>;
  inspection: Record<string, unknown>;
  source_ref: string | null;
  created_by: string;
  created_at: string;
  approved_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PodPluginRevisionComponent {
  revision_id: string;
  component_type: 'skill' | 'mcp_server' | 'extension';
  component_key: string;
  status: 'valid' | 'invalid' | 'unsupported';
  detail: Record<string, unknown>;
}

export interface PodJob {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  payload: unknown;
  result: unknown | null;
  error: string | null;
  attempts: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
  run_at: string | null;
}

/* ── ID generation ── */

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString('base64url')}`;
}

function now(): string {
  return new Date().toISOString();
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableJson(val)}`).join(',')}}`;
}

function normalizeMarkdownBody(body: string): string {
  const normalized = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

function canonicalObjectInput(kind: string, title: string, content: unknown, metadata: Record<string, unknown> | null, tags: string[]): string {
  if (kind === 'markdown' || kind === 'page' || kind === 'note' || kind === 'text' || kind === 'html') {
    const body = typeof content === 'string'
      ? content
      : typeof (content as Record<string, unknown> | null)?.['text'] === 'string'
        ? String((content as Record<string, unknown>)['text'])
        : stableJson(content);
    const frontmatter = {
      tags,
      title,
    };
    return `${stableJson(frontmatter)}\n${normalizeMarkdownBody(body)}`;
  }
  return stableJson({
    kind,
    title,
    content,
    tags,
    metadata: metadata ?? {},
  });
}

function hashObject(kind: string, title: string, content: unknown, metadata: Record<string, unknown> | null, tags: string[]): { algorithm: string; value: string } {
  const input = canonicalObjectInput(kind, title, content, metadata, tags);
  return {
    algorithm: 'sha256',
    value: crypto.createHash('sha256').update(input).digest('hex'),
  };
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const tag of tags) {
    const clean = tag.trim().replace(/^#/, '');
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
  }
  return output;
}

function buildSummary(content: unknown, metadata: Record<string, unknown> | null): string | null {
  const candidate = metadata?.['summary'];
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  if (typeof content === 'string') {
    return summarizeText(content);
  }
  const text = typeof (content as Record<string, unknown> | null)?.['text'] === 'string'
    ? String((content as Record<string, unknown>)['text'])
    : null;
  return text ? summarizeText(text) : null;
}

function summarizeText(text: string): string | null {
  const normalized = text
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#'));
  if (!normalized) return null;
  return normalized.length > 180 ? `${normalized.slice(0, 177).trimEnd()}...` : normalized;
}

function asMetadataRecord(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return value ? { ...value } : {};
}

/* ── Database singleton ── */

let _db: Database.Database | null = null;
let _dataDir: string = '';

export function getDb(env: CoffeePodEnv): Database.Database {
  if (_db) return _db;

  _dataDir = env.dataDir;
  fs.mkdirSync(env.dataDir, { recursive: true });
  const dbPath = path.join(env.dataDir, 'pod.db');

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('foreign_keys = ON');

  migrate(_db);
  backfillObjectReferenceIntents(_db);
  initVault(env.dataDir);
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/* ── Schema migrations ── */

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id          TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      name        TEXT NOT NULL,
      parent_id   TEXT,
      description TEXT,
      metadata    TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS objects (
      id                 TEXT PRIMARY KEY,
      workspace_id       TEXT NOT NULL DEFAULT 'default',
      collection_id      TEXT NOT NULL DEFAULT 'library',
      kind               TEXT NOT NULL,
      title              TEXT NOT NULL,
      content            TEXT,
      origin             TEXT,
      created_origin     TEXT,
      last_modified_by   TEXT,
      sync_status        TEXT,
      processing_state   TEXT,
      source_app         TEXT,
      source_external_id TEXT,
      source_url         TEXT,
      version            INTEGER NOT NULL DEFAULT 1,
      hash_algorithm     TEXT NOT NULL DEFAULT 'sha256',
      hash_value         TEXT NOT NULL DEFAULT '',
      summary            TEXT,
      tags               TEXT NOT NULL DEFAULT '[]',
      sensitive          INTEGER NOT NULL DEFAULT 0,
      deleted_at         TEXT,
      redacted_at        TEXT,
      archived_at        TEXT,
      reflection_claim_count INTEGER NOT NULL DEFAULT 0,
      needs_review       INTEGER NOT NULL DEFAULT 0,
      metadata           TEXT,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS object_references (
      source_object_id TEXT NOT NULL,
      target_object_id TEXT NOT NULL,
      reference_type  TEXT NOT NULL,
      source_kind     TEXT NOT NULL,
      source_title    TEXT NOT NULL,
      target_title    TEXT NOT NULL,
      reference_key  TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      PRIMARY KEY (source_object_id, target_object_id, reference_type),
      FOREIGN KEY (source_object_id) REFERENCES objects(id) ON DELETE CASCADE,
      FOREIGN KEY (target_object_id) REFERENCES objects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS object_reference_intents (
      source_object_id TEXT NOT NULL,
      reference_type  TEXT NOT NULL,
      target_title    TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      PRIMARY KEY (source_object_id, reference_type, target_title),
      FOREIGN KEY (source_object_id) REFERENCES objects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS object_memory_observations (
      observation_id TEXT PRIMARY KEY,
      object_id      TEXT NOT NULL,
      object_version INTEGER NOT NULL,
      object_hash    TEXT NOT NULL,
      source_app     TEXT NOT NULL,
      source_id      TEXT NOT NULL,
      scope          TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'active',
      created_at     TEXT NOT NULL,
      retired_at     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_object_memory_observations_object
      ON object_memory_observations(object_id, status, object_version);

    CREATE TABLE IF NOT EXISTS graph_annotations (
      id             TEXT PRIMARY KEY,
      source_node_id TEXT NOT NULL,
      target_node_id TEXT NOT NULL,
      label          TEXT,
      relation       TEXT,
      direction      TEXT NOT NULL DEFAULT 'directed' CHECK (direction IN ('directed', 'undirected')),
      note           TEXT,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      key        TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id                     TEXT PRIMARY KEY,
      workspace_id           TEXT NOT NULL DEFAULT 'default',
      type                   TEXT NOT NULL,
      process                TEXT NOT NULL,
      actor_id               TEXT NOT NULL DEFAULT 'system',
      scope                  TEXT NOT NULL DEFAULT 'personal',
      title                  TEXT NOT NULL,
      detail                 TEXT,
      content                TEXT,
      requires_attention     INTEGER NOT NULL DEFAULT 0,
      resolved_at            TEXT,
      dismissed_at           TEXT,
      severity               TEXT,
      attention_reason       TEXT,
      attention_action_label TEXT,
      attention_action       TEXT,
      observed_at            TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS imports (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      source       TEXT NOT NULL,
      file_count   INTEGER NOT NULL DEFAULT 0,
      destination  TEXT NOT NULL DEFAULT 'inbox',
      status       TEXT NOT NULL DEFAULT 'pending',
      errors       INTEGER NOT NULL DEFAULT 0,
      started_at   TEXT NOT NULL,
      completed_at TEXT,
      metadata     TEXT
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id           TEXT PRIMARY KEY,
      type         TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      payload      TEXT,
      result       TEXT,
      error        TEXT,
      attempts     INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      run_at       TEXT
    );

    CREATE TABLE IF NOT EXISTS pod_settings (
      namespace  TEXT NOT NULL,
      key        TEXT NOT NULL,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (namespace, key)
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      emoji      TEXT NOT NULL DEFAULT '🏠',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_views (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      filters    TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS observation_idempotency (
      actor_id        TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      payload_hash    TEXT NOT NULL,
      observation_id  TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      PRIMARY KEY (actor_id, idempotency_key)
    );

    -- Spec-conformant OperationId idempotency per Protocol Contract v0.4.1.
    -- Distinct from observation_idempotency (which is per-actor, OBSERVE-only).
    -- This table covers every mutating verb (observe/revise/forget/reflect).
    -- Same operation_id + same payload_hash → return cached result_json.
    -- Same operation_id + different payload_hash → conflict.
    CREATE TABLE IF NOT EXISTS operations_seen (
      operation_id  TEXT PRIMARY KEY,
      actor_id      TEXT NOT NULL,
      op            TEXT NOT NULL,
      payload_hash  TEXT NOT NULL,
      result_json   TEXT NOT NULL,
      commit_ts     TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_operations_seen_actor ON operations_seen(actor_id);
    CREATE INDEX IF NOT EXISTS idx_operations_seen_op ON operations_seen(op);

    CREATE TABLE IF NOT EXISTS usage_ledger (
      id             TEXT PRIMARY KEY,
      source         TEXT NOT NULL,
      skill_id       TEXT,
      operation      TEXT NOT NULL,
      period         TEXT NOT NULL,
      estimated_tokens INTEGER NOT NULL DEFAULT 0,
      actual_tokens    INTEGER NOT NULL DEFAULT 0,
      blocked_reason TEXT,
      created_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      version      TEXT NOT NULL DEFAULT '0.0.0',
      author       TEXT NOT NULL DEFAULT 'unknown',
      source       TEXT NOT NULL DEFAULT 'manual',
      source_slug  TEXT,
      scope        TEXT NOT NULL DEFAULT 'personal',
      status       TEXT NOT NULL DEFAULT 'review',
      trust_score  INTEGER NOT NULL DEFAULT 0,
      trust_level  TEXT NOT NULL DEFAULT 'blocked',
      permissions  TEXT NOT NULL DEFAULT '[]',
      grant_id     TEXT,
      actor_id     TEXT,
      equipped_to  TEXT NOT NULL DEFAULT '[]',
      portability  TEXT NOT NULL DEFAULT 'local',
      runs         INTEGER NOT NULL DEFAULT 0,
      failures     INTEGER NOT NULL DEFAULT 0,
      last_run     TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      metadata     TEXT
    );

    CREATE TABLE IF NOT EXISTS skill_bindings (
      skill_id    TEXT NOT NULL,
      agent_id    TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      grant_id    TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      PRIMARY KEY (skill_id, agent_id),
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS skill_revisions (
      id              TEXT PRIMARY KEY,
      skill_id        TEXT NOT NULL,
      revision_number INTEGER NOT NULL,
      version         TEXT NOT NULL DEFAULT '0.0.0',
      status          TEXT NOT NULL DEFAULT 'draft',
      content_hash    TEXT NOT NULL,
      revision_fingerprint TEXT NOT NULL,
      content         TEXT,
      files           TEXT,
      origin          TEXT NOT NULL DEFAULT 'manual',
      source_ref      TEXT,
      created_by      TEXT NOT NULL DEFAULT 'person-local',
      summary         TEXT NOT NULL DEFAULT '',
      created_at      TEXT NOT NULL,
      approved_at     TEXT,
      metadata        TEXT,
      UNIQUE (skill_id, revision_number),
      UNIQUE (skill_id, revision_fingerprint),
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS skill_deployments (
      id                    TEXT PRIMARY KEY,
      skill_id              TEXT NOT NULL,
      agent_id              TEXT NOT NULL,
      desired_revision_id   TEXT,
      installed_revision_id TEXT,
      status                TEXT NOT NULL DEFAULT 'pending',
      adapter               TEXT NOT NULL DEFAULT 'unresolved',
      target_path           TEXT,
      installed_hash        TEXT,
      last_error            TEXT,
      last_checked_at       TEXT,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL,
      metadata              TEXT,
      UNIQUE (skill_id, agent_id),
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
      FOREIGN KEY (desired_revision_id) REFERENCES skill_revisions(id) ON DELETE SET NULL,
      FOREIGN KEY (installed_revision_id) REFERENCES skill_revisions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS plugins (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      description    TEXT NOT NULL DEFAULT '',
      version        TEXT NOT NULL DEFAULT '0.0.0',
      author         TEXT NOT NULL DEFAULT 'unknown',
      source         TEXT NOT NULL DEFAULT 'manual',
      source_ref     TEXT,
      status         TEXT NOT NULL DEFAULT 'review',
      schema_version TEXT NOT NULL,
      trust_score    INTEGER NOT NULL DEFAULT 0,
      trust_level    TEXT NOT NULL DEFAULT 'blocked',
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL,
      metadata       TEXT
    );

    CREATE TABLE IF NOT EXISTS plugin_revisions (
      id                   TEXT PRIMARY KEY,
      plugin_id            TEXT NOT NULL,
      revision_number      INTEGER NOT NULL,
      version              TEXT NOT NULL DEFAULT '0.0.0',
      status               TEXT NOT NULL DEFAULT 'draft',
      package_hash         TEXT NOT NULL,
      revision_fingerprint TEXT NOT NULL,
      schema_uri           TEXT NOT NULL,
      manifest             TEXT NOT NULL,
      files                TEXT NOT NULL,
      inspection           TEXT NOT NULL,
      source_ref           TEXT,
      created_by           TEXT NOT NULL DEFAULT 'person-local',
      created_at           TEXT NOT NULL,
      approved_at          TEXT,
      metadata             TEXT,
      UNIQUE (plugin_id, revision_number),
      UNIQUE (plugin_id, revision_fingerprint),
      FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plugin_revision_components (
      revision_id    TEXT NOT NULL,
      component_type TEXT NOT NULL,
      component_key  TEXT NOT NULL,
      status         TEXT NOT NULL,
      detail         TEXT NOT NULL,
      PRIMARY KEY (revision_id, component_type, component_key),
      FOREIGN KEY (revision_id) REFERENCES plugin_revisions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS connection_grants (
      id            TEXT PRIMARY KEY,
      actor_id      TEXT NOT NULL,
      service_id    TEXT NOT NULL,
      tool_pattern  TEXT NOT NULL DEFAULT '*',
      expires_at    INTEGER,
      revoked_at    TEXT,
      created_at    TEXT NOT NULL,
      created_by    TEXT NOT NULL,
      note          TEXT
    );

    CREATE TABLE IF NOT EXISTS connection_grant_requests (
      id                 TEXT PRIMARY KEY,
      actor_id           TEXT NOT NULL,
      service_id         TEXT NOT NULL,
      tool_pattern       TEXT NOT NULL DEFAULT '*',
      reason             TEXT,
      requested_expires_at INTEGER,
      status             TEXT NOT NULL DEFAULT 'pending',
      resolved_at        TEXT,
      resolved_by        TEXT,
      approved_grant_id  TEXT,
      created_at         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcp_tool_calls (
      id            TEXT PRIMARY KEY,
      actor_id      TEXT NOT NULL,
      service_id    TEXT NOT NULL,
      tool_name     TEXT NOT NULL,
      args_summary  TEXT,
      status        TEXT NOT NULL,
      error_kind    TEXT,
      duration_ms   INTEGER NOT NULL,
      grant_id      TEXT,
      caller_kind   TEXT NOT NULL,
      observed_at   TEXT NOT NULL
    );

    /* ── Named agents (Hermes, Pythia, etc.) + enforced memory access.
       Collection grants are retained as legacy compatibility metadata. ── */
    CREATE TABLE IF NOT EXISTS agents (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      role          TEXT NOT NULL DEFAULT 'agent',       -- agent | substrate | system
      workspace_id  TEXT,
      model         TEXT,                                  -- e.g. "claude-sonnet-4-6"
      status        TEXT NOT NULL DEFAULT 'active',
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      created_by    TEXT NOT NULL DEFAULT 'user',
      metadata      TEXT,
      -- Per-agent bearer token. Generated on insert, rotated via the
      -- /rotate-token route. The user pastes Bearer <token> into the
      -- agent connection config so revoking one agent does not affect
      -- the others.
      auth_token    TEXT,
      -- Agent behaviour plus its least-privilege memory boundary and a
      -- default context-pack token budget.
      persona        TEXT,
      access_mode    TEXT NOT NULL DEFAULT 'scoped',
      scopes         TEXT,
      context_budget INTEGER
    );

    CREATE TABLE IF NOT EXISTS agent_collection_grants (
      id            TEXT PRIMARY KEY,
      agent_id      TEXT NOT NULL,
      collection_id TEXT NOT NULL,
      access        TEXT NOT NULL DEFAULT 'read',         -- read | write
      created_at    TEXT NOT NULL,
      created_by    TEXT NOT NULL,
      revoked_at    TEXT,
      note          TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_agent_grants_agent ON agent_collection_grants(agent_id) WHERE revoked_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_skill_bindings_agent ON skill_bindings(agent_id, status);
    CREATE INDEX IF NOT EXISTS idx_skill_revisions_skill ON skill_revisions(skill_id, revision_number DESC);
    CREATE INDEX IF NOT EXISTS idx_skill_revisions_inbox ON skill_revisions(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_skill_deployments_agent ON skill_deployments(agent_id, status);
    CREATE INDEX IF NOT EXISTS idx_plugin_revisions_plugin ON plugin_revisions(plugin_id, revision_number DESC);
    CREATE INDEX IF NOT EXISTS idx_plugin_revisions_inbox ON plugin_revisions(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_plugin_revision_components_type ON plugin_revision_components(component_type, status);
    CREATE INDEX IF NOT EXISTS idx_object_references_target ON object_references(target_object_id, reference_type);
    CREATE INDEX IF NOT EXISTS idx_object_reference_intents_title ON object_reference_intents(target_title COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_graph_annotations_endpoints ON graph_annotations(source_node_id, target_node_id);
    CREATE INDEX IF NOT EXISTS idx_saved_views_default ON saved_views(is_default);
    CREATE INDEX IF NOT EXISTS idx_observation_idempotency_observation ON observation_idempotency(observation_id);
    CREATE INDEX IF NOT EXISTS idx_events_process ON events(process);
    CREATE INDEX IF NOT EXISTS idx_events_observed ON events(observed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, run_at);
    CREATE INDEX IF NOT EXISTS idx_imports_status ON imports(status);
    CREATE INDEX IF NOT EXISTS idx_usage_ledger_period ON usage_ledger(period, operation);
    CREATE INDEX IF NOT EXISTS idx_connection_grants_actor ON connection_grants(actor_id, service_id) WHERE revoked_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_grant_requests_status ON connection_grant_requests(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_observed ON mcp_tool_calls(observed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_actor ON mcp_tool_calls(actor_id, observed_at DESC);
  `);

  const cols = db.prepare("PRAGMA table_info(collections)").all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === 'parent_id')) {
    db.exec('ALTER TABLE collections ADD COLUMN parent_id TEXT');
  }
  if (!cols.some(c => c.name === 'sort_order')) {
    db.exec('ALTER TABLE collections ADD COLUMN sort_order INTEGER DEFAULT 0');
  }
  if (!cols.some(c => c.name === 'workspace_id')) {
    db.exec(`ALTER TABLE collections ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '${DEFAULT_WORKSPACE_ID}'`);
  }

  const objCols = db.prepare("PRAGMA table_info(objects)").all() as Array<{ name: string }>;
  if (!objCols.some(c => c.name === 'sort_order')) {
    db.exec('ALTER TABLE objects ADD COLUMN sort_order INTEGER DEFAULT 0');
  }
  // Migration: add auth_token to existing agents tables (per-agent bearer).
  try {
    const agentCols = db.prepare("PRAGMA table_info(agents)").all() as Array<{ name: string }>;
    if (agentCols.length > 0 && !agentCols.some(c => c.name === 'auth_token')) {
      db.exec('ALTER TABLE agents ADD COLUMN auth_token TEXT');
    }
    // Brain fields — bounded memory view + self-concept + default budget.
    if (agentCols.length > 0 && !agentCols.some(c => c.name === 'persona')) {
      db.exec('ALTER TABLE agents ADD COLUMN persona TEXT');
    }
    if (agentCols.length > 0 && !agentCols.some(c => c.name === 'access_mode')) {
      db.exec("ALTER TABLE agents ADD COLUMN access_mode TEXT NOT NULL DEFAULT 'scoped'");
    }
    if (agentCols.length > 0 && !agentCols.some(c => c.name === 'scopes')) {
      db.exec('ALTER TABLE agents ADD COLUMN scopes TEXT');
    }
    if (agentCols.length > 0 && !agentCols.some(c => c.name === 'context_budget')) {
      db.exec('ALTER TABLE agents ADD COLUMN context_budget INTEGER');
    }
  } catch { /* agents table may not exist yet — handled by CREATE TABLE above */ }

  const skillCols = db.prepare("PRAGMA table_info(skills)").all() as Array<{ name: string }>;
  if (!skillCols.some(c => c.name === 'source_slug')) {
    db.exec('ALTER TABLE skills ADD COLUMN source_slug TEXT');
  }
  // Registry identity is stable across refreshes even though the local skill
  // row id is generated by Pod.
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_source_slug
    ON skills(source, source_slug)
    WHERE source_slug IS NOT NULL
  `);

  // Older registry rows kept their source slug in metadata. Backfill when it
  // is unambiguous so the first refresh updates instead of duplicating them.
  const legacySkillRows = db.prepare(`
    SELECT id, source, metadata FROM skills
    WHERE source_slug IS NULL AND metadata IS NOT NULL
  `).all() as Array<{ id: string; source: string; metadata: string }>;
  const backfillSourceSlug = db.prepare('UPDATE OR IGNORE skills SET source_slug = ? WHERE id = ?');
  for (const row of legacySkillRows) {
    try {
      const metadata = JSON.parse(row.metadata) as Record<string, unknown>;
      if (typeof metadata.source_slug === 'string' && metadata.source_slug.trim()) {
        backfillSourceSlug.run(metadata.source_slug.trim(), row.id);
      }
    } catch { /* malformed legacy metadata remains unmatched */ }
  }

  // Give every pre-revision Skill a baseline snapshot. This is deliberately
  // Pod-local product state: it records the version Pod was already managing
  // without changing Smartware's canonical artifact model.
  const skillsWithoutRevisions = db.prepare(`
    SELECT s.* FROM skills s
    WHERE NOT EXISTS (
      SELECT 1 FROM skill_revisions r WHERE r.skill_id = s.id
    )
  `).all() as any[];
  for (const row of skillsWithoutRevisions) {
    const skill = deserializeSkill(row);
    captureSkillRevision(db, {
      skill_id: skill.id,
      version: skill.version,
      origin: skill.source,
      source_ref: skill.source_slug,
      created_by: skill.actor_id ?? 'migration',
      summary: skill.description,
      status: skill.status === 'approved' || skill.status === 'installed' || skill.status === 'disabled' ? 'approved' : 'draft',
      metadata: { migrated_from_skill_record: true },
    });
  }

  const objectAlterStatements = [
    ['workspace_id', `ALTER TABLE objects ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '${DEFAULT_WORKSPACE_ID}'`],
    ['created_origin', "ALTER TABLE objects ADD COLUMN created_origin TEXT"],
    ['last_modified_by', "ALTER TABLE objects ADD COLUMN last_modified_by TEXT"],
    ['sync_status', "ALTER TABLE objects ADD COLUMN sync_status TEXT"],
    ['processing_state', "ALTER TABLE objects ADD COLUMN processing_state TEXT"],
    ['version', "ALTER TABLE objects ADD COLUMN version INTEGER NOT NULL DEFAULT 1"],
    ['hash_algorithm', "ALTER TABLE objects ADD COLUMN hash_algorithm TEXT NOT NULL DEFAULT 'sha256'"],
    ['hash_value', "ALTER TABLE objects ADD COLUMN hash_value TEXT NOT NULL DEFAULT ''"],
    ['summary', "ALTER TABLE objects ADD COLUMN summary TEXT"],
    ['tags', "ALTER TABLE objects ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'"],
    ['sensitive', "ALTER TABLE objects ADD COLUMN sensitive INTEGER NOT NULL DEFAULT 0"],
    ['deleted_at', "ALTER TABLE objects ADD COLUMN deleted_at TEXT"],
    ['redacted_at', "ALTER TABLE objects ADD COLUMN redacted_at TEXT"],
    ['archived_at', "ALTER TABLE objects ADD COLUMN archived_at TEXT"],
    ['reflection_claim_count', "ALTER TABLE objects ADD COLUMN reflection_claim_count INTEGER NOT NULL DEFAULT 0"],
    ['needs_review', "ALTER TABLE objects ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0"],
  ] as const;
  for (const [column, statement] of objectAlterStatements) {
    if (!objCols.some((c) => c.name === column)) {
      db.exec(statement);
    }
  }

  const referenceCols = db.prepare("PRAGMA table_info(object_references)").all() as Array<{ name: string }>;
  if (!referenceCols.some((c) => c.name === 'reference_key')) {
    db.exec("ALTER TABLE object_references ADD COLUMN reference_key TEXT NOT NULL DEFAULT ''");
    db.exec("UPDATE object_references SET reference_key = target_title WHERE reference_key = ''");
  }

  const eventCols = db.prepare("PRAGMA table_info(events)").all() as Array<{ name: string }>;
  const eventAlterStatements = [
    ['workspace_id', `ALTER TABLE events ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '${DEFAULT_WORKSPACE_ID}'`],
    ['requires_attention', "ALTER TABLE events ADD COLUMN requires_attention INTEGER NOT NULL DEFAULT 0"],
    ['resolved_at', "ALTER TABLE events ADD COLUMN resolved_at TEXT"],
    ['dismissed_at', "ALTER TABLE events ADD COLUMN dismissed_at TEXT"],
    ['severity', "ALTER TABLE events ADD COLUMN severity TEXT"],
    ['attention_reason', "ALTER TABLE events ADD COLUMN attention_reason TEXT"],
    ['attention_action_label', "ALTER TABLE events ADD COLUMN attention_action_label TEXT"],
    ['attention_action', "ALTER TABLE events ADD COLUMN attention_action TEXT"],
  ] as const;
  for (const [column, statement] of eventAlterStatements) {
    if (!eventCols.some((candidate) => candidate.name === column)) {
      db.exec(statement);
    }
  }

  const importCols = db.prepare("PRAGMA table_info(imports)").all() as Array<{ name: string }>;
  if (!importCols.some((candidate) => candidate.name === 'workspace_id')) {
    db.exec(`ALTER TABLE imports ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '${DEFAULT_WORKSPACE_ID}'`);
  }

  // Object indexes — run after ALTER TABLE migrations so all columns exist
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_objects_collection ON objects(collection_id);
    CREATE INDEX IF NOT EXISTS idx_objects_kind ON objects(kind);
    CREATE INDEX IF NOT EXISTS idx_objects_updated ON objects(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_objects_origin ON objects(origin);
    CREATE INDEX IF NOT EXISTS idx_objects_processing_state ON objects(processing_state);
    CREATE INDEX IF NOT EXISTS idx_objects_archived_at ON objects(archived_at);
    CREATE INDEX IF NOT EXISTS idx_objects_source_app ON objects(source_app);
    CREATE INDEX IF NOT EXISTS idx_objects_workspace ON objects(workspace_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_collections_workspace ON collections(workspace_id, sort_order, name);
    CREATE INDEX IF NOT EXISTS idx_events_workspace ON events(workspace_id, observed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_imports_workspace ON imports(workspace_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_attention ON events(requires_attention, resolved_at, observed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_attention_queue ON events(workspace_id, requires_attention, dismissed_at, resolved_at, observed_at DESC);
  `);

  const workspaceCount = db.prepare('SELECT COUNT(*) as n FROM workspaces').get() as { n: number };
  if (workspaceCount.n === 0) {
    const ts = now();
    db.prepare(`
      INSERT INTO workspaces (id, name, emoji, is_default, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `).run(DEFAULT_WORKSPACE_ID, 'Main', '🏠', ts, ts);
  }

  // Seed default collections if empty
  const count = db.prepare('SELECT COUNT(*) as n FROM collections').get() as { n: number };
  if (count.n === 0) {
    const insert = db.prepare('INSERT INTO collections (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
    const ts = now();
    const defaults: Array<[string, string, string]> = [
      ['inbox', 'Inbox', 'Default landing zone for new items'],
      ['archive', 'Archive', 'Archived and hidden items'],
      ['journal', 'Journal', 'Daily notes and reflections'],
    ];
    const seedMany = db.transaction(() => {
      for (const [id, name, desc] of defaults) {
        insert.run(id, name, desc, ts, ts);
      }
    });
    seedMany();
  }

  const savedViewCount = db.prepare('SELECT COUNT(*) as n FROM saved_views').get() as { n: number };
  if (savedViewCount.n === 0) {
    const insertSavedView = db.prepare(`
      INSERT INTO saved_views (id, name, filters, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const ts = now();
    const defaults: Array<PodSavedView> = [
      {
        id: 'recently-modified',
        name: 'Recently Modified',
        filters: { updated_within_days: 7 },
        is_default: true,
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 'needs-attention',
        name: 'Needs Attention',
        filters: { states: ['failed', 'needs_ocr', 'metadata_only'] },
        is_default: true,
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 'awaiting-reflection',
        name: 'Awaiting Reflection',
        filters: { states: ['imported', 'searchable'] },
        is_default: true,
        created_at: ts,
        updated_at: ts,
      },
    ];
    for (const view of defaults) {
      insertSavedView.run(view.id, view.name, JSON.stringify(view.filters), view.is_default ? 1 : 0, ts, ts);
    }
  }

  db.prepare(`
    UPDATE saved_views
    SET filters = ?, updated_at = ?
    WHERE id = 'needs-attention' AND filters = ?
  `).run(
    JSON.stringify({ states: ['failed', 'needs_ocr', 'metadata_only'] }),
    now(),
    JSON.stringify({ states: ['failed', 'needs_review'] }),
  );
  db.prepare(`
    UPDATE saved_views
    SET filters = ?, updated_at = ?
    WHERE id = 'awaiting-reflection' AND filters = ?
  `).run(
    JSON.stringify({ states: ['imported', 'searchable'] }),
    now(),
    JSON.stringify({ states: ['imported'] }),
  );

  // Migration: remove legacy category folders, move their objects to inbox
  const legacyIds = ['imports', 'docs', 'pages', 'projects', 'people', 'companies', 'claims', 'decisions', 'tasks', 'observations', 'entities', 'sources', 'files'];
  const hasLegacy = db.prepare(`SELECT id FROM collections WHERE id IN (${legacyIds.map(() => '?').join(',')})`).all(...legacyIds) as Array<{ id: string }>;
  if (hasLegacy.length > 0) {
    db.transaction(() => {
      for (const { id } of hasLegacy) {
        db.prepare('UPDATE objects SET collection_id = ? WHERE collection_id = ?').run('inbox', id);
        db.prepare('UPDATE collections SET parent_id = NULL WHERE parent_id = ?').run(id);
        db.prepare('DELETE FROM collections WHERE id = ?').run(id);
      }
    })();
  }
}

/* ── Workspaces ── */

function deserializeWorkspace(row: Record<string, unknown>): PodWorkspace {
  return {
    id: String(row['id']),
    name: String(row['name']),
    emoji: String(row['emoji'] ?? '🏠'),
    is_default: Boolean(row['is_default']),
    created_at: String(row['created_at']),
    updated_at: String(row['updated_at']),
  };
}

export function listWorkspaces(db: Database.Database): PodWorkspace[] {
  const rows = db.prepare(`
    SELECT * FROM workspaces
    ORDER BY is_default DESC, created_at ASC, name COLLATE NOCASE ASC
  `).all() as Record<string, unknown>[];
  return rows.map(deserializeWorkspace);
}

export function getWorkspace(db: Database.Database, id: string): PodWorkspace | null {
  const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? deserializeWorkspace(row) : null;
}

export function createWorkspace(db: Database.Database, input: { name: string; emoji?: string }): PodWorkspace {
  const id = makeId('ws');
  const ts = now();
  db.prepare(`
    INSERT INTO workspaces (id, name, emoji, is_default, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, ?)
  `).run(id, input.name.trim(), input.emoji?.trim() || '📁', ts, ts);
  return getWorkspace(db, id)!;
}

export function patchWorkspace(
  db: Database.Database,
  id: string,
  patch: { name?: string; emoji?: string },
): PodWorkspace | null {
  const existing = getWorkspace(db, id);
  if (!existing) return null;
  const name = patch.name?.trim() || existing.name;
  const emoji = patch.emoji?.trim() || existing.emoji;
  db.prepare('UPDATE workspaces SET name = ?, emoji = ?, updated_at = ? WHERE id = ?')
    .run(name, emoji, now(), id);
  return getWorkspace(db, id);
}

export function workspaceContentCount(db: Database.Database, id: string): number {
  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM objects WHERE workspace_id = ? AND deleted_at IS NULL)
      + (SELECT COUNT(*) FROM collections WHERE workspace_id = ? AND id NOT IN ('inbox', 'archive', 'journal'))
      + (SELECT COUNT(*) FROM events WHERE workspace_id = ?)
      AS n
  `).get(id, id, id) as { n: number };
  return row.n;
}

export function deleteWorkspace(db: Database.Database, id: string): boolean {
  const workspace = getWorkspace(db, id);
  if (!workspace || workspace.is_default || workspaceContentCount(db, id) > 0) return false;
  return db.prepare('DELETE FROM workspaces WHERE id = ?').run(id).changes > 0;
}

/* ── Collections ── */

export function upsertCollection(db: Database.Database, input: {
  id?: string;
  workspace_id?: string;
  name: string;
  parent_id?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
}): PodCollection {
  const ts = now();
  const id = input.id ?? makeId('col');

  db.prepare(`
    INSERT INTO collections (id, workspace_id, name, parent_id, description, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      parent_id = excluded.parent_id,
      description = excluded.description,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at
  `).run(id, input.workspace_id ?? DEFAULT_WORKSPACE_ID, input.name, input.parent_id ?? null, input.description ?? null, input.metadata ? JSON.stringify(input.metadata) : null, ts, ts);

  return getCollection(db, id)!;
}

export function patchCollection(db: Database.Database, id: string, patch: { name?: string; parent_id?: string | null; sort_order?: number }, workspaceId?: string): PodCollection | null {
  const existing = getCollection(db, id);
  if (!existing || (workspaceId && existing.workspace_id !== workspaceId && !['inbox', 'archive', 'journal'].includes(id))) return null;

  const ts = now();
  const sets: string[] = ['updated_at = ?'];
  const vals: unknown[] = [ts];

  if (patch.name !== undefined) { sets.push('name = ?'); vals.push(patch.name); }
  if (patch.parent_id !== undefined) { sets.push('parent_id = ?'); vals.push(patch.parent_id); }
  if (patch.sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(patch.sort_order); }

  vals.push(id);
  db.prepare(`UPDATE collections SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getCollection(db, id)!;
}

export function deleteCollection(db: Database.Database, id: string, workspaceId?: string): boolean {
  const col = getCollection(db, id);
  if (!col || (workspaceId && col.workspace_id !== workspaceId)) return false;
  // Move orphaned objects to inbox
  if (workspaceId) {
    db.prepare('UPDATE objects SET collection_id = ? WHERE collection_id = ? AND workspace_id = ?').run('inbox', id, workspaceId);
  } else {
    db.prepare('UPDATE objects SET collection_id = ? WHERE collection_id = ?').run('inbox', id);
  }
  // Reparent child collections to parent of deleted collection
  if (col) {
    if (workspaceId) {
      db.prepare('UPDATE collections SET parent_id = ? WHERE parent_id = ? AND workspace_id = ?').run(col.parent_id, id, workspaceId);
    } else {
      db.prepare('UPDATE collections SET parent_id = ? WHERE parent_id = ?').run(col.parent_id, id);
    }
  }
  const result = db.prepare('DELETE FROM collections WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getCollection(db: Database.Database, id: string): PodCollection | null {
  const row = db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as any;
  return row ? deserializeCollection(row) : null;
}

export function listCollections(db: Database.Database, workspaceId?: string): PodCollection[] {
  const rows = workspaceId
    ? db.prepare(`
        SELECT * FROM collections
        WHERE workspace_id = ? OR id IN ('inbox', 'archive', 'journal')
        ORDER BY sort_order, name
      `).all(workspaceId) as any[]
    : db.prepare('SELECT * FROM collections ORDER BY sort_order, name').all() as any[];
  return rows.map(deserializeCollection);
}

function deserializeCollection(row: any): PodCollection {
  return {
    ...row,
    workspace_id: row.workspace_id ?? DEFAULT_WORKSPACE_ID,
    parent_id: row.parent_id ?? null,
    sort_order: row.sort_order ?? 0,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}

/* ── Objects ── */

export function upsertObject(db: Database.Database, input: {
  id?: string;
  workspace_id?: string;
  collection_id?: string;
  kind: string;
  title: string;
  content?: unknown;
  origin?: string;
  created_origin?: string;
  last_modified_by?: string;
  sync_status?: string;
  processing_state?: string;
  source?: { app?: string; external_id?: string; url?: string };
  tags?: string[];
  sensitive?: boolean;
  summary?: string | null;
  reflection_claim_count?: number;
  needs_review?: boolean;
  metadata?: Record<string, unknown>;
}): PodObject {
  const ts = now();
  const id = input.id ?? makeId('obj');
  const existing = getObject(db, id);
  const metadata = asMetadataRecord(input.metadata);
  const tags = normalizeTags(input.tags ?? (Array.isArray(metadata['tags']) ? metadata['tags'] as string[] : undefined));
  metadata.tags = tags;
  const summary = input.summary ?? buildSummary(input.content ?? existing?.content ?? null, metadata);
  const version = existing ? existing.version + 1 : 1;
  const hash = hashObject(input.kind, input.title, input.content ?? null, metadata, tags);

  db.prepare(`
    INSERT INTO objects (
      id, workspace_id, collection_id, kind, title, content, origin, created_origin, last_modified_by, sync_status, processing_state,
      source_app, source_external_id, source_url, version, hash_algorithm, hash_value, summary, tags, sensitive,
      reflection_claim_count, needs_review, metadata, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      workspace_id = excluded.workspace_id,
      collection_id = excluded.collection_id,
      kind = excluded.kind,
      title = excluded.title,
      content = excluded.content,
      origin = excluded.origin,
      created_origin = COALESCE(objects.created_origin, excluded.created_origin),
      last_modified_by = excluded.last_modified_by,
      sync_status = excluded.sync_status,
      processing_state = excluded.processing_state,
      source_app = excluded.source_app,
      source_external_id = excluded.source_external_id,
      source_url = excluded.source_url,
      version = excluded.version,
      hash_algorithm = excluded.hash_algorithm,
      hash_value = excluded.hash_value,
      summary = excluded.summary,
      tags = excluded.tags,
      sensitive = excluded.sensitive,
      reflection_claim_count = excluded.reflection_claim_count,
      needs_review = excluded.needs_review,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at
  `).run(
    id,
    input.workspace_id ?? existing?.workspace_id ?? DEFAULT_WORKSPACE_ID,
    input.collection_id ?? 'inbox',
    input.kind,
    input.title,
    input.content != null ? JSON.stringify(input.content) : null,
    input.origin ?? null,
    input.created_origin ?? input.origin ?? null,
    input.last_modified_by ?? 'user',
    input.sync_status ?? 'local',
    input.processing_state ?? inferProcessingState(input.origin ?? existing?.origin ?? null, input.reflection_claim_count ?? existing?.reflection_claim_count ?? 0, input.needs_review ?? existing?.needs_review ?? false),
    input.source?.app ?? null,
    input.source?.external_id ?? null,
    input.source?.url ?? null,
    version,
    hash.algorithm,
    hash.value,
    summary,
    JSON.stringify(tags),
    (input.sensitive ?? existing?.sensitive ?? false) ? 1 : 0,
    input.reflection_claim_count ?? existing?.reflection_claim_count ?? 0,
    input.needs_review ? 1 : 0,
    JSON.stringify(metadata),
    existing?.created_at ?? ts,
    ts,
  );

  const obj = getObject(db, id)!;
  refreshObjectReferences(db, obj);
  repairIncomingReferenceTitles(db, obj);
  resolveReferenceIntentsForTarget(db, obj);

  // Sync to vault — best-effort, never blocks the DB write
  if (_dataDir) {
    try { writeObjectToVault(_dataDir, obj); } catch {}
  }

  return obj;
}

export function patchObject(db: Database.Database, id: string, patch: {
  title?: string;
  content?: unknown;
  collection_id?: string | null;
  sort_order?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  origin?: string;
  created_origin?: string;
  last_modified_by?: string;
  sync_status?: string;
  processing_state?: string;
  sensitive?: boolean;
  archived_at?: string | null;
  deleted_at?: string | null;
  redacted_at?: string | null;
  reflection_claim_count?: number;
  needs_review?: boolean;
}, workspaceId?: string): PodObject | null {
  const existing = getObject(db, id);
  if (!existing || (workspaceId && existing.workspace_id !== workspaceId)) return null;

  const ts = now();
  const metadata = {
    ...asMetadataRecord(existing.metadata),
    ...asMetadataRecord(patch.metadata),
  };
  const tags = normalizeTags(patch.tags ?? (Array.isArray(metadata['tags']) ? metadata['tags'] as string[] : existing.tags));
  metadata.tags = tags;
  const next = {
    title: patch.title ?? existing.title,
    content: patch.content !== undefined ? patch.content : existing.content,
    origin: patch.origin ?? existing.origin ?? undefined,
    created_origin: patch.created_origin ?? existing.created_origin ?? undefined,
    last_modified_by: patch.last_modified_by ?? existing.last_modified_by ?? undefined,
    sync_status: patch.sync_status ?? existing.sync_status ?? undefined,
    processing_state: patch.processing_state ?? existing.processing_state ?? undefined,
    sensitive: patch.sensitive ?? existing.sensitive,
    reflection_claim_count: patch.reflection_claim_count ?? existing.reflection_claim_count,
    needs_review: patch.needs_review ?? existing.needs_review,
    archived_at: patch.archived_at !== undefined ? patch.archived_at : existing.archived_at,
    deleted_at: patch.deleted_at !== undefined ? patch.deleted_at : existing.deleted_at,
    redacted_at: patch.redacted_at !== undefined ? patch.redacted_at : existing.redacted_at,
  };
  const hash = hashObject(existing.kind, next.title, next.content, metadata, tags);
  const summary = buildSummary(next.content, metadata);

  db.prepare(`
    UPDATE objects SET
      title = ?,
      content = ?,
      collection_id = ?,
      sort_order = ?,
      origin = ?,
      created_origin = ?,
      last_modified_by = ?,
      sync_status = ?,
      processing_state = ?,
      version = ?,
      hash_algorithm = ?,
      hash_value = ?,
      summary = ?,
      tags = ?,
      metadata = ?,
      sensitive = ?,
      archived_at = ?,
      deleted_at = ?,
      redacted_at = ?,
      reflection_claim_count = ?,
      needs_review = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    next.title,
    next.content != null ? JSON.stringify(next.content) : null,
    patch.collection_id !== undefined ? patch.collection_id ?? 'inbox' : existing.collection_id,
    patch.sort_order ?? existing.sort_order,
    next.origin ?? null,
    next.created_origin ?? null,
    next.last_modified_by ?? null,
    next.sync_status ?? null,
    next.processing_state ?? inferProcessingState(next.origin ?? null, next.reflection_claim_count, next.needs_review),
    existing.version + 1,
    hash.algorithm,
    hash.value,
    summary,
    JSON.stringify(tags),
    JSON.stringify(metadata),
    next.sensitive ? 1 : 0,
    next.archived_at ?? null,
    next.deleted_at ?? null,
    next.redacted_at ?? null,
    next.reflection_claim_count,
    next.needs_review ? 1 : 0,
    ts,
    id,
  );

  const obj = getObject(db, id)!;
  refreshObjectReferences(db, obj);
  repairIncomingReferenceTitles(db, obj);
  resolveReferenceIntentsForTarget(db, obj);

  if (_dataDir) {
    try { writeObjectToVault(_dataDir, obj); } catch {}
  }

  return obj;
}

export function getObject(db: Database.Database, id: string): PodObject | null {
  const row = db.prepare('SELECT * FROM objects WHERE id = ?').get(id) as any;
  return row ? deserializeObject(row) : null;
}

export function listObjects(db: Database.Database, options: {
  workspaceId?: string;
  collectionId?: string;
  kind?: string;
  origin?: string;
  sourceApp?: string;
  processingState?: string;
  includeArchived?: boolean;
  excludeSensitive?: boolean;
  tags?: string[];
  query?: string;
  limit?: number;
  offset?: number;
} = {}): PodObject[] {
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];

  if (options.workspaceId) {
    conditions.push('workspace_id = ?');
    params.push(options.workspaceId);
  }
  if (options.collectionId) {
    conditions.push('collection_id = ?');
    params.push(options.collectionId);
  }
  if (options.kind) {
    conditions.push('kind = ?');
    params.push(options.kind);
  }
  if (options.origin) {
    conditions.push('origin = ?');
    params.push(options.origin);
  }
  if (options.sourceApp) {
    conditions.push('source_app = ?');
    params.push(options.sourceApp);
  }
  if (options.processingState) {
    conditions.push('processing_state = ?');
    params.push(options.processingState);
  }
  if (!options.includeArchived) {
    conditions.push('archived_at IS NULL');
  }
  if (options.excludeSensitive) {
    conditions.push('sensitive = 0');
  }
  if (options.query) {
    conditions.push('(title LIKE ? OR content LIKE ?)');
    const q = `%${options.query}%`;
    params.push(q, q);
  }
  if (options.tags && options.tags.length > 0) {
    for (const tag of normalizeTags(options.tags)) {
      conditions.push('tags LIKE ?');
      params.push(`%${JSON.stringify(tag).slice(1, -1)}%`);
    }
  }

  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  const rows = db.prepare(`
    SELECT * FROM objects
    WHERE ${conditions.join(' AND ')}
    ORDER BY sort_order ASC, updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[];

  return rows.map(deserializeObject);
}

export function countObjects(db: Database.Database, options: {
  workspaceId?: string;
  collectionId?: string;
  kind?: string;
  sourceApp?: string;
  includeArchived?: boolean;
  excludeSensitive?: boolean;
} = {}): number {
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];

  if (options.workspaceId) {
    conditions.push('workspace_id = ?');
    params.push(options.workspaceId);
  }
  if (options.collectionId) {
    conditions.push('collection_id = ?');
    params.push(options.collectionId);
  }
  if (options.kind) {
    conditions.push('kind = ?');
    params.push(options.kind);
  }
  if (options.sourceApp) {
    conditions.push('source_app = ?');
    params.push(options.sourceApp);
  }
  if (!options.includeArchived) {
    conditions.push('archived_at IS NULL');
  }
  if (options.excludeSensitive) {
    conditions.push('sensitive = 0');
  }

  const row = db.prepare(`SELECT COUNT(*) as n FROM objects WHERE ${conditions.join(' AND ')}`).get(...params) as { n: number };
  return row.n;
}

export function deleteObject(db: Database.Database, id: string, workspaceId?: string): boolean {
  // Grab the object before deleting so we can clean up the vault file
  const obj = getObject(db, id);
  if (!obj || (workspaceId && obj.workspace_id !== workspaceId)) return false;
  db.prepare('DELETE FROM object_references WHERE source_object_id = ? OR target_object_id = ?').run(id, id);
  const result = db.prepare('DELETE FROM objects WHERE id = ?').run(id);
  if (result.changes > 0 && obj && _dataDir) {
    try { deleteObjectFromVault(_dataDir, obj); } catch {}
  }
  return result.changes > 0;
}

function deserializeObject(row: any): PodObject {
  return {
    ...row,
    workspace_id: row.workspace_id ?? DEFAULT_WORKSPACE_ID,
    content: row.content ? JSON.parse(row.content) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    created_origin: row.created_origin ?? null,
    last_modified_by: row.last_modified_by ?? null,
    sync_status: row.sync_status ?? null,
    processing_state: row.processing_state ?? null,
    version: row.version ?? 1,
    hash_algorithm: row.hash_algorithm ?? 'sha256',
    hash_value: row.hash_value ?? '',
    summary: row.summary ?? null,
    tags: row.tags ? JSON.parse(row.tags) : [],
    sensitive: !!row.sensitive,
    deleted_at: row.deleted_at ?? null,
    redacted_at: row.redacted_at ?? null,
    archived_at: row.archived_at ?? null,
    reflection_claim_count: row.reflection_claim_count ?? 0,
    needs_review: !!row.needs_review,
    sort_order: row.sort_order ?? 0,
  };
}

function inferProcessingState(origin: string | null, reflectionClaimCount: number, needsReview: boolean): string {
  if (needsReview) return 'needs_review';
  if (reflectionClaimCount > 0) return 'reflected';
  if (origin === 'synced' || origin === 'coffee') return 'synced';
  return 'imported';
}

function contentText(obj: PodObject): string {
  if (typeof obj.content === 'string') return obj.content;
  const text = typeof (obj.content as Record<string, unknown> | null)?.['text'] === 'string'
    ? String((obj.content as Record<string, unknown>)['text'])
    : '';
  return text;
}

function extractReferenceTitles(obj: PodObject): Array<{ reference_type: PodObjectReference['reference_type']; target_title: string }> {
  const metadata = asMetadataRecord(obj.metadata);
  const references = metadata['references'] as Record<string, unknown> | undefined;
  const groups: Array<[PodObjectReference['reference_type'], string[]]> = [
    ['belongs_to', asStringArray(references?.['belongs_to'] ?? metadata['belongs_to'])],
    ['related_to', asStringArray(references?.['related_to'] ?? metadata['related_to'])],
    ['derived_from', asStringArray(references?.['derived_from'] ?? metadata['derived_from'])],
    ['mentions', asStringArray(references?.['mentions'] ?? metadata['mentions'])],
    ['other_links', asStringArray(references?.['other_links'])],
  ];
  const output: Array<{ reference_type: PodObjectReference['reference_type']; target_title: string }> = [];
  for (const [referenceType, titles] of groups) {
    for (const targetTitle of titles) {
      if (!targetTitle || targetTitle.trim() === obj.title.trim()) continue;
      output.push({ reference_type: referenceType, target_title: targetTitle.trim() });
    }
  }
  return output;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function findObjectByTitle(db: Database.Database, title: string, workspaceId: string): PodObject | null {
  const row = db.prepare(`
    SELECT * FROM objects
    WHERE lower(title) = lower(?)
      AND workspace_id = ?
      AND deleted_at IS NULL
    ORDER BY archived_at IS NOT NULL, updated_at DESC
    LIMIT 1
  `).get(title, workspaceId) as any;
  return row ? deserializeObject(row) : null;
}

function refreshObjectReferences(db: Database.Database, obj: PodObject): void {
  const previouslyResolved = new Map<string, string>();
  const previousRows = db.prepare(`
    SELECT reference_type, reference_key, target_object_id
    FROM object_references
    WHERE source_object_id = ?
  `).all(obj.id) as Array<{ reference_type: string; reference_key: string; target_object_id: string }>;
  for (const row of previousRows) {
    previouslyResolved.set(`${row.reference_type}\u0000${row.reference_key.toLocaleLowerCase()}`, row.target_object_id);
  }

  db.prepare('DELETE FROM object_references WHERE source_object_id = ?').run(obj.id);
  db.prepare('DELETE FROM object_reference_intents WHERE source_object_id = ?').run(obj.id);
  const refs = extractReferenceTitles(obj);
  if (refs.length === 0) return;
  const insertIntent = db.prepare(`
    INSERT OR REPLACE INTO object_reference_intents
      (source_object_id, reference_type, target_title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insert = db.prepare(`
    INSERT OR REPLACE INTO object_references
      (source_object_id, target_object_id, reference_type, source_kind, source_title, target_title, reference_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ts = now();
  for (const ref of refs) {
    insertIntent.run(obj.id, ref.reference_type, ref.target_title, ts, ts);
    const resolvedId = previouslyResolved.get(`${ref.reference_type}\u0000${ref.target_title.toLocaleLowerCase()}`);
    const resolved = resolvedId ? getObject(db, resolvedId) : null;
    const target = (resolved?.workspace_id === obj.workspace_id ? resolved : null)
      ?? findObjectByTitle(db, ref.target_title, obj.workspace_id);
    if (!target || target.id === obj.id) continue;
    insert.run(obj.id, target.id, ref.reference_type, obj.kind, obj.title, target.title, ref.target_title, ts, ts);
  }
}

function resolveReferenceIntentsForTarget(db: Database.Database, target: PodObject): void {
  const intents = db.prepare(`
    SELECT i.source_object_id, i.reference_type, i.target_title, i.created_at, o.kind, o.title
    FROM object_reference_intents i
    JOIN objects o ON o.id = i.source_object_id
    WHERE lower(i.target_title) = lower(?)
      AND o.workspace_id = ?
      AND o.deleted_at IS NULL
      AND i.source_object_id <> ?
      AND NOT EXISTS (
        SELECT 1
        FROM object_references r
        WHERE r.source_object_id = i.source_object_id
          AND r.reference_type = i.reference_type
          AND lower(r.reference_key) = lower(i.target_title)
      )
  `).all(target.title, target.workspace_id, target.id) as Array<{
    source_object_id: string;
    reference_type: PodObjectReference['reference_type'];
    target_title: string;
    created_at: string;
    kind: string;
    title: string;
  }>;
  const insert = db.prepare(`
    INSERT OR REPLACE INTO object_references
      (source_object_id, target_object_id, reference_type, source_kind, source_title, target_title, reference_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ts = now();
  for (const intent of intents) {
    insert.run(
      intent.source_object_id,
      target.id,
      intent.reference_type,
      intent.kind,
      intent.title,
      target.title,
      intent.target_title,
      intent.created_at,
      ts,
    );
  }
}

function repairIncomingReferenceTitles(db: Database.Database, target: PodObject): void {
  db.prepare(`
    UPDATE object_references
    SET target_title = ?, updated_at = ?
    WHERE target_object_id = ?
  `).run(target.title, now(), target.id);
}

function backfillObjectReferenceIntents(db: Database.Database): void {
  const migrationKey = 'object_reference_intents_v1';
  const applied = db.prepare('SELECT 1 FROM schema_migrations WHERE key = ?').get(migrationKey);
  if (applied) return;

  const rows = db.prepare('SELECT * FROM objects WHERE deleted_at IS NULL').all() as any[];
  const backfill = db.transaction(() => {
    for (const row of rows) refreshObjectReferences(db, deserializeObject(row));
    db.prepare('INSERT INTO schema_migrations (key, applied_at) VALUES (?, ?)').run(migrationKey, now());
  });
  backfill();
}

export function listBacklinks(db: Database.Database, targetObjectId: string): Record<PodObjectReference['reference_type'], PodObjectReference[]> {
  const rows = db.prepare(`
    SELECT * FROM object_references
    WHERE target_object_id = ?
    ORDER BY updated_at DESC, source_title COLLATE NOCASE ASC
  `).all(targetObjectId) as any[];
  const grouped: Record<PodObjectReference['reference_type'], PodObjectReference[]> = {
    belongs_to: [],
    related_to: [],
    derived_from: [],
    mentions: [],
    other_links: [],
  };
  for (const row of rows) {
    const ref = row as PodObjectReference;
    grouped[ref.reference_type].push(ref);
  }
  return grouped;
}

export function countBacklinks(db: Database.Database, targetObjectId: string): number {
  const row = db.prepare('SELECT COUNT(*) as n FROM object_references WHERE target_object_id = ?').get(targetObjectId) as { n: number };
  return row.n;
}

export function listAllObjectReferences(db: Database.Database): PodObjectReference[] {
  return db.prepare(`
    SELECT * FROM object_references
    ORDER BY updated_at DESC
  `).all() as PodObjectReference[];
}

export function listOutboundReferences(db: Database.Database, sourceObjectId: string): Record<PodObjectReference['reference_type'], PodObjectReference[]> {
  const rows = db.prepare(`
    SELECT * FROM object_references
    WHERE source_object_id = ?
    ORDER BY updated_at DESC, target_title COLLATE NOCASE ASC
  `).all(sourceObjectId) as any[];
  const grouped: Record<PodObjectReference['reference_type'], PodObjectReference[]> = {
    belongs_to: [],
    related_to: [],
    derived_from: [],
    mentions: [],
    other_links: [],
  };
  for (const row of rows) {
    const ref = row as PodObjectReference;
    grouped[ref.reference_type].push(ref);
  }
  return grouped;
}

/* ── Artifact → Smartware observation lineage ── */

export function recordObjectMemoryObservation(
  db: Database.Database,
  input: Omit<PodObjectMemoryObservation, 'status' | 'created_at' | 'retired_at'>,
): PodObjectMemoryObservation {
  const ts = now();
  db.prepare(`
    INSERT INTO object_memory_observations
      (observation_id, object_id, object_version, object_hash, source_app, source_id, scope, status, created_at, retired_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NULL)
    ON CONFLICT(observation_id) DO UPDATE SET
      object_id = excluded.object_id,
      object_version = excluded.object_version,
      object_hash = excluded.object_hash,
      source_app = excluded.source_app,
      source_id = excluded.source_id,
      scope = excluded.scope,
      status = 'active',
      retired_at = NULL
  `).run(
    input.observation_id,
    input.object_id,
    input.object_version,
    input.object_hash,
    input.source_app,
    input.source_id,
    input.scope,
    ts,
  );
  return db.prepare('SELECT * FROM object_memory_observations WHERE observation_id = ?')
    .get(input.observation_id) as PodObjectMemoryObservation;
}

export function listObjectMemoryObservations(
  db: Database.Database,
  objectId: string,
  status?: PodObjectMemoryObservation['status'],
): PodObjectMemoryObservation[] {
  const rows = status
    ? db.prepare(`
        SELECT * FROM object_memory_observations
        WHERE object_id = ? AND status = ?
        ORDER BY object_version DESC, created_at DESC
      `).all(objectId, status)
    : db.prepare(`
        SELECT * FROM object_memory_observations
        WHERE object_id = ?
        ORDER BY object_version DESC, created_at DESC
      `).all(objectId);
  return rows as PodObjectMemoryObservation[];
}

export function listActiveObjectMemoryObservations(
  db: Database.Database,
): PodObjectMemoryObservation[] {
  return db.prepare(`
    SELECT * FROM object_memory_observations
    WHERE status = 'active'
    ORDER BY object_id, object_version DESC, created_at DESC
  `).all() as PodObjectMemoryObservation[];
}

export function retireObjectMemoryObservation(
  db: Database.Database,
  observationId: string,
): boolean {
  const result = db.prepare(`
    UPDATE object_memory_observations
    SET status = 'retired', retired_at = ?
    WHERE observation_id = ? AND status = 'active'
  `).run(now(), observationId);
  return result.changes > 0;
}

/* ── Knowledge graph annotations ── */

export function createGraphAnnotation(db: Database.Database, input: {
  id?: string;
  source_node_id: string;
  target_node_id: string;
  label?: string | null;
  relation?: string | null;
  direction?: PodGraphAnnotation['direction'];
  note?: string | null;
}): PodGraphAnnotation {
  const id = input.id ?? makeId('edge');
  const ts = now();
  db.prepare(`
    INSERT INTO graph_annotations
      (id, source_node_id, target_node_id, label, relation, direction, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.source_node_id,
    input.target_node_id,
    input.label?.trim() || null,
    input.relation?.trim() || null,
    input.direction ?? 'directed',
    input.note?.trim() || null,
    ts,
    ts,
  );
  return db.prepare('SELECT * FROM graph_annotations WHERE id = ?').get(id) as PodGraphAnnotation;
}

export function listGraphAnnotations(db: Database.Database): PodGraphAnnotation[] {
  return db.prepare(`
    SELECT * FROM graph_annotations
    ORDER BY created_at ASC, id ASC
  `).all() as PodGraphAnnotation[];
}

export function deleteGraphAnnotation(db: Database.Database, id: string): boolean {
  return db.prepare('DELETE FROM graph_annotations WHERE id = ?').run(id).changes > 0;
}

export function listTags(db: Database.Database, workspaceId?: string): string[] {
  const rows = workspaceId
    ? db.prepare('SELECT tags FROM objects WHERE deleted_at IS NULL AND workspace_id = ?').all(workspaceId) as Array<{ tags: string }>
    : db.prepare('SELECT tags FROM objects WHERE deleted_at IS NULL').all() as Array<{ tags: string }>;
  return normalizeTags(rows.flatMap((row) => {
    try {
      return JSON.parse(row.tags) as string[];
    } catch {
      return [];
    }
  }));
}

export function saveObservationIdempotency(db: Database.Database, actorId: string, idempotencyKey: string, payloadHash: string, observationId: string): void {
  db.prepare(`
    INSERT OR REPLACE INTO observation_idempotency (actor_id, idempotency_key, payload_hash, observation_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(actorId, idempotencyKey, payloadHash, observationId, now());
}

export function getObservationIdempotency(db: Database.Database, actorId: string, idempotencyKey: string): { payload_hash: string; observation_id: string } | null {
  const row = db.prepare(`
    SELECT payload_hash, observation_id
    FROM observation_idempotency
    WHERE actor_id = ? AND idempotency_key = ?
  `).get(actorId, idempotencyKey) as { payload_hash: string; observation_id: string } | undefined;
  return row ?? null;
}

/* ── Events ── */

export function insertEvent(db: Database.Database, input: {
  id?: string;
  workspace_id?: string;
  type: string;
  process: string;
  actor_id?: string;
  scope?: string;
  title: string;
  detail?: string;
  content?: unknown;
  requires_attention?: boolean;
  resolved_at?: string | null;
  severity?: string;
  attention_reason?: string;
  attention_action_label?: string;
  attention_action?: string;
  /** Optional metadata fields rolled into `content` when present so the
   *  events table doesn't need extra columns. */
  source_app?: string;
  observation_id?: string;
}): PodEvent {
  // Roll optional metadata into content so the table schema doesn't grow.
  const mergedContent = (input.source_app || input.observation_id)
    ? { ...(typeof input.content === 'object' && input.content !== null ? input.content as Record<string, unknown> : { value: input.content }), source_app: input.source_app, observation_id: input.observation_id }
    : input.content;
  const id = input.id ?? makeId('evt');
  const ts = now();

  db.prepare(`
    INSERT INTO events (
      id, workspace_id, type, process, actor_id, scope, title, detail, content,
      requires_attention, resolved_at, severity, attention_reason,
      attention_action_label, attention_action, observed_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.workspace_id ?? DEFAULT_WORKSPACE_ID,
    input.type,
    input.process,
    input.actor_id ?? 'system',
    input.scope ?? 'personal',
    input.title,
    input.detail ?? null,
    mergedContent != null ? JSON.stringify(mergedContent) : null,
    input.requires_attention ? 1 : 0,
    input.resolved_at ?? null,
    input.severity ?? null,
    input.attention_reason ?? null,
    input.attention_action_label ?? null,
    input.attention_action ?? null,
    ts,
  );

  return {
    id,
    workspace_id: input.workspace_id ?? DEFAULT_WORKSPACE_ID,
    type: input.type,
    process: input.process,
    actor_id: input.actor_id ?? 'system',
    scope: input.scope ?? 'personal',
    title: input.title,
    detail: input.detail ?? null,
    content: mergedContent ?? null,
    requires_attention: input.requires_attention ?? false,
    resolved_at: input.resolved_at ?? null,
    dismissed_at: null,
    severity: input.severity ?? null,
    attention_reason: input.attention_reason ?? null,
    attention_action_label: input.attention_action_label ?? null,
    attention_action: input.attention_action ?? null,
    observed_at: ts,
  };
}

/**
 * Insert an event only if no event with the same (type, title, detail, content)
 * fingerprint exists within `windowSec` (default 24h). Returns the inserted
 * event, or null if a recent duplicate was found and the insert was skipped.
 *
 * Useful for repeating sync jobs that may produce identical-content events
 * when nothing actually changed since the last run.
 */
export function insertEventIfFresh(
  db: Database.Database,
  input: Parameters<typeof insertEvent>[1],
  windowSec = 24 * 60 * 60,
): PodEvent | null {
  const cutoff = new Date(Date.now() - windowSec * 1000).toISOString();
  const contentJson = input.content != null ? JSON.stringify(input.content) : null;
  const existing = db.prepare(`
    SELECT id FROM events
    WHERE type = ?
      AND workspace_id = ?
      AND title = ?
      AND COALESCE(detail, '') = COALESCE(?, '')
      AND COALESCE(content, '') = COALESCE(?, '')
      AND observed_at >= ?
    LIMIT 1
  `).get(
    input.type,
    input.workspace_id ?? DEFAULT_WORKSPACE_ID,
    input.title,
    input.detail ?? null,
    contentJson,
    cutoff,
  );
  if (existing) return null;
  return insertEvent(db, input);
}

export function listEvents(db: Database.Database, options: {
  workspaceId?: string;
  process?: string;
  limit?: number;
  offset?: number;
} = {}): PodEvent[] {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];

  if (options.workspaceId) {
    conditions.push('workspace_id = ?');
    params.push(options.workspaceId);
  }
  if (options.process) {
    conditions.push('process = ?');
    params.push(options.process);
  }

  const rows = db.prepare(`
    SELECT * FROM events
    WHERE ${conditions.join(' AND ')}
    ORDER BY observed_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, options.limit ?? 50, options.offset ?? 0) as any[];

  return rows.map(rowToEvent);
}

export function getEvent(db: Database.Database, id: string): PodEvent | null {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToEvent(row) : null;
}

export function setAttentionEventsDismissed(
  db: Database.Database,
  workspaceId: string,
  eventIds: string[],
  dismissedAt: string | null,
): string[] {
  const uniqueIds = [...new Set(eventIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const placeholders = uniqueIds.map(() => '?').join(', ');
  const rows = db.prepare(`
    SELECT id FROM events
    WHERE workspace_id = ?
      AND id IN (${placeholders})
      AND requires_attention = 1
      AND resolved_at IS NULL
  `).all(workspaceId, ...uniqueIds) as Array<{ id: string }>;
  const eligibleIds = new Set(rows.map(row => row.id));
  const updatedIds = uniqueIds.filter(id => eligibleIds.has(id));
  const update = db.prepare('UPDATE events SET dismissed_at = ? WHERE id = ?');
  db.transaction((ids: string[]) => {
    for (const id of ids) update.run(dismissedAt, id);
  })(updatedIds);
  return updatedIds;
}

export function resolveConflictEvents(
  db: Database.Database,
  conflictId: string,
  resolvedAt = now(),
): string[] {
  const candidates = db.prepare(`
    SELECT * FROM events
    WHERE type = 'memory_conflict_detected'
      AND requires_attention = 1
      AND resolved_at IS NULL
  `).all() as Record<string, unknown>[];
  const resolvedIds = candidates
    .map(rowToEvent)
    .filter((event) => {
      const content = event.content;
      if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
      const conflict = (content as Record<string, unknown>)['conflict'];
      return !!conflict
        && typeof conflict === 'object'
        && !Array.isArray(conflict)
        && (conflict as Record<string, unknown>)['id'] === conflictId;
    })
    .map(event => event.id);
  const resolve = db.prepare(`
    UPDATE events
    SET requires_attention = 0, resolved_at = ?
    WHERE id = ?
  `);
  db.transaction((ids: string[]) => {
    for (const id of ids) resolve.run(resolvedAt, id);
  })(resolvedIds);
  return resolvedIds;
}

function rowToEvent(row: Record<string, unknown>): PodEvent {
  return {
    id: String(row['id']),
    workspace_id: String(row['workspace_id'] ?? DEFAULT_WORKSPACE_ID),
    type: String(row['type']),
    process: String(row['process']),
    actor_id: String(row['actor_id']),
    scope: String(row['scope']),
    title: String(row['title']),
    detail: row['detail'] == null ? null : String(row['detail']),
    content: row['content'] ? JSON.parse(String(row['content'])) : null,
    requires_attention: Boolean(row['requires_attention']),
    resolved_at: row['resolved_at'] == null ? null : String(row['resolved_at']),
    dismissed_at: row['dismissed_at'] == null ? null : String(row['dismissed_at']),
    severity: row['severity'] == null ? null : String(row['severity']),
    attention_reason: row['attention_reason'] == null ? null : String(row['attention_reason']),
    attention_action_label: row['attention_action_label'] == null ? null : String(row['attention_action_label']),
    attention_action: row['attention_action'] == null ? null : String(row['attention_action']),
    observed_at: String(row['observed_at']),
  };
}

/* ── Imports ── */

export function createImport(db: Database.Database, input: {
  id?: string;
  workspace_id?: string;
  source: string;
  file_count: number;
  destination?: string;
  metadata?: Record<string, unknown>;
}): PodImport {
  const id = input.id ?? makeId('imp');
  const ts = now();

  db.prepare(`
    INSERT INTO imports (id, workspace_id, source, file_count, destination, status, errors, started_at, metadata)
    VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)
  `).run(
    id,
    input.workspace_id ?? DEFAULT_WORKSPACE_ID,
    input.source,
    input.file_count,
    input.destination ?? 'inbox',
    ts,
    input.metadata ? JSON.stringify(input.metadata) : null,
  );

  return {
    id,
    workspace_id: input.workspace_id ?? DEFAULT_WORKSPACE_ID,
    source: input.source,
    file_count: input.file_count,
    destination: input.destination ?? 'inbox',
    status: 'pending',
    errors: 0,
    started_at: ts,
    completed_at: null,
    metadata: input.metadata ?? null,
  };
}

export function updateImport(
  db: Database.Database,
  id: string,
  update: Partial<Pick<PodImport, 'status' | 'errors' | 'completed_at' | 'file_count' | 'metadata'>>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (update.status !== undefined) { sets.push('status = ?'); params.push(update.status); }
  if (update.errors !== undefined) { sets.push('errors = ?'); params.push(update.errors); }
  if (update.completed_at !== undefined) { sets.push('completed_at = ?'); params.push(update.completed_at); }
  if (update.file_count !== undefined) { sets.push('file_count = ?'); params.push(update.file_count); }
  if (update.metadata !== undefined) {
    sets.push('metadata = ?');
    params.push(update.metadata ? JSON.stringify(update.metadata) : null);
  }

  if (sets.length === 0) return;
  params.push(id);
  db.prepare(`UPDATE imports SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

export function getImport(db: Database.Database, id: string): PodImport | null {
  const row = db.prepare('SELECT * FROM imports WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}

export function listImports(db: Database.Database, limit = 20, workspaceId?: string): PodImport[] {
  const rows = workspaceId
    ? db.prepare('SELECT * FROM imports WHERE workspace_id = ? ORDER BY started_at DESC LIMIT ?').all(workspaceId, limit) as any[]
    : db.prepare('SELECT * FROM imports ORDER BY started_at DESC LIMIT ?').all(limit) as any[];
  return rows.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }));
}

/* ── Jobs ── */

export function enqueueJob(db: Database.Database, input: {
  type: string;
  payload: unknown;
  max_attempts?: number;
  run_at?: string;
}): PodJob {
  const id = makeId('job');
  const ts = now();

  db.prepare(`
    INSERT INTO jobs (id, type, status, payload, attempts, max_attempts, created_at, updated_at, run_at)
    VALUES (?, ?, 'pending', ?, 0, ?, ?, ?, ?)
  `).run(id, input.type, JSON.stringify(input.payload), input.max_attempts ?? 3, ts, ts, input.run_at ?? null);

  return { id, type: input.type, status: 'pending', payload: input.payload, result: null, error: null, attempts: 0, max_attempts: input.max_attempts ?? 3, created_at: ts, updated_at: ts, run_at: input.run_at ?? null };
}

export function claimNextJob(db: Database.Database, types?: string[]): PodJob | null {
  const ts = now();
  const typeFilter = types?.length ? `AND type IN (${types.map(() => '?').join(',')})` : '';
  const params = types?.length ? [...types, ts] : [ts];

  const row = db.prepare(`
    UPDATE jobs SET status = 'running', attempts = attempts + 1, updated_at = ?
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'pending' AND attempts < max_attempts AND (run_at IS NULL OR run_at <= ?)
      ${typeFilter}
      ORDER BY created_at ASC
      LIMIT 1
    )
    RETURNING *
  `).get(ts, ...params) as any;

  if (!row) return null;
  return { ...row, payload: row.payload ? JSON.parse(row.payload) : null, result: row.result ? JSON.parse(row.result) : null };
}

export function completeJob(db: Database.Database, id: string, result: unknown): void {
  db.prepare(`UPDATE jobs SET status = 'completed', result = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(result), now(), id);
}

export function failJob(db: Database.Database, id: string, error: string): void {
  db.prepare(`UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`)
    .run(error, now(), id);
}

/* ── Skills ── */

function deserializeSkillRevision(row: any): PodSkillRevision {
  return {
    ...row,
    files: row.files ? JSON.parse(row.files) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  } as PodSkillRevision;
}

export function hashSkillPackage(input: {
  content?: string | null;
  files?: Record<string, string> | null;
}): string {
  const normalizedFiles = input.files
    ? Object.fromEntries(Object.entries(input.files).sort(([a], [b]) => a.localeCompare(b)))
    : null;
  return crypto.createHash('sha256').update(stableJson({
    content: normalizedFiles ? null : input.content ?? null,
    files: normalizedFiles,
  })).digest('hex');
}

function skillRevisionFingerprint(input: {
  version?: string;
  content?: string | null;
  files?: Record<string, string> | null;
  summary?: string;
}): string {
  const contentHash = hashSkillPackage(input);
  return crypto.createHash('sha256').update(stableJson({
    content_hash: contentHash,
    version: input.version ?? '0.0.0',
  })).digest('hex');
}

export function captureSkillRevision(db: Database.Database, input: {
  skill_id: string;
  version?: string;
  content?: string | null;
  files?: Record<string, string> | null;
  origin?: PodSkill['source'];
  source_ref?: string | null;
  created_by?: string;
  summary?: string;
  status?: PodSkillRevision['status'];
  metadata?: Record<string, unknown> | null;
}): { revision: PodSkillRevision; created: boolean } {
  const contentHash = hashSkillPackage(input);
  const fingerprint = skillRevisionFingerprint(input);
  const existing = db.prepare(
    'SELECT * FROM skill_revisions WHERE skill_id = ? AND revision_fingerprint = ?',
  ).get(input.skill_id, fingerprint) as any;
  if (existing) return { revision: deserializeSkillRevision(existing), created: false };

  const next = db.prepare(
    'SELECT COALESCE(MAX(revision_number), 0) + 1 AS revision_number FROM skill_revisions WHERE skill_id = ?',
  ).get(input.skill_id) as { revision_number: number };
  const id = makeId('skr');
  const ts = now();
  const status = input.status ?? 'draft';
  db.prepare(`
    INSERT INTO skill_revisions (
      id, skill_id, revision_number, version, status, content_hash, revision_fingerprint, content,
      files, origin, source_ref, created_by, summary, created_at, approved_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.skill_id,
    next.revision_number,
    input.version ?? '0.0.0',
    status,
    contentHash,
    fingerprint,
    input.content ?? null,
    input.files ? JSON.stringify(input.files) : null,
    input.origin ?? 'manual',
    input.source_ref ?? null,
    input.created_by ?? 'person-local',
    input.summary ?? '',
    ts,
    status === 'approved' ? ts : null,
    input.metadata ? JSON.stringify(input.metadata) : null,
  );
  return { revision: getSkillRevision(db, input.skill_id, id)!, created: true };
}

export function listSkillRevisions(db: Database.Database, skillId: string): PodSkillRevision[] {
  return (db.prepare(`
    SELECT * FROM skill_revisions
    WHERE skill_id = ?
    ORDER BY revision_number DESC
  `).all(skillId) as any[]).map(deserializeSkillRevision);
}

export function getSkillRevision(db: Database.Database, skillId: string, revisionId: string): PodSkillRevision | null {
  const row = db.prepare(
    'SELECT * FROM skill_revisions WHERE skill_id = ? AND id = ?',
  ).get(skillId, revisionId) as any;
  return row ? deserializeSkillRevision(row) : null;
}

export function approveSkillRevision(db: Database.Database, skillId: string, revisionId?: string): PodSkillRevision | null {
  const revision = revisionId
    ? getSkillRevision(db, skillId, revisionId)
    : (db.prepare(`
        SELECT * FROM skill_revisions
        WHERE skill_id = ? AND status = 'draft'
        ORDER BY revision_number DESC LIMIT 1
      `).get(skillId) as any | undefined);
  if (!revision) return null;
  const target = 'content_hash' in revision ? revision as PodSkillRevision : deserializeSkillRevision(revision);
  const ts = now();
  db.transaction(() => {
    db.prepare(`
      UPDATE skill_revisions
      SET status = 'superseded'
      WHERE skill_id = ? AND status = 'approved' AND id <> ?
    `).run(skillId, target.id);
    db.prepare(`
      UPDATE skill_revisions SET status = 'approved', approved_at = ?
      WHERE skill_id = ? AND id = ?
    `).run(ts, skillId, target.id);
    db.prepare('UPDATE skills SET version = ?, updated_at = ? WHERE id = ?')
      .run(target.version, ts, skillId);
  })();
  return getSkillRevision(db, skillId, target.id);
}

export function rejectSkillRevision(db: Database.Database, skillId: string, revisionId: string): PodSkillRevision | null {
  const revision = getSkillRevision(db, skillId, revisionId);
  if (!revision || revision.status !== 'draft') return null;
  db.prepare(`
    UPDATE skill_revisions SET status = 'rejected'
    WHERE skill_id = ? AND id = ?
  `).run(skillId, revisionId);
  return getSkillRevision(db, skillId, revisionId);
}

function deserializeSkillDeployment(row: any): PodSkillDeployment {
  return {
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  } as PodSkillDeployment;
}

export function upsertSkillDeployment(db: Database.Database, input: {
  skill_id: string;
  agent_id: string;
  desired_revision_id?: string | null;
  installed_revision_id?: string | null;
  status?: PodSkillDeployment['status'];
  adapter?: string;
  target_path?: string | null;
  installed_hash?: string | null;
  last_error?: string | null;
  checked?: boolean;
  metadata?: Record<string, unknown> | null;
}): PodSkillDeployment {
  const existing = db.prepare('SELECT * FROM skill_deployments WHERE skill_id = ? AND agent_id = ?')
    .get(input.skill_id, input.agent_id) as any;
  const ts = now();
  const id = existing?.id ?? makeId('skd');
  db.prepare(`
    INSERT INTO skill_deployments (
      id, skill_id, agent_id, desired_revision_id, installed_revision_id,
      status, adapter, target_path, installed_hash, last_error,
      last_checked_at, created_at, updated_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(skill_id, agent_id) DO UPDATE SET
      desired_revision_id = excluded.desired_revision_id,
      installed_revision_id = excluded.installed_revision_id,
      status = excluded.status,
      adapter = excluded.adapter,
      target_path = excluded.target_path,
      installed_hash = excluded.installed_hash,
      last_error = excluded.last_error,
      last_checked_at = excluded.last_checked_at,
      updated_at = excluded.updated_at,
      metadata = excluded.metadata
  `).run(
    id,
    input.skill_id,
    input.agent_id,
    input.desired_revision_id ?? existing?.desired_revision_id ?? null,
    input.installed_revision_id ?? existing?.installed_revision_id ?? null,
    input.status ?? existing?.status ?? 'pending',
    input.adapter ?? existing?.adapter ?? 'unresolved',
    input.target_path ?? existing?.target_path ?? null,
    input.installed_hash ?? existing?.installed_hash ?? null,
    input.last_error ?? null,
    input.checked ? ts : existing?.last_checked_at ?? null,
    existing?.created_at ?? ts,
    ts,
    input.metadata ? JSON.stringify(input.metadata) : existing?.metadata ?? null,
  );
  return getSkillDeployment(db, input.skill_id, input.agent_id)!;
}

export function getSkillDeployment(db: Database.Database, skillId: string, agentId: string): PodSkillDeployment | null {
  const row = db.prepare('SELECT * FROM skill_deployments WHERE skill_id = ? AND agent_id = ?')
    .get(skillId, agentId) as any;
  return row ? deserializeSkillDeployment(row) : null;
}

export function listSkillDeployments(db: Database.Database, skillId?: string): PodSkillDeployment[] {
  const rows = skillId
    ? db.prepare('SELECT * FROM skill_deployments WHERE skill_id = ? ORDER BY agent_id').all(skillId)
    : db.prepare('SELECT * FROM skill_deployments ORDER BY updated_at DESC').all();
  return (rows as any[]).map(deserializeSkillDeployment);
}

export function deleteSkillDeployment(db: Database.Database, skillId: string, agentId: string): boolean {
  return db.prepare('DELETE FROM skill_deployments WHERE skill_id = ? AND agent_id = ?')
    .run(skillId, agentId).changes > 0;
}

export function upsertSkill(db: Database.Database, input: {
  id?: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  source?: PodSkill['source'];
  source_slug?: string | null;
  scope?: string;
  status?: PodSkill['status'];
  trust_score?: number;
  trust_level?: PodSkill['trust_level'];
  permissions?: string[];
  grant_id?: string;
  actor_id?: string;
  equipped_to?: string[];
  portability?: PodSkill['portability'];
  metadata?: Record<string, unknown>;
}): PodSkill {
  const ts = now();
  const id = input.id ?? makeId('sk');

  db.prepare(`
    INSERT INTO skills (id, name, description, version, author, source, source_slug, scope, status, trust_score, trust_level, permissions, grant_id, actor_id, equipped_to, portability, created_at, updated_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      version = excluded.version,
      author = excluded.author,
      source = excluded.source,
      source_slug = excluded.source_slug,
      scope = excluded.scope,
      status = excluded.status,
      trust_score = excluded.trust_score,
      trust_level = excluded.trust_level,
      permissions = excluded.permissions,
      grant_id = excluded.grant_id,
      actor_id = excluded.actor_id,
      equipped_to = excluded.equipped_to,
      portability = excluded.portability,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at
  `).run(
    id,
    input.name,
    input.description ?? '',
    input.version ?? '0.0.0',
    input.author ?? 'unknown',
    input.source ?? 'manual',
    input.source_slug ?? null,
    input.scope ?? 'personal',
    input.status ?? 'review',
    input.trust_score ?? 0,
    input.trust_level ?? 'blocked',
    JSON.stringify(input.permissions ?? []),
    input.grant_id ?? null,
    input.actor_id ?? null,
    JSON.stringify(input.equipped_to ?? []),
    input.portability ?? 'local',
    ts, ts,
    input.metadata ? JSON.stringify(input.metadata) : null,
  );

  return getSkill(db, id)!;
}

export function getSkill(db: Database.Database, id: string): PodSkill | null {
  const row = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as any;
  return row ? deserializeSkill(row) : null;
}

export function getSkillBySource(db: Database.Database, source: string, sourceSlug: string): PodSkill | null {
  const row = db.prepare('SELECT * FROM skills WHERE source = ? AND source_slug = ?').get(source, sourceSlug) as any;
  return row ? deserializeSkill(row) : null;
}

export function getSkillByName(db: Database.Database, name: string): PodSkill | null {
  const row = db.prepare('SELECT * FROM skills WHERE name = ? COLLATE NOCASE ORDER BY updated_at DESC LIMIT 1')
    .get(name) as any;
  return row ? deserializeSkill(row) : null;
}

export function getSkillByPackageHash(db: Database.Database, contentHash: string): PodSkill | null {
  const row = db.prepare(`
    SELECT s.* FROM skills s
    JOIN skill_revisions r ON r.skill_id = s.id
    WHERE r.content_hash = ?
    ORDER BY r.created_at DESC LIMIT 1
  `).get(contentHash) as any;
  return row ? deserializeSkill(row) : null;
}

export function listSkills(db: Database.Database, options: {
  status?: string;
  limit?: number;
} = {}): PodSkill[] {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];

  if (options.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }

  const rows = db.prepare(`
    SELECT * FROM skills WHERE ${conditions.join(' AND ')}
    ORDER BY updated_at DESC LIMIT ?
  `).all(...params, options.limit ?? 100) as any[];

  return rows.map(deserializeSkill);
}

export function updateSkillStatus(db: Database.Database, id: string, status: PodSkill['status'], grantId?: string | null): boolean {
  const ts = now();
  const result = grantId !== undefined
    ? db.prepare('UPDATE skills SET status = ?, grant_id = ?, updated_at = ? WHERE id = ?').run(status, grantId, ts, id)
    : db.prepare('UPDATE skills SET status = ?, updated_at = ? WHERE id = ?').run(status, ts, id);
  return result.changes > 0;
}

export function updateSkillRun(db: Database.Database, id: string, success: boolean): void {
  const ts = now();
  if (success) {
    db.prepare('UPDATE skills SET runs = runs + 1, last_run = ?, updated_at = ? WHERE id = ?').run(ts, ts, id);
  } else {
    db.prepare('UPDATE skills SET runs = runs + 1, failures = failures + 1, last_run = ?, updated_at = ? WHERE id = ?').run(ts, ts, id);
  }
}

export function deleteSkill(db: Database.Database, id: string): boolean {
  return db.prepare('DELETE FROM skills WHERE id = ?').run(id).changes > 0;
}

export function countSkillsUsingGrant(db: Database.Database, grantId: string): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM skills WHERE grant_id = ?').get(grantId) as { count: number };
  return row.count;
}

export function listSkillBindings(db: Database.Database, skillId: string): PodSkillBinding[] {
  return db.prepare(`
    SELECT skill_id, agent_id, status, grant_id, created_at, updated_at
    FROM skill_bindings
    WHERE skill_id = ?
    ORDER BY agent_id
  `).all(skillId) as PodSkillBinding[];
}

export function replaceSkillBindings(
  db: Database.Database,
  skillId: string,
  agentIds: string[],
  status: PodSkillBinding['status'] = 'pending',
): { bindings: PodSkillBinding[]; removed: PodSkillBinding[] } {
  const uniqueAgentIds = [...new Set(agentIds)].sort();
  const wanted = new Set(uniqueAgentIds);
  const existing = listSkillBindings(db, skillId);
  const removed = existing.filter(binding => !wanted.has(binding.agent_id));
  const existingIds = new Set(existing.map(binding => binding.agent_id));
  const ts = now();

  db.transaction(() => {
    for (const binding of removed) {
      db.prepare('DELETE FROM skill_bindings WHERE skill_id = ? AND agent_id = ?').run(skillId, binding.agent_id);
    }
    const insert = db.prepare(`
      INSERT INTO skill_bindings (skill_id, agent_id, status, grant_id, created_at, updated_at)
      VALUES (?, ?, ?, NULL, ?, ?)
    `);
    for (const agentId of uniqueAgentIds) {
      if (!existingIds.has(agentId)) insert.run(skillId, agentId, status, ts, ts);
    }
    db.prepare('UPDATE skills SET equipped_to = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(uniqueAgentIds), ts, skillId);
  })();

  return { bindings: listSkillBindings(db, skillId), removed };
}

export function updateSkillBinding(
  db: Database.Database,
  skillId: string,
  agentId: string,
  patch: { status: PodSkillBinding['status']; grant_id?: string | null },
): boolean {
  const result = patch.grant_id !== undefined
    ? db.prepare(`
        UPDATE skill_bindings SET status = ?, grant_id = ?, updated_at = ?
        WHERE skill_id = ? AND agent_id = ?
      `).run(patch.status, patch.grant_id, now(), skillId, agentId)
    : db.prepare(`
        UPDATE skill_bindings SET status = ?, updated_at = ?
        WHERE skill_id = ? AND agent_id = ?
      `).run(patch.status, now(), skillId, agentId);
  return result.changes > 0;
}

/* ── Agent Plugins ── */

function deserializePlugin(row: any): PodPlugin {
  return {
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  } as PodPlugin;
}

function deserializePluginRevision(row: any): PodPluginRevision {
  return {
    ...row,
    manifest: JSON.parse(row.manifest),
    files: JSON.parse(row.files),
    inspection: JSON.parse(row.inspection),
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  } as PodPluginRevision;
}

export function upsertPlugin(db: Database.Database, input: {
  id?: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  source?: PodPlugin['source'];
  source_ref?: string | null;
  status?: PodPlugin['status'];
  schema_version: string;
  trust_score?: number;
  trust_level?: PodPlugin['trust_level'];
  metadata?: Record<string, unknown> | null;
}): PodPlugin {
  const id = input.id ?? makeId('plg');
  const ts = now();
  db.prepare(`
    INSERT INTO plugins (
      id, name, description, version, author, source, source_ref, status,
      schema_version, trust_score, trust_level, created_at, updated_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      version = excluded.version,
      author = excluded.author,
      source = excluded.source,
      source_ref = excluded.source_ref,
      status = excluded.status,
      schema_version = excluded.schema_version,
      trust_score = excluded.trust_score,
      trust_level = excluded.trust_level,
      updated_at = excluded.updated_at,
      metadata = excluded.metadata
  `).run(
    id,
    input.name,
    input.description ?? '',
    input.version ?? '0.0.0',
    input.author ?? 'unknown',
    input.source ?? 'manual',
    input.source_ref ?? null,
    input.status ?? 'review',
    input.schema_version,
    input.trust_score ?? 0,
    input.trust_level ?? 'blocked',
    ts,
    ts,
    input.metadata ? JSON.stringify(input.metadata) : null,
  );
  return getPlugin(db, id)!;
}

export function getPlugin(db: Database.Database, id: string): PodPlugin | null {
  const row = db.prepare('SELECT * FROM plugins WHERE id = ?').get(id) as any;
  return row ? deserializePlugin(row) : null;
}

export function getPluginByName(db: Database.Database, name: string): PodPlugin | null {
  const row = db.prepare('SELECT * FROM plugins WHERE name = ? COLLATE NOCASE ORDER BY updated_at DESC LIMIT 1')
    .get(name) as any;
  return row ? deserializePlugin(row) : null;
}

export function getPluginBySource(db: Database.Database, source: string, sourceRef: string): PodPlugin | null {
  const row = db.prepare('SELECT * FROM plugins WHERE source = ? AND source_ref = ? ORDER BY updated_at DESC LIMIT 1')
    .get(source, sourceRef) as any;
  return row ? deserializePlugin(row) : null;
}

export function listPlugins(db: Database.Database, options: { status?: string; limit?: number } = {}): PodPlugin[] {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  if (options.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }
  const rows = db.prepare(`
    SELECT * FROM plugins WHERE ${conditions.join(' AND ')}
    ORDER BY updated_at DESC LIMIT ?
  `).all(...params, options.limit ?? 100) as any[];
  return rows.map(deserializePlugin);
}

export function capturePluginRevision(db: Database.Database, input: {
  plugin_id: string;
  version?: string;
  package_hash: string;
  schema_uri: string;
  manifest: Record<string, unknown>;
  files: Record<string, PodPluginPackageFile>;
  inspection: Record<string, unknown>;
  components: PodPluginRevisionComponent[];
  source_ref?: string | null;
  created_by?: string;
  status?: PodPluginRevision['status'];
  metadata?: Record<string, unknown> | null;
}): { revision: PodPluginRevision; created: boolean } {
  const fingerprint = crypto.createHash('sha256').update(stableJson({
    package_hash: input.package_hash,
    version: input.version ?? '0.0.0',
  })).digest('hex');
  const existing = db.prepare(
    'SELECT * FROM plugin_revisions WHERE plugin_id = ? AND revision_fingerprint = ?',
  ).get(input.plugin_id, fingerprint) as any;
  if (existing) return { revision: deserializePluginRevision(existing), created: false };

  const next = db.prepare(
    'SELECT COALESCE(MAX(revision_number), 0) + 1 AS revision_number FROM plugin_revisions WHERE plugin_id = ?',
  ).get(input.plugin_id) as { revision_number: number };
  const id = makeId('plr');
  const ts = now();
  const status = input.status ?? 'draft';
  db.transaction(() => {
    db.prepare(`
      INSERT INTO plugin_revisions (
        id, plugin_id, revision_number, version, status, package_hash,
        revision_fingerprint, schema_uri, manifest, files, inspection,
        source_ref, created_by, created_at, approved_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.plugin_id,
      next.revision_number,
      input.version ?? '0.0.0',
      status,
      input.package_hash,
      fingerprint,
      input.schema_uri,
      JSON.stringify(input.manifest),
      JSON.stringify(input.files),
      JSON.stringify(input.inspection),
      input.source_ref ?? null,
      input.created_by ?? 'person-local',
      ts,
      status === 'approved' ? ts : null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    );
    const insertComponent = db.prepare(`
      INSERT INTO plugin_revision_components (
        revision_id, component_type, component_key, status, detail
      ) VALUES (?, ?, ?, ?, ?)
    `);
    for (const component of input.components) {
      insertComponent.run(
        id,
        component.component_type,
        component.component_key,
        component.status,
        JSON.stringify(component.detail),
      );
    }
  })();
  return { revision: getPluginRevision(db, input.plugin_id, id)!, created: true };
}

export function getPluginRevision(db: Database.Database, pluginId: string, revisionId: string): PodPluginRevision | null {
  const row = db.prepare('SELECT * FROM plugin_revisions WHERE plugin_id = ? AND id = ?')
    .get(pluginId, revisionId) as any;
  return row ? deserializePluginRevision(row) : null;
}

export function listPluginRevisions(db: Database.Database, pluginId: string): PodPluginRevision[] {
  return (db.prepare(`
    SELECT * FROM plugin_revisions WHERE plugin_id = ? ORDER BY revision_number DESC
  `).all(pluginId) as any[]).map(deserializePluginRevision);
}

export function listPluginRevisionComponents(db: Database.Database, revisionId: string): PodPluginRevisionComponent[] {
  return (db.prepare(`
    SELECT revision_id, component_type, component_key, status, detail
    FROM plugin_revision_components
    WHERE revision_id = ?
    ORDER BY component_type, component_key
  `).all(revisionId) as any[]).map(row => ({
    ...row,
    detail: JSON.parse(row.detail),
  })) as PodPluginRevisionComponent[];
}

export function approvePluginRevision(db: Database.Database, pluginId: string, revisionId: string): PodPluginRevision | null {
  const revision = getPluginRevision(db, pluginId, revisionId);
  if (!revision || revision.status !== 'draft') return null;
  const ts = now();
  db.transaction(() => {
    db.prepare(`
      UPDATE plugin_revisions SET status = 'superseded'
      WHERE plugin_id = ? AND status = 'approved' AND id <> ?
    `).run(pluginId, revisionId);
    db.prepare(`
      UPDATE plugin_revisions SET status = 'approved', approved_at = ?
      WHERE plugin_id = ? AND id = ?
    `).run(ts, pluginId, revisionId);
    db.prepare(`
      UPDATE plugins SET version = ?, status = 'approved', updated_at = ? WHERE id = ?
    `).run(revision.version, ts, pluginId);
  })();
  return getPluginRevision(db, pluginId, revisionId);
}

export function rejectPluginRevision(db: Database.Database, pluginId: string, revisionId: string): PodPluginRevision | null {
  const revision = getPluginRevision(db, pluginId, revisionId);
  if (!revision || revision.status !== 'draft') return null;
  db.prepare(`UPDATE plugin_revisions SET status = 'rejected' WHERE plugin_id = ? AND id = ?`)
    .run(pluginId, revisionId);
  return getPluginRevision(db, pluginId, revisionId);
}

export function deletePlugin(db: Database.Database, id: string): boolean {
  return db.prepare('DELETE FROM plugins WHERE id = ?').run(id).changes > 0;
}

function deserializeSkill(row: any): PodSkill {
  return {
    ...row,
    permissions: row.permissions ? JSON.parse(row.permissions) : [],
    equipped_to: row.equipped_to ? JSON.parse(row.equipped_to) : [],
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}

/* ── Saved views ── */

export function listSavedViews(db: Database.Database): PodSavedView[] {
  const rows = db.prepare('SELECT * FROM saved_views ORDER BY is_default DESC, name COLLATE NOCASE ASC').all() as any[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    filters: JSON.parse(row.filters),
    is_default: !!row.is_default,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export function upsertSavedView(db: Database.Database, input: { id?: string; name: string; filters: Record<string, unknown>; is_default?: boolean }): PodSavedView {
  const ts = now();
  const id = input.id ?? makeId('view');
  db.prepare(`
    INSERT INTO saved_views (id, name, filters, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      filters = excluded.filters,
      is_default = excluded.is_default,
      updated_at = excluded.updated_at
  `).run(id, input.name, JSON.stringify(input.filters), input.is_default ? 1 : 0, ts, ts);
  return listSavedViews(db).find((view) => view.id === id)!;
}

export function deleteSavedView(db: Database.Database, id: string): boolean {
  return db.prepare('DELETE FROM saved_views WHERE id = ?').run(id).changes > 0;
}

/* ── Settings ── */

export function getSettings(db: Database.Database, namespace: string): Record<string, unknown> {
  const rows = db.prepare('SELECT key, value FROM pod_settings WHERE namespace = ?').all(namespace) as Array<{ key: string; value: string }>;
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    try { out[row.key] = JSON.parse(row.value); } catch { out[row.key] = row.value; }
  }
  return out;
}

export function setSettings(db: Database.Database, namespace: string, values: Record<string, unknown>): Record<string, unknown> {
  const ts = now();
  const upsert = db.prepare(`
    INSERT INTO pod_settings (namespace, key, value, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(namespace, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  const del = db.prepare('DELETE FROM pod_settings WHERE namespace = ? AND key = ?');
  db.transaction(() => {
    for (const [key, value] of Object.entries(values)) {
      if (value === null) del.run(namespace, key);
      else upsert.run(namespace, key, JSON.stringify(value), ts);
    }
  })();
  return getSettings(db, namespace);
}

export function deleteSetting(db: Database.Database, namespace: string, key: string): boolean {
  return db.prepare('DELETE FROM pod_settings WHERE namespace = ? AND key = ?').run(namespace, key).changes > 0;
}

/* ── Agents + per-agent collection grants ── */

export interface PodAgent {
  id: string;
  name: string;
  description: string;
  role: 'agent' | 'substrate' | 'system';
  workspace_id: string | null;
  model: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  metadata: Record<string, unknown> | null;
  /** Per-agent bearer token. May be null for legacy rows; mint via
   *  rotateAgentToken() when first accessed. */
  auth_token: string | null;
  // ── Brain fields (the agent's "different brain"): a bounded memory view,
  //    a self-concept, and a default context budget. ──
  /** The agent's self-concept / system preface, prepended to its context packs. */
  persona: string | null;
  /** User-facing access preset. Legacy rows migrate to scoped. */
  access_mode: AgentAccessMode;
  /** Smartware scope names used by scoped and capture-only access. */
  scopes: string[] | null;
  /** Default token budget for this brain's context packs. */
  context_budget: number | null;
}

export interface PodAgentGrant {
  id: string;
  agent_id: string;
  collection_id: string;
  access: 'read' | 'write';
  created_at: string;
  created_by: string;
  revoked_at: string | null;
  note: string | null;
}

function rowToAgent(row: Record<string, unknown>): PodAgent {
  let metadata: Record<string, unknown> | null = null;
  if (typeof row.metadata === 'string' && row.metadata) {
    try { metadata = JSON.parse(row.metadata as string); } catch { /* keep null */ }
  }
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
    role: (row.role as PodAgent['role']) ?? 'agent',
    workspace_id: (row.workspace_id as string | null) ?? null,
    model: (row.model as string | null) ?? null,
    status: String(row.status ?? 'active'),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    created_by: String(row.created_by ?? 'user'),
    metadata,
    auth_token: (row.auth_token as string | null) ?? null,
    persona: (row.persona as string | null) ?? null,
    access_mode: normaliseAgentAccessMode(row.access_mode),
    scopes: (() => {
      if (typeof row.scopes === 'string' && row.scopes) {
        try { const v = JSON.parse(row.scopes as string); return Array.isArray(v) ? v : null; } catch { return null; }
      }
      return null;
    })(),
    context_budget: row.context_budget != null ? Number(row.context_budget) : null,
  };
}

/** Generate a per-agent bearer token. `cpod_agent_<32-char-base64url>`.
 *  Tokens are opaque; the route auth middleware matches the prefix and
 *  resolves to the agents.id whose auth_token equals the bearer value. */
function mintAgentToken(): string {
  // 24 random bytes → 32 base64url chars. crypto is already imported.
  return 'cpod_agent_' + crypto.randomBytes(24).toString('base64url');
}

export function listAgents(db: Database.Database): PodAgent[] {
  const rows = db.prepare('SELECT * FROM agents ORDER BY created_at ASC').all() as Array<Record<string, unknown>>;
  return rows.map(rowToAgent);
}

export function getAgent(db: Database.Database, id: string): PodAgent | null {
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToAgent(row) : null;
}

export function upsertAgent(db: Database.Database, input: {
  id?: string;
  name: string;
  description?: string;
  role?: 'agent' | 'substrate' | 'system';
  workspace_id?: string | null;
  model?: string | null;
  status?: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
  persona?: string | null;
  access_mode?: AgentAccessMode;
  scopes?: string[] | null;
  context_budget?: number | null;
}): PodAgent {
  const id = input.id ?? `agent:${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const ts = now();
  const existing = getAgent(db, id);
  if (existing) {
    const accessMode = normaliseAgentAccessMode(input.access_mode, existing.access_mode);
    const scopes = scopesForAgentStorage(
      accessMode,
      input.scopes !== undefined ? input.scopes : existing.scopes,
      existing.scopes,
    );
    db.prepare(`
      UPDATE agents SET
        name = ?, description = ?, role = ?, workspace_id = ?,
        model = ?, status = ?, updated_at = ?, metadata = ?,
        persona = ?, access_mode = ?, scopes = ?, context_budget = ?
      WHERE id = ?
    `).run(
      input.name,
      input.description ?? existing.description,
      input.role ?? existing.role,
      input.workspace_id ?? existing.workspace_id,
      input.model !== undefined ? input.model : existing.model,
      input.status ?? existing.status,
      ts,
      input.metadata ? JSON.stringify(input.metadata) : (existing.metadata ? JSON.stringify(existing.metadata) : null),
      input.persona !== undefined ? input.persona : existing.persona,
      accessMode,
      JSON.stringify(scopes),
      input.context_budget !== undefined ? input.context_budget : existing.context_budget,
      id,
    );
    // Back-fill auth_token if the row pre-dates the migration.
    if (!existing.auth_token) {
      db.prepare('UPDATE agents SET auth_token = ? WHERE id = ?').run(mintAgentToken(), id);
    }
  } else {
    const accessMode = normaliseAgentAccessMode(input.access_mode);
    const scopes = scopesForAgentStorage(accessMode, input.scopes);
    // New agents get a token immediately so the invite blob has something
    // real to render in step 2 of the Connect modal.
    db.prepare(`
      INSERT INTO agents (id, name, description, role, workspace_id, model, status, created_at, updated_at, created_by, metadata, auth_token, persona, access_mode, scopes, context_budget)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.description ?? '',
      input.role ?? 'agent',
      input.workspace_id ?? null,
      input.model ?? null,
      input.status ?? 'active',
      ts,
      ts,
      input.created_by ?? 'user',
      input.metadata ? JSON.stringify(input.metadata) : null,
      mintAgentToken(),
      input.persona ?? null,
      accessMode,
      JSON.stringify(scopes),
      input.context_budget ?? null,
    );
  }
  return getAgent(db, id)!;
}

/** Rotate an agent's bearer token. Returns the new token (only time it's
 *  visible un-masked outside the DB). Returns null if agent doesn't exist. */
export function rotateAgentToken(db: Database.Database, id: string): string | null {
  const existing = getAgent(db, id);
  if (!existing) return null;
  const token = mintAgentToken();
  db.prepare('UPDATE agents SET auth_token = ?, updated_at = ? WHERE id = ?').run(token, now(), id);
  return token;
}

/** Resolve an agent by its bearer token. Used by the auth middleware to
 *  map `Authorization: Bearer cpod_agent_...` headers to an actor_id. */
export function getAgentByToken(db: Database.Database, token: string): PodAgent | null {
  if (!token || !token.startsWith('cpod_agent_')) return null;
  const row = db.prepare('SELECT * FROM agents WHERE auth_token = ?').get(token) as Record<string, unknown> | undefined;
  return row ? rowToAgent(row) : null;
}

export function deleteAgent(db: Database.Database, id: string): boolean {
  const tx = db.transaction(() => {
    db.prepare('UPDATE agent_collection_grants SET revoked_at = ? WHERE agent_id = ? AND revoked_at IS NULL').run(now(), id);
    return db.prepare('DELETE FROM agents WHERE id = ?').run(id).changes > 0;
  });
  return tx();
}

function rowToGrant(row: Record<string, unknown>): PodAgentGrant {
  return {
    id: String(row.id),
    agent_id: String(row.agent_id),
    collection_id: String(row.collection_id),
    access: (row.access as PodAgentGrant['access']) ?? 'read',
    created_at: String(row.created_at),
    created_by: String(row.created_by),
    revoked_at: (row.revoked_at as string | null) ?? null,
    note: (row.note as string | null) ?? null,
  };
}

export function listAgentGrants(db: Database.Database, agentId: string, includeRevoked = false): PodAgentGrant[] {
  const sql = includeRevoked
    ? 'SELECT * FROM agent_collection_grants WHERE agent_id = ? ORDER BY created_at DESC'
    : 'SELECT * FROM agent_collection_grants WHERE agent_id = ? AND revoked_at IS NULL ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(agentId) as Array<Record<string, unknown>>;
  return rows.map(rowToGrant);
}

export function addAgentGrant(db: Database.Database, input: {
  agent_id: string;
  collection_id: string;
  access?: 'read' | 'write';
  created_by: string;
  note?: string;
}): PodAgentGrant {
  // Idempotent: if a non-revoked grant already exists for this (agent,
  // collection, access) combo, return it. Otherwise insert a fresh row.
  const existing = db.prepare(`
    SELECT * FROM agent_collection_grants
    WHERE agent_id = ? AND collection_id = ? AND access = ? AND revoked_at IS NULL
    LIMIT 1
  `).get(input.agent_id, input.collection_id, input.access ?? 'read') as Record<string, unknown> | undefined;
  if (existing) return rowToGrant(existing);

  const id = `grant:${input.agent_id}:${input.collection_id}:${Date.now().toString(36)}`;
  const ts = now();
  db.prepare(`
    INSERT INTO agent_collection_grants
      (id, agent_id, collection_id, access, created_at, created_by, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.agent_id,
    input.collection_id,
    input.access ?? 'read',
    ts,
    input.created_by,
    input.note ?? null,
  );
  return rowToGrant(db.prepare('SELECT * FROM agent_collection_grants WHERE id = ?').get(id) as Record<string, unknown>);
}

export function revokeAgentGrant(db: Database.Database, grantId: string): boolean {
  return db.prepare('UPDATE agent_collection_grants SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(now(), grantId).changes > 0;
}
