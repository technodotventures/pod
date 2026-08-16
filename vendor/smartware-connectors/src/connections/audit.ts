import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

export type CallerKind = 'owner' | 'client' | 'unauthenticated';
export type CallStatus = 'ok' | 'error';
export type ErrorKind =
  | 'token_refresh'
  | 'docker_runtime'
  | 'mcp'
  | 'tool_not_found'
  | 'tool_execution'
  | 'grant_denied'
  | 'unsupported'
  | 'unknown';

export interface McpCallAuditEntry {
  id: string;
  actor_id: string;
  service_id: string;
  tool_name: string;
  args_summary: string | null;
  status: CallStatus;
  error_kind: ErrorKind | null;
  duration_ms: number;
  grant_id: string | null;
  caller_kind: CallerKind;
  observed_at: string;
}

export interface RecordMcpCallInput {
  actor_id: string;
  service_id: string;
  tool_name: string;
  args: unknown;
  status: CallStatus;
  error_kind?: ErrorKind | null;
  duration_ms: number;
  grant_id?: string | null;
  caller_kind: CallerKind;
}

/** Best-effort: truncate stringified args to 200 chars so we never store full payload contents. */
function summarizeArgs(args: unknown): string | null {
  if (args === undefined || args === null) return null;
  try {
    const json = JSON.stringify(args);
    return json.length > 200 ? json.slice(0, 197) + '…' : json;
  } catch {
    return '[unserializable]';
  }
}

export function recordMcpCall(db: Database.Database, input: RecordMcpCallInput): McpCallAuditEntry {
  const row: McpCallAuditEntry = {
    id: `mcall_${crypto.randomBytes(10).toString('base64url')}`,
    actor_id: input.actor_id,
    service_id: input.service_id,
    tool_name: input.tool_name,
    args_summary: summarizeArgs(input.args),
    status: input.status,
    error_kind: input.error_kind ?? null,
    duration_ms: input.duration_ms,
    grant_id: input.grant_id ?? null,
    caller_kind: input.caller_kind,
    observed_at: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO mcp_tool_calls (id, actor_id, service_id, tool_name, args_summary, status, error_kind, duration_ms, grant_id, caller_kind, observed_at)
    VALUES (@id, @actor_id, @service_id, @tool_name, @args_summary, @status, @error_kind, @duration_ms, @grant_id, @caller_kind, @observed_at)
  `).run(row);
  return row;
}

export interface AuditQueryFilter {
  actor_id?: string;
  service_id?: string;
  status?: CallStatus;
  limit?: number;
  since?: string;
}

export function listMcpCalls(db: Database.Database, filter: AuditQueryFilter = {}): McpCallAuditEntry[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.actor_id) { clauses.push('actor_id = @actor_id'); params['actor_id'] = filter.actor_id; }
  if (filter.service_id) { clauses.push('service_id = @service_id'); params['service_id'] = filter.service_id; }
  if (filter.status) { clauses.push('status = @status'); params['status'] = filter.status; }
  if (filter.since) { clauses.push('observed_at >= @since'); params['since'] = filter.since; }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(500, filter.limit ?? 100));
  params['limit'] = limit;
  return db.prepare(`SELECT * FROM mcp_tool_calls ${where} ORDER BY observed_at DESC LIMIT @limit`).all(params) as McpCallAuditEntry[];
}
