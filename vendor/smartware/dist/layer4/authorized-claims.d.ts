import type { SmartwareConfig } from '../config.js';
import type { Claim, EpistemicTag } from '../layer1/types.js';
import type { ClaimStore } from '../layer1/store.js';
export interface AuthorizedClaimPolicy {
    actorId: string;
    scope: string;
    minConfidence?: number;
    epistemic?: string[];
    epistemicTags?: EpistemicTag[];
    entityType?: string;
    includeSensitive?: boolean;
    includeStale?: boolean;
    includeSuperseded?: boolean;
    includeForgotten?: boolean;
}
export interface AuthorizedClaimSnapshot {
    authorized: boolean;
    claims: Claim[];
    claimsById: ReadonlyMap<string, Claim>;
    claimsBySubject: ReadonlyMap<string, Claim[]>;
    allClaimsBySubject: ReadonlyMap<string, Claim[]>;
    filteredClaims: number;
}
/**
 * Build the one authorized, lifecycle-aware claim snapshot used by every
 * retrieval channel. Ranking and result limits must only operate on this set.
 */
export declare function buildAuthorizedClaimSnapshot(policy: AuthorizedClaimPolicy, store: ClaimStore, config: SmartwareConfig): AuthorizedClaimSnapshot;
//# sourceMappingURL=authorized-claims.d.ts.map