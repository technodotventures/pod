// Layer 1 — Claim Store Types
export const EPISTEMIC_RELATION_KINDS = new Set([
    'supports', 'contradicts', 'supersedes', 'corrects', 'invalidates', 'summarizes',
]);
export function isCanonicalRelationValid(kind, origin) {
    if (kind === 'references')
        return origin === 'deterministic' || origin === 'user';
    if (EPISTEMIC_RELATION_KINDS.has(kind))
        return origin === 'user';
    return false;
}
/**
 * Project the substrate's internal `status` enum onto the spec's binary
 * `state`. `retracted → forgotten`; everything else → active.
 */
export function statusToState(status) {
    return status === 'retracted' ? 'forgotten' : 'active';
}
/**
 * Map the substrate's `epistemic` label onto a spec-conformant epistemic_tag.
 * The substrate's `system_generated` etc. map to `inference`; `user_confirmed`
 * to `fact`. `stale` is preserved when status indicates staleness.
 */
export function epistemicToTag(epistemic, status) {
    if (status === 'stale')
        return 'stale';
    if (status === 'contested')
        return 'contested';
    if (epistemic === 'user_confirmed')
        return 'fact';
    if (epistemic === 'observed')
        return 'fact';
    if (epistemic === 'asserted')
        return 'opinion';
    return 'inference';
}
/** Project numeric confidence (0..1) onto a bucket. */
export function confidenceToBucket(value) {
    if (value >= 0.7)
        return 'high';
    if (value >= 0.4)
        return 'medium';
    return 'low';
}
export function knownTime(value) {
    return { value, state: 'known' };
}
export function inferredTime(value, basis) {
    return { value, state: 'inferred', basis };
}
export function nullTime() {
    return { value: null, state: 'null' };
}
export function compatibilityValidity(tValidFrom, tValidTo, tIngested) {
    return {
        from: tValidFrom.value ?? tIngested.value ?? '',
        to: tValidTo.value,
    };
}
// Standard predicate vocabulary
export const STANDARD_PREDICATES = new Set([
    'name_is', 'status_is', 'deadline_is', 'belongs_to', 'related_to',
    'created_by', 'decided_on', 'description_is', 'type_is', 'preference_is',
    'located_in', 'version_is', 'value_is', 'completed_at',
]);
// Entity types
export const ENTITY_TYPES = new Set([
    'person', 'agent', 'project', 'concept', 'decision', 'event',
    'tool', 'organisation', 'preference', 'manifest',
]);
/** Canonical claim key used for merge/corroboration checks */
export function canonicalKey(subjectId, predicate, scope, validityFrom) {
    return `${subjectId}|${predicate}|${scope}|${validityFrom}`;
}
/** Normalise a typed value for comparison */
export function normaliseValue(v) {
    if (v.type === 'text' && typeof v.value === 'string') {
        return v.value.trim().normalize('NFC');
    }
    if (v.type === 'enum' && typeof v.value === 'string') {
        return v.value.toLowerCase().replace(/[\s-]/g, '_');
    }
    return JSON.stringify(v.value);
}
//# sourceMappingURL=types.js.map