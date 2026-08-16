import type { ClaimType } from './types.js';
export declare function computeFingerprint(content: string, scope: string, claimType: ClaimType): string;
/** Fingerprint a complete structured assertion, not only its object value. */
export declare function computeStructuredClaimFingerprint(subjectName: string, predicate: string, object: {
    type: string;
    value: unknown;
}, scope: string, claimType: ClaimType): string;
//# sourceMappingURL=fingerprint.d.ts.map