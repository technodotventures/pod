import { createHash } from 'node:crypto';
export function computeFingerprint(content, scope, claimType) {
    const normalized = content.trim().normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
    const input = `${normalized}|${scope}|${claimType}`;
    const hash = createHash('sha256').update(input, 'utf-8').digest('hex').slice(0, 16);
    return `fp_${hash}`;
}
function stableJson(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value))
        return `[${value.map(stableJson).join(',')}]`;
    const entries = Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
}
/** Fingerprint a complete structured assertion, not only its object value. */
export function computeStructuredClaimFingerprint(subjectName, predicate, object, scope, claimType) {
    return computeFingerprint(stableJson({ subjectName, predicate, object }), scope, claimType);
}
//# sourceMappingURL=fingerprint.js.map