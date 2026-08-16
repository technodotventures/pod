// Layer 0 — Idempotency helpers
import { createHash } from 'node:crypto';
function stableValue(value) {
    if (Array.isArray(value)) {
        return value.map(stableValue);
    }
    if (value && typeof value === 'object') {
        const entries = Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, nested]) => [key, stableValue(nested)]);
        return Object.fromEntries(entries);
    }
    return value;
}
export function computePayloadHash(payload) {
    const stable = stableValue(payload);
    return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}
export function checkIdempotency(index, actorId, key, payloadHash) {
    if (!key)
        return { kind: 'none' };
    const existing = index.checkIdempotency(actorId, key);
    if (!existing)
        return { kind: 'none' };
    if (existing.payload_hash === payloadHash) {
        return { kind: 'duplicate', existingId: existing.id };
    }
    return { kind: 'conflict', existingId: existing.id };
}
export function checkLegacySourceDedup(index, app, sourceId) {
    if (!sourceId)
        return { isDuplicate: false };
    const existingId = index.checkDedup(app, sourceId);
    if (existingId)
        return { isDuplicate: true, existingId };
    return { isDuplicate: false };
}
//# sourceMappingURL=idempotency.js.map