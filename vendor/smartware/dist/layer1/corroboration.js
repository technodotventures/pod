// Layer 1 — Supporting evidence management for corroboration
import { computeConfidence } from './confidence.js';
/**
 * Add a new supporting observation ID to an existing claim.
 * Recomputes confidence after adding evidence.
 */
export function addCorroborationEvidence(existingClaimId, newObsId, store) {
    const existing = store.getClaim(existingClaimId);
    if (!existing)
        return;
    const updated = [...new Set([...existing.supporting_evidence, newObsId])];
    store.updateClaimSupportingEvidence(existingClaimId, updated);
    const refreshed = store.getClaim(existingClaimId);
    if (refreshed) {
        store.updateClaimConfidence(existingClaimId, computeConfidence(refreshed));
    }
}
/**
 * Remove a supporting observation ID from all claims that reference it.
 * After removal:
 * - If supporting_evidence is now empty AND source or extraction provenance depended on it → retract
 * - If supporting_evidence is non-empty → recalculate confidence only
 */
export function removeEvidenceFromClaims(removedObsId, store, invalidatedAt) {
    const retracted = [];
    const allClaims = store.getActiveClaims();
    for (const claim of allClaims) {
        if (!claim.supporting_evidence.includes(removedObsId)
            && claim.source_event_id !== removedObsId
            && claim.extraction_event_id !== removedObsId) {
            continue;
        }
        const remaining = claim.supporting_evidence.filter(id => id !== removedObsId);
        store.updateClaimSupportingEvidence(claim.id, remaining);
        if (remaining.length === 0) {
            store.updateClaimStatus(claim.id, 'retracted', undefined, invalidatedAt);
            retracted.push(claim.id);
            continue;
        }
        const refreshed = store.getClaim(claim.id);
        if (refreshed) {
            store.updateClaimConfidence(claim.id, computeConfidence(refreshed));
        }
    }
    return retracted;
}
//# sourceMappingURL=corroboration.js.map