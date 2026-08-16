import type { Layer0Index } from './index.js';
export type IdempotencyResult = {
    kind: 'none';
} | {
    kind: 'duplicate';
    existingId: string;
} | {
    kind: 'conflict';
    existingId: string;
};
export declare function computePayloadHash(payload: unknown): string;
export declare function checkIdempotency(index: Layer0Index, actorId: string, key: string | undefined, payloadHash: string): IdempotencyResult;
export declare function checkLegacySourceDedup(index: Layer0Index, app: string, sourceId: string | null): {
    isDuplicate: boolean;
    existingId?: string;
};
//# sourceMappingURL=idempotency.d.ts.map