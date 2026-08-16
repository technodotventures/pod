import type { Claim, ClaimTimeValue } from './types.js';
import type { ClaimStore } from './store.js';
export type ConflictType = 'corroboration' | 'semantic_conflict' | 'temporal_supersession' | 'no_conflict';
export interface ConflictResult {
    type: ConflictType;
    existingClaim?: Claim;
}
/**
 * Check a new (unsaved) claim against the existing claim store.
 * Returns the conflict type and the conflicting claim if any.
 */
export declare function detectConflict(newClaim: Claim, store: ClaimStore): ConflictResult;
/**
 * Apply semantic conflict: mark both claims as contested.
 */
export declare function applySemanticConflict(existingId: string, newId: string, store: ClaimStore): void;
/**
 * Apply temporal supersession: mark the older claim superseded.
 */
export declare function applyTemporalSupersession(oldClaimId: string, newClaimId: string, store: ClaimStore, invalidatedAt?: ClaimTimeValue): void;
//# sourceMappingURL=conflicts.d.ts.map