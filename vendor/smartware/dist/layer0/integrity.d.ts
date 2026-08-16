import type { Observation } from './types.js';
/**
 * Compute SHA-256 of the observation, covering everything EXCEPT the hash itself
 * (which would be circular) — including the chain-linking integrity fields
 * previous_hash, sequence, and writer_id. If those were excluded, the link is
 * unauthenticated: an attacker could delete a record and rewrite the next
 * record's previous_hash to point past it, and no hash would change, so
 * verifyChain would still pass. Binding previous_hash into the hash makes
 * tampering require re-hashing every subsequent record.
 */
export declare function computeHash(obs: Observation): string;
/**
 * Assign the integrity block to an observation.
 */
export declare function assignIntegrity(obs: Omit<Observation, 'integrity'>, writerId: string, sequence: number, previousHash: string | null): Observation;
/**
 * Verify the per-writer hash chain for a sequence of observations.
 * Returns { valid, brokenAt } where brokenAt is the 0-based index of the first broken link.
 */
export declare function verifyChain(observations: Observation[]): {
    valid: boolean;
    brokenAt?: number;
};
//# sourceMappingURL=integrity.d.ts.map