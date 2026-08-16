export interface RecoveryReport {
    committedOperations: number;
    orphans: OrphanArtifact[];
    /** Operations that have intent but no canonical artifact yet. */
    pendingOperations: string[];
    /** Malformed intent records that cannot be interpreted automatically. */
    intentErrors: string[];
    /** OperationIds that cannot be completed or quarantined deterministically. */
    requiresManualReview: string[];
    /** Exact intent-backed operations finalized during this scan. */
    completed: string[];
    /** Reserved until an append-only quarantine transition is specified. */
    quarantined: string[];
    /** Prepared internal REFLECT claims with no artifact; safe to recompute. */
    aborted: string[];
}
export interface OrphanArtifact {
    surface: 'l0' | 'l1' | 'l2' | 'tombstone';
    locator: string;
    operation_id: string | null;
}
export interface RecoveryContext {
    opsDir: string;
    evidenceDir: string;
    /** Smartware data directory containing claims/. */
    claimsDir?: string;
    wikiDir?: string;
    /** Reserved for future intent-backed quarantine. */
    quarantineDir: string;
}
export declare function runRecovery(ctx: RecoveryContext): RecoveryReport;
/**
 * Legacy compatibility helper. Without a matching OBSERVE intent, the only
 * safe automatic classification remains quarantine; runRecovery does not yet
 * apply that disposition to append-only surfaces.
 */
export declare function classifyOrphan(_orphan: OrphanArtifact): 'completable' | 'quarantine';
//# sourceMappingURL=recovery.d.ts.map