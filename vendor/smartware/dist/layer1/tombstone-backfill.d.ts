import type { ClaimStore } from './store.js';
export interface TombstoneBackfillReport {
    retracted_found: number;
    tombstones_written: number;
    tombstones_skipped_existing: number;
}
export declare function backfillTombstones(store: ClaimStore, wikiDir: string): TombstoneBackfillReport;
//# sourceMappingURL=tombstone-backfill.d.ts.map