import type { ClaimStore } from './store.js';
import type { ClaimTimeValue } from './types.js';
/**
 * Add a new supporting observation ID to an existing claim.
 * Recomputes confidence after adding evidence.
 */
export declare function addCorroborationEvidence(existingClaimId: string, newObsId: string, store: ClaimStore): void;
/**
 * Remove a supporting observation ID from all claims that reference it.
 * After removal:
 * - If supporting_evidence is now empty AND source or extraction provenance depended on it → retract
 * - If supporting_evidence is non-empty → recalculate confidence only
 */
export declare function removeEvidenceFromClaims(removedObsId: string, store: ClaimStore, invalidatedAt?: ClaimTimeValue): string[];
//# sourceMappingURL=corroboration.d.ts.map