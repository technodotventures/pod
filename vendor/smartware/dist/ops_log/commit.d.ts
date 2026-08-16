import type { OpType } from './types.js';
export interface CommitContext {
    /** Pod-wide `pod_data/operations/` */
    opsDir: string;
}
export declare class IdempotencyConflictError extends Error {
    constructor(operationId: string);
}
export interface CommitDescriptor {
    operation_id: string;
    actor_id: string;
    op: OpType;
    /** Operation-specific details (no PII; use IDs not content). */
    details?: Record<string, unknown>;
}
/**
 * Result of a committed operation. Callers typically return this from their
 * verb handler.
 */
export interface CommitResult<T> {
    /** The single timestamp used across every artifact for this operation. */
    commit_ts: string;
    /** Result produced by the work closure. */
    value: T;
}
/**
 * Run a cross-artifact commit.
 *
 * `work` receives `commit_ts` and must use it for every artifact's
 * timestamp (L1 `version_at`, L2 page `updated`, `forgotten_at`, etc.).
 * On success, the ops-log entry is appended last and `result.commit_ts`
 * mirrors the value the work closure consumed.
 *
 * Throw from `work` to abort. The ops-log entry will NOT be written;
 * any partial L1/L2 state becomes an orphan visible to the recovery scan.
 */
export declare function runCommit<T>(ctx: CommitContext, descriptor: CommitDescriptor, work: (commit_ts: string) => Promise<T>): Promise<CommitResult<T>>;
export declare function runCommitSync<T>(ctx: CommitContext, descriptor: CommitDescriptor, work: (commit_ts: string) => T): CommitResult<T>;
//# sourceMappingURL=commit.d.ts.map