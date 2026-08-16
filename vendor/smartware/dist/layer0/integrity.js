// Layer 0 — Hash Chain Integrity
import { createHash } from 'node:crypto';
/**
 * Compute SHA-256 of the observation, covering everything EXCEPT the hash itself
 * (which would be circular) — including the chain-linking integrity fields
 * previous_hash, sequence, and writer_id. If those were excluded, the link is
 * unauthenticated: an attacker could delete a record and rewrite the next
 * record's previous_hash to point past it, and no hash would change, so
 * verifyChain would still pass. Binding previous_hash into the hash makes
 * tampering require re-hashing every subsequent record.
 */
export function computeHash(obs) {
    const { integrity, ...rest } = obs;
    const { hash: _hash, ...link } = integrity;
    const canonical = stableStringify({ ...rest, integrity: link });
    return 'sha256:' + createHash('sha256').update(canonical).digest('hex');
}
/** Recursively serialize an object with sorted keys for deterministic hashing.
 * Mirrors JSON.stringify semantics: undefined values are omitted from objects
 * and rendered as null inside arrays.
 */
function stableStringify(val) {
    if (val === undefined)
        return 'null'; // only used for array elements
    if (val === null || typeof val !== 'object')
        return JSON.stringify(val);
    if (Array.isArray(val))
        return '[' + val.map(stableStringify).join(',') + ']';
    const obj = val;
    const sorted = Object.keys(obj).sort().filter(k => obj[k] !== undefined);
    const pairs = sorted.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k]));
    return '{' + pairs.join(',') + '}';
}
/**
 * Assign the integrity block to an observation.
 */
export function assignIntegrity(obs, writerId, sequence, previousHash) {
    const withPlaceholder = { ...obs, integrity: { hash: '', writer_id: writerId, sequence, previous_hash: previousHash } };
    const hash = computeHash(withPlaceholder);
    withPlaceholder.integrity.hash = hash;
    return withPlaceholder;
}
/**
 * Verify the per-writer hash chain for a sequence of observations.
 * Returns { valid, brokenAt } where brokenAt is the 0-based index of the first broken link.
 */
export function verifyChain(observations) {
    for (let i = 0; i < observations.length; i++) {
        const obs = observations[i];
        // Verify this observation's hash matches recomputed hash
        const recomputed = computeHash(obs);
        if (recomputed !== obs.integrity.hash) {
            return { valid: false, brokenAt: i };
        }
        // Verify previous_hash links
        if (i > 0) {
            const prev = observations[i - 1];
            if (obs.integrity.previous_hash !== prev.integrity.hash) {
                return { valid: false, brokenAt: i };
            }
        }
        else {
            if (obs.integrity.previous_hash !== null) {
                return { valid: false, brokenAt: i };
            }
        }
    }
    return { valid: true };
}
//# sourceMappingURL=integrity.js.map