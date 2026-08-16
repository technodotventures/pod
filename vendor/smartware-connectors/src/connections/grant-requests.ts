import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

import { createConnectionGrant, type ConnectionGrantRow } from './grants.js';

export type GrantRequestStatus = 'pending' | 'approved' | 'denied';

export interface ConnectionGrantRequestRow {
  id: string;
  actor_id: string;
  service_id: string;
  tool_pattern: string;
  reason: string | null;
  requested_expires_at: number | null;
  status: GrantRequestStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  approved_grant_id: string | null;
  created_at: string;
}

export interface ConnectionGrantRequestInput {
  actor_id: string;
  service_id: string;
  tool_pattern?: string;
  reason?: string;
  requested_expires_at?: number | null;
}

export function createGrantRequest(db: Database.Database, input: ConnectionGrantRequestInput): ConnectionGrantRequestRow {
  const row: ConnectionGrantRequestRow = {
    id: `cgreq_${crypto.randomBytes(10).toString('base64url')}`,
    actor_id: input.actor_id,
    service_id: input.service_id,
    tool_pattern: input.tool_pattern ?? '*',
    reason: input.reason ?? null,
    requested_expires_at: input.requested_expires_at ?? null,
    status: 'pending',
    resolved_at: null,
    resolved_by: null,
    approved_grant_id: null,
    created_at: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO connection_grant_requests (id, actor_id, service_id, tool_pattern, reason, requested_expires_at, status, resolved_at, resolved_by, approved_grant_id, created_at)
    VALUES (@id, @actor_id, @service_id, @tool_pattern, @reason, @requested_expires_at, @status, @resolved_at, @resolved_by, @approved_grant_id, @created_at)
  `).run(row);
  return row;
}

export function listGrantRequests(db: Database.Database, filter: { status?: GrantRequestStatus; actor_id?: string } = {}): ConnectionGrantRequestRow[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.status) { clauses.push('status = @status'); params['status'] = filter.status; }
  if (filter.actor_id) { clauses.push('actor_id = @actor_id'); params['actor_id'] = filter.actor_id; }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM connection_grant_requests ${where} ORDER BY created_at DESC`).all(params) as ConnectionGrantRequestRow[];
}

export function getGrantRequest(db: Database.Database, id: string): ConnectionGrantRequestRow | null {
  return (db.prepare('SELECT * FROM connection_grant_requests WHERE id = ?').get(id) as ConnectionGrantRequestRow | undefined) ?? null;
}

export interface ApproveResult {
  request: ConnectionGrantRequestRow;
  grant: ConnectionGrantRow;
}

export function approveGrantRequest(
  db: Database.Database,
  id: string,
  approver: string,
  overrides: { tool_pattern?: string; expires_at?: number | null; note?: string } = {},
): ApproveResult | null {
  const existing = getGrantRequest(db, id);
  if (!existing || existing.status !== 'pending') return null;

  const grant = createConnectionGrant(db, {
    actor_id: existing.actor_id,
    service_id: existing.service_id,
    tool_pattern: overrides.tool_pattern ?? existing.tool_pattern,
    expires_at: overrides.expires_at !== undefined ? overrides.expires_at : existing.requested_expires_at,
    created_by: approver,
    note: overrides.note ?? existing.reason ?? undefined,
  });
  const resolved_at = new Date().toISOString();
  db.prepare(`
    UPDATE connection_grant_requests
    SET status = 'approved', resolved_at = ?, resolved_by = ?, approved_grant_id = ?
    WHERE id = ?
  `).run(resolved_at, approver, grant.id, id);
  return {
    request: { ...existing, status: 'approved', resolved_at, resolved_by: approver, approved_grant_id: grant.id },
    grant,
  };
}

export function denyGrantRequest(db: Database.Database, id: string, denier: string): ConnectionGrantRequestRow | null {
  const existing = getGrantRequest(db, id);
  if (!existing || existing.status !== 'pending') return null;
  const resolved_at = new Date().toISOString();
  db.prepare(`
    UPDATE connection_grant_requests
    SET status = 'denied', resolved_at = ?, resolved_by = ?
    WHERE id = ?
  `).run(resolved_at, denier, id);
  return { ...existing, status: 'denied', resolved_at, resolved_by: denier };
}
