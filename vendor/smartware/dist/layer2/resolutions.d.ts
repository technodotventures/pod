import type { Claim } from '../layer1/types.js';
import type { Entity } from '../layer1/types.js';
export type Resolution = 'oneliner' | 'paragraph' | 'full';
/**
 * Format a claim object value as a human-readable string.
 */
export declare function formatClaimValue(claim: Claim): string;
/**
 * Produce a one-liner summary for an entity from its active claims.
 */
export declare function buildOneliner(entity: Entity, claims: Claim[]): string;
/**
 * Produce a paragraph summary (2-4 sentences) from active claims.
 */
export declare function buildParagraph(entity: Entity, claims: Claim[]): string;
/**
 * Produce a full markdown page from entity + claims (for when LLM is unavailable).
 */
export declare function buildFullPage(entity: Entity, claims: Claim[]): string;
//# sourceMappingURL=resolutions.d.ts.map