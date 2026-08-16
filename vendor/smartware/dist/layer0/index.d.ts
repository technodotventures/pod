import Database from 'better-sqlite3';
import type { Observation, EffectiveStatus } from './types.js';
export declare class Layer0Index {
    private db;
    constructor(dbPath: string);
    /** Rebuild the entire derived index from JSONL files */
    rebuildIndex(evidenceDir: string): void;
    /** Replay only new events since last known sequence */
    catchUp(evidenceDir: string): void;
    insertOrSkip(obs: Observation): void;
    /** Apply a mutation event (tombstone / redaction / quarantine_review) */
    applyMutationEvent(event: Observation): void;
    /** Check dedup: return existing obs ID if source_id already seen for this app */
    checkDedup(app: string, sourceId: string): string | null;
    checkIdempotency(actorId: string, key: string): {
        id: string;
        payload_hash: string;
    } | null;
    /** Get effective state of an observation */
    getEffectiveStatus(obsId: string): EffectiveStatus | null;
    getLastSequence(): number;
    getLatestHashForWriter(writerId: string): string | null;
    countByStatus(): Record<string, number>;
    getByScope(scope: string): Array<{
        id: string;
        type: string;
        captured_at: string;
        observed_at: string;
    }>;
    totalCount(): number;
    close(): void;
    getDB(): Database.Database;
}
//# sourceMappingURL=index.d.ts.map