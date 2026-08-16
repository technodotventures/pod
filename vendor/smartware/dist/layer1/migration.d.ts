import type { ClaimVersionRecord } from './jsonl.js';
/**
 * Backfill missing v1.6.16 fields on a legacy ClaimVersionRecord.
 *
 * Q8 migration rule: epistemic_owner defaults to author when absent.
 * Fingerprint is computed from content+scope+claim_type when absent.
 *
 * This is a read-time backfill — no JSONL rewrite needed. Legacy
 * records are upgraded in memory when loaded.
 */
export declare function backfillClaimVersion(raw: Record<string, unknown>): ClaimVersionRecord;
export interface MigrationAuditResult {
    total_versions: number;
    missing_epistemic_owner: number;
    missing_fingerprint: number;
    user_corrections: number;
    tombstones: number;
    non_replayable_risk: string[];
}
/**
 * Scan existing L1 JSONL for migration risks.
 *
 * Returns a report identifying:
 * - Records missing epistemic_owner or fingerprint (safe to backfill)
 * - User corrections (may not be replayable from L0 alone)
 * - Tombstones (contain snapshots that must be preserved)
 */
export declare function auditL1Migration(iterVersions: () => Generator<Record<string, unknown>>): MigrationAuditResult;
//# sourceMappingURL=migration.d.ts.map