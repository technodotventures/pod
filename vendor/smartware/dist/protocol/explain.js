// Protocol — EXPLAIN handler (provenance tracing)
//
// Given a claim ID or entity ID, traces the full provenance chain:
//   claim → extraction event (L0) → source observation (L0) → actor, content
// For entities: shows all active claims, merge history, and source observations.
import { readAll } from '../layer0/log.js';
import { requireGrant, ProtocolError } from '../auth/middleware.js';
import { isOwner } from '../auth/grants.js';
import { readLatestVersion } from '../layer1/jsonl.js';
export async function handleExplain(params, evidenceDir, layer0, store, config, dataDir) {
    if (!params.claim_id && !params.entity_id) {
        throw new ProtocolError('invalid_params', 'Either claim_id or entity_id is required');
    }
    // Build observation lookup (lazy — only if we need it)
    let obsIndex = null;
    function getObsIndex() {
        if (!obsIndex) {
            obsIndex = new Map();
            for (const obs of readAll(evidenceDir)) {
                obsIndex.set(obs.id, obs);
            }
        }
        return obsIndex;
    }
    if (params.claim_id) {
        // ── Explain a single claim ──────────────────────────────────────────
        const claim = store.getClaim(params.claim_id);
        if (!claim) {
            throw new ProtocolError('claim_not_found', `Claim '${params.claim_id}' not found`);
        }
        requireGrant(params.actor.id, 'read', claim.scope, config);
        // Sensitive claims expose raw values + source-observation content previews;
        // owner-only, like query/read.
        if (claim.sensitive && !isOwner(params.actor.id, config)) {
            throw new ProtocolError('sensitive', 'This claim is sensitive. Access requires owner privileges.');
        }
        const idx = getObsIndex();
        const provenance = buildClaimProvenance(claim, idx, layer0, dataDir);
        return { type: 'claim', claim: provenance };
    }
    // ── Explain an entity ────────────────────────────────────────────────
    const entity = store.getEntity(params.entity_id);
    if (!entity) {
        throw new ProtocolError('entity_not_found', `Entity '${params.entity_id}' not found`);
    }
    requireGrant(params.actor.id, 'read', entity.scope, config);
    const allClaims = store.getClaimsBySubject(entity.id);
    // If any claim on this entity is sensitive, the entity (and its raw source
    // observations) are owner-only — mirror the query scope-browse gate.
    if (allClaims.some(c => c.sensitive) && !isOwner(params.actor.id, config)) {
        throw new ProtocolError('sensitive', 'This entity has sensitive claims. Access requires owner privileges.');
    }
    const activeClaims = allClaims.filter(c => c.status === 'active' || c.status === 'stale');
    const idx = getObsIndex();
    const claimProvenances = activeClaims.map(c => buildClaimProvenance(c, idx, layer0, dataDir));
    const sourceObsIds = new Set();
    for (const cp of claimProvenances) {
        for (const obsId of cp.derived_from)
            sourceObsIds.add(obsId);
        if (cp.source_observation)
            sourceObsIds.add(cp.source_observation.id);
    }
    for (const c of allClaims) {
        if (c.source_event_id)
            sourceObsIds.add(c.source_event_id);
        for (const eid of c.supporting_evidence)
            sourceObsIds.add(eid);
    }
    const sourceObs = [];
    for (const obsId of sourceObsIds) {
        const obs = idx.get(obsId);
        if (obs) {
            sourceObs.push(summariseObs(obs, layer0));
        }
    }
    sourceObs.sort((a, b) => a.observed_at.localeCompare(b.observed_at));
    return {
        type: 'entity',
        entity: {
            entity: {
                id: entity.id,
                canonical_name: entity.canonical_name,
                type: entity.type,
                scope: entity.scope,
                aliases: entity.aliases,
                created_at: entity.created_at,
            },
            claims: claimProvenances,
            source_observations: sourceObs,
            total_claims: allClaims.length,
            active_claims: activeClaims.length,
        },
    };
}
function buildClaimProvenance(claim, obsIndex, layer0, dataDir) {
    const sourceObs = claim.source_event_id ? obsIndex.get(claim.source_event_id) : undefined;
    const extractionObs = claim.extraction_event_id ? obsIndex.get(claim.extraction_event_id) : undefined;
    let derivedFrom = claim.supporting_evidence;
    const derivedObservations = [];
    if (dataDir) {
        const jsonlVersion = readLatestVersion(dataDir, claim.id);
        if (jsonlVersion) {
            derivedFrom = jsonlVersion.derived_from;
            for (const obsId of jsonlVersion.derived_from) {
                const obs = obsIndex.get(obsId);
                if (obs)
                    derivedObservations.push(summariseObs(obs, layer0));
            }
        }
    }
    if (derivedObservations.length === 0 && sourceObs) {
        derivedObservations.push(summariseObs(sourceObs, layer0));
    }
    return {
        claim_id: claim.id,
        subject: { id: claim.subject_id, name: claim.subject_name },
        predicate: claim.predicate,
        object: claim.object,
        scope: claim.scope,
        status: claim.status,
        epistemic: claim.epistemic,
        confidence: claim.confidence,
        validity: claim.validity,
        extraction: {
            method: claim.extraction.method,
            model: claim.extraction.model,
            extracted_at: claim.extraction.extracted_at,
        },
        source_observation: sourceObs ? summariseObs(sourceObs, layer0) : (derivedObservations[0] ?? null),
        extraction_event: extractionObs ? summariseObs(extractionObs, layer0) : null,
        derived_from: derivedFrom,
        derived_observations: derivedObservations,
        superseded_by: claim.superseded_by,
        contested_by: claim.contested_by,
        supporting_evidence: claim.supporting_evidence,
        author: claim.author,
        epistemic_owner: claim.epistemic_owner,
        fingerprint: claim.fingerprint,
    };
}
function summariseObs(obs, layer0) {
    const effectiveStatus = layer0.getEffectiveStatus(obs.id) ?? obs.status;
    // Content preview: truncate to keep response manageable
    let preview;
    if (typeof obs.content.body === 'string') {
        preview = obs.content.body.length > 200
            ? obs.content.body.slice(0, 200) + '…'
            : obs.content.body;
    }
    else {
        const json = JSON.stringify(obs.content.body);
        preview = json.length > 200 ? json.slice(0, 200) + '…' : json;
    }
    return {
        id: obs.id,
        type: obs.type,
        status: effectiveStatus,
        actor: obs.source.actor,
        app: obs.source.app,
        captured_at: obs.source.captured_at,
        observed_at: obs.source.observed_at,
        scope: obs.scope,
        content_preview: preview,
    };
}
//# sourceMappingURL=explain.js.map