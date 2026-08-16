import type { Claim } from './types.js';
/** Compute the full six-factor confidence score */
export declare function computeConfidence(claim: Claim): number;
/** Determine if a claim is stale based on confidence and threshold */
export declare function isStale(claim: Claim, threshold?: number): boolean;
//# sourceMappingURL=confidence.d.ts.map