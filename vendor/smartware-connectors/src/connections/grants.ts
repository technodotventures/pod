import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

export interface ConnectionGrantRow {
  id: string;
  actor_id: string;
  service_id: string;
  tool_pattern: string;
  expires_at: number | null;
  revoked_at: string | null;
  created_at: string;
  created_by: string;
  note: string | null;
}

export interface ConnectionGrantInput {
  actor_id: string;
  service_id: string;
  /** Glob: '*' = any tool, 'google_drive_search_*' = read-only, 'google_drive_search_documents' = exact. */
  tool_pattern?: string;
  expires_at?: number | null;
  created_by: string;
  note?: string;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function isActive(grant: Pick<ConnectionGrantRow, 'revoked_at' | 'expires_at'>): boolean {
  if (grant.revoked_at) return false;
  if (grant.expires_at !== null && grant.expires_at !== undefined && grant.expires_at <= Date.now()) return false;
  return true;
}

export function listConnectionGrants(db: Database.Database, filter: { actor_id?: string; service_id?: string } = {}): ConnectionGrantRow[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.actor_id) { clauses.push('actor_id = @actor_id'); params['actor_id'] = filter.actor_id; }
  if (filter.service_id) { clauses.push('service_id = @service_id'); params['service_id'] = filter.service_id; }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM connection_grants ${where} ORDER BY created_at DESC`).all(params) as ConnectionGrantRow[];
}

export function createConnectionGrant(db: Database.Database, input: ConnectionGrantInput): ConnectionGrantRow {
  const row: ConnectionGrantRow = {
    id: `cgrant_${crypto.randomBytes(12).toString('base64url')}`,
    actor_id: input.actor_id,
    service_id: input.service_id,
    tool_pattern: input.tool_pattern ?? '*',
    expires_at: input.expires_at ?? null,
    revoked_at: null,
    created_at: new Date().toISOString(),
    created_by: input.created_by,
    note: input.note ?? null,
  };
  db.prepare(`
    INSERT INTO connection_grants (id, actor_id, service_id, tool_pattern, expires_at, revoked_at, created_at, created_by, note)
    VALUES (@id, @actor_id, @service_id, @tool_pattern, @expires_at, @revoked_at, @created_at, @created_by, @note)
  `).run(row);
  return row;
}

export function revokeConnectionGrant(db: Database.Database, id: string): ConnectionGrantRow | null {
  const existing = db.prepare('SELECT * FROM connection_grants WHERE id = ?').get(id) as ConnectionGrantRow | undefined;
  if (!existing || existing.revoked_at) return existing ?? null;
  const revoked_at = new Date().toISOString();
  db.prepare('UPDATE connection_grants SET revoked_at = ? WHERE id = ?').run(revoked_at, id);
  return { ...existing, revoked_at };
}

/** Returns the matching grant if the actor is allowed to call (service_id, tool_name), else null. */
export function checkConnectionGrant(
  db: Database.Database,
  actor_id: string,
  service_id: string,
  tool_name: string,
): ConnectionGrantRow | null {
  const grants = db.prepare(`
    SELECT * FROM connection_grants
    WHERE actor_id = ? AND service_id = ? AND revoked_at IS NULL
  `).all(actor_id, service_id) as ConnectionGrantRow[];

  for (const grant of grants) {
    if (!isActive(grant)) continue;
    if (globToRegex(grant.tool_pattern).test(tool_name)) return grant;
  }
  return null;
}
