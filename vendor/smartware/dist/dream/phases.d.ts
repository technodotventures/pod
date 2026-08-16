import type { CommitContext } from '../ops_log/commit.js';
import type { OpType } from '../ops_log/types.js';
export type DreamPhaseOutcome = 'clean' | 'findings' | 'error' | 'skipped';
export interface DreamPhaseResult {
    phase: string;
    op: OpType;
    operation_id: string;
    started_at: string;
    ended_at: string;
    outcome: DreamPhaseOutcome;
    canonical_writes: string[];
    derived_writes: string[];
    errors: string[];
}
export interface DreamResult {
    run_id: string;
    phases: DreamPhaseResult[];
    scope: string;
    started_at: string;
    ended_at: string;
    report_path?: string;
}
export interface DreamOptions {
    evidenceDir?: string;
    /** Smartware data directory containing claims/. */
    claimsDir?: string;
    wikiDir?: string;
    quarantineDir?: string;
    /** Derived report directory. No canonical memory is written here. */
    reportDir?: string;
    /** Explicit opt-in for operator-controlled L2 recompilation. Off by default. */
    recompile?: () => void;
}
/**
 * Run the default operator Dream phases once.
 *
 * This function does not schedule itself. Without an explicit `recompile`
 * callback it writes no canonical L0/L1/L2 data; it records phase outcomes in
 * the operations log and optionally persists a discardable derived report.
 */
export declare function runDefaultDream(ctx: CommitContext, podActorId: string, scope: string, options?: DreamOptions): DreamResult;
//# sourceMappingURL=phases.d.ts.map