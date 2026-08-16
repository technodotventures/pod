// Consumer-side OperationId idempotency + ops-log adoption.
//
// Per Protocol Contract v0.4.1 + Reference Implementation v0.1.2, every
// mutating verb commits via an ops-log-last pattern:
//
//   1. Validate the OperationId pattern at the route boundary.
//   2. Check the operations_seen cache:
//        - duplicate (same id + same payload_hash) → return cached result
//        - conflict  (same id + different payload_hash) → 409 conflict
//        - fresh → proceed
//   3. Run the substrate call.
//   4. On success, cache the result in operations_seen AND append the
//      ops-log entry to pod_data/operations/YYYY-MM-DD.jsonl. The ops-log
//      append is the durable cross-artifact commit signal.
//
// See vendor/smartware/docs/atomicity.md for the full strategy.

import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';

import {
  appendOpLogEntry,
  isValidOperationId,
  type OpType,
} from 'smartware';

export interface OperationsSeenRow {
  operation_id: string;
  actor_id: string;
  op: string;
  payload_hash: string;
  result_json: string;
  commit_ts: string;
  created_at: string;
}

export type IdempotencyCheck<T> =
  | { kind: 'duplicate'; cachedResult: T; commit_ts: string }
  | { kind: 'conflict'; existing: OperationsSeenRow }
  | { kind: 'fresh' };

function nowIso(): string {
  return new Date().toISOString();
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stableValue(v)]),
    );
  }
  return value;
}

export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(payload))).digest('hex');
}

/**
 * Look up an operation_id in the consumer cache.
 *
 * Throws `OperationIdFormatError` if the supplied id is malformed.
 */
export function checkOperation<T>(
  db: Database.Database,
  operationId: string,
  payloadHash: string,
): IdempotencyCheck<T> {
  if (!isValidOperationId(operationId)) {
    throw new OperationIdFormatError(operationId);
  }
  const row = db
    .prepare('SELECT * FROM operations_seen WHERE operation_id = ?')
    .get(operationId) as OperationsSeenRow | undefined;
  if (!row) return { kind: 'fresh' };
  if (row.payload_hash === payloadHash) {
    return { kind: 'duplicate', cachedResult: JSON.parse(row.result_json) as T, commit_ts: row.commit_ts };
  }
  return { kind: 'conflict', existing: row };
}

/**
 * Persist the result of a successful mutation into the cache. Idempotent.
 */
export function recordOperation(
  db: Database.Database,
  row: Omit<OperationsSeenRow, 'created_at'>,
): void {
  db.prepare(
    `INSERT OR REPLACE INTO operations_seen
     (operation_id, actor_id, op, payload_hash, result_json, commit_ts, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.operation_id,
    row.actor_id,
    row.op,
    row.payload_hash,
    row.result_json,
    row.commit_ts,
    nowIso(),
  );
}

export class OperationIdFormatError extends Error {
  constructor(public readonly received: string) {
    super(`operation_id '${received}' does not match ^op_[0-9A-HJKMNP-TV-Z]{26}$`);
    this.name = 'OperationIdFormatError';
  }
}

/**
 * Wrap a mutating route handler in spec-conformant OperationId + ops-log
 * commit semantics.
 *
 * Caller responsibilities:
 *   - Pass the validated `operation_id` from the request payload.
 *   - Pass the request payload itself (used for hashing — stable JSON shape).
 *   - Pass `run`: a closure that performs the substrate call and returns the
 *     result to cache. `run` receives `commit_ts` to use for any artifact
 *     timestamps it controls.
 *
 * Outcomes:
 *   - duplicate → returns the cached result; NO substrate call; NO new ops-log
 *     entry (the original commit already wrote one).
 *   - conflict  → throws ConflictError. Caller maps to HTTP 409 with the
 *     spec error envelope.
 *   - fresh     → runs `run`, caches the result, appends ops-log entry LAST.
 */
export async function wrapMutation<T>(
  ctx: {
    db: Database.Database;
    opsDir: string;
    operation_id: string;
    actor_id: string;
    op: OpType;
    /** The complete request payload — hashed to detect mismatch on retry. */
    payload: unknown;
    /** Optional details to attach to the ops-log entry. No PII. */
    details?: Record<string, unknown>;
    /** Smartware-owned mutations already append the canonical entry. */
    append_ops_log?: boolean;
  },
  run: (commit_ts: string) => Promise<T>,
): Promise<T> {
  const payloadHash = hashPayload(ctx.payload);
  const check = checkOperation<T>(ctx.db, ctx.operation_id, payloadHash);

  if (check.kind === 'duplicate') {
    return check.cachedResult;
  }
  if (check.kind === 'conflict') {
    throw new ConflictError(ctx.operation_id, check.existing);
  }

  const commit_ts = nowIso();
  const value = await run(commit_ts);

  recordOperation(ctx.db, {
    operation_id: ctx.operation_id,
    actor_id: ctx.actor_id,
    op: ctx.op,
    payload_hash: payloadHash,
    result_json: JSON.stringify(value),
    commit_ts,
  });

  if (ctx.append_ops_log !== false) {
    // Ops-log entry LAST. Per vendor/smartware/docs/atomicity.md, presence of
    // this entry is the durable cross-artifact commit signal.
    appendOpLogEntry(ctx.opsDir, {
      operation_id: ctx.operation_id,
      actor_id: ctx.actor_id,
      timestamp: commit_ts,
      op: ctx.op,
      details: ctx.details,
    });
  }

  return value;
}

export class ConflictError extends Error {
  constructor(
    public readonly operation_id: string,
    public readonly existing: OperationsSeenRow,
  ) {
    super(`operation_id '${operation_id}' was previously seen with a different payload`);
    this.name = 'ConflictError';
  }
}
