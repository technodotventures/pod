import { computeFingerprint } from './fingerprint.js';
/**
 * Backfill missing v1.6.16 fields on a legacy ClaimVersionRecord.
 *
 * Q8 migration rule: epistemic_owner defaults to author when absent.
 * Fingerprint is computed from content+scope+claim_type when absent.
 *
 * This is a read-time backfill — no JSONL rewrite needed. Legacy
 * records are upgraded in memory when loaded.
 */
export function backfillClaimVersion(raw) {
    const record = raw;
    if (!('epistemic_owner' in raw) || raw['epistemic_owner'] == null) {
        record.epistemic_owner =
            raw['author'] ?? 'agent';
    }
    if (!('fingerprint' in raw) || raw['fingerprint'] == null) {
        const content = raw['content'] ?? '';
        const scope = raw['scope'] ?? '';
        const claimType = raw['claim_type'] ?? 'finding';
        record.fingerprint =
            computeFingerprint(content, scope, claimType);
    }
    return record;
}
/**
 * Scan existing L1 JSONL for migration risks.
 *
 * Returns a report identifying:
 * - Records missing epistemic_owner or fingerprint (safe to backfill)
 * - User corrections (may not be replayable from L0 alone)
 * - Tombstones (contain snapshots that must be preserved)
 */
export function auditL1Migration(iterVersions) {
    let total = 0;
    let missingEO = 0;
    let missingFP = 0;
    let userCorrections = 0;
    let tombstones = 0;
    const risks = [];
    for (const raw of iterVersions()) {
        total++;
        if (!('epistemic_owner' in raw) || raw['epistemic_owner'] == null)
            missingEO++;
        if (!('fingerprint' in raw) || raw['fingerprint'] == null)
            missingFP++;
        const author = raw['author'];
        if (author === 'user') {
            userCorrections++;
            risks.push(`${raw['claim_id']}@${raw['version']}: author=user — content not replayable from L0`);
        }
        const state = raw['state'];
        if (state === 'forgotten') {
            tombstones++;
        }
    }
    return {
        total_versions: total,
        missing_epistemic_owner: missingEO,
        missing_fingerprint: missingFP,
        user_corrections: userCorrections,
        tombstones,
        non_replayable_risk: risks,
    };
}
//# sourceMappingURL=migration.js.map