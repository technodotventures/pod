import Database from 'better-sqlite3';
import type { Claim, ClaimRelation, ClaimStatus, ClaimTimeValue, Entity, RelationKind } from './types.js';
import { type ClaimVersionRecord } from './jsonl.js';
export declare class ClaimStore {
    private db;
    /** Pod data directory — set after construction by SmartwareCore. Used
     *  for the L1 JSONL canonical surface (PR-14). When null, JSONL writes
     *  are skipped (test/legacy paths). */
    private dataDir;
    constructor(dbPath: string);
    /** Set after construction. SmartwareCore.open() wires this. */
    setDataDir(dataDir: string): void;
    getDataDir(): string | null;
    /** Append a claim version record to the L1 JSONL canonical surface. */
    appendVersionRecord(record: ClaimVersionRecord): void;
    /** Compute the next version number for a claim_id (1 if no history). */
    nextVersionFor(claimId: string): number;
    private migrateSchema;
    insertEntity(entity: Entity): void;
    getEntity(id: string): Entity | undefined;
    findEntityByName(name: string, scope?: string): Entity | undefined;
    getAllEntities(scope?: string): Entity[];
    updateEntityType(id: string, type: string): void;
    private rowToEntity;
    insertClaim(claim: Claim): void;
    /**
     * Replace adjacency rows for a single claim with the supplied relations.
     * Always invoked from insertClaim; safe to call standalone.
     */
    refreshAdjacency(claimId: string, relations: ClaimRelation[]): void;
    /** Outbound: source has relation `kind` to target. */
    getOutboundRelations(claimId: string, kind?: RelationKind): ClaimRelation[];
    /** Inbound: who has a relation pointing at this claim? */
    getInboundRelations(targetId: string, kind?: RelationKind): Array<ClaimRelation & {
        source: string;
    }>;
    getClaim(id: string): Claim | undefined;
    findByCanonicalKey(subjectId: string, predicate: string, scope: string, validityFrom: string): Claim | undefined;
    getClaimsBySubject(subjectId: string, status?: ClaimStatus): Claim[];
    getActiveClaims(scope?: string): Claim[];
    getAllClaims(scope?: string): Claim[];
    syncFromJsonlVersion(v: import('./jsonl.js').ClaimVersionRecord, entityHint?: {
        name: string;
        type: string;
        predicate?: string;
        sensitive?: boolean;
    }): void;
    updateClaimStatus(id: string, status: ClaimStatus, supersededBy?: string, invalidatedAt?: ClaimTimeValue): void;
    updateClaimSupportingEvidence(id: string, evidence: string[]): void;
    updateClaimConfidence(id: string, confidence: number): void;
    markContested(id1: string, id2: string): void;
    redactClaim(id: string): void;
    deleteAllClaims(): void;
    setLastReplayedSequence(seq: number): void;
    getLastReplayedSequence(): number;
    claimCount(): number;
    entityCount(): number;
    private rowToClaim;
    close(): void;
    getDB(): Database.Database;
}
//# sourceMappingURL=store.d.ts.map