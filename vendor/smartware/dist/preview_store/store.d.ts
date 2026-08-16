export declare const PREVIEW_ID_PATTERN: RegExp;
export declare const DEFAULT_TTL_SECONDS = 300;
export interface CascadePreviewPayload {
    /** PageId being endorsed. */
    page_id: string;
    /** Snapshot of the page's `sources` (contained ClaimIds) at preview time. */
    sources_snapshot: string[];
    /** Subset of sources_snapshot also cited by other pages — drives confirmation modal. */
    shared_claims_snapshot: string[];
    /** Optional bookkeeping: actor that requested the preview. */
    actor_id?: string;
    /** Optional bookkeeping: reason supplied with the dry-run. */
    reason?: string;
}
export type PreviewLookup = {
    kind: 'hit';
    payload: CascadePreviewPayload;
    created_at: string;
} | {
    kind: 'not_found';
} | {
    kind: 'expired';
    created_at: string;
    expired_at: string;
} | {
    kind: 'consumed';
    consumed_at: string;
};
export declare class CascadePreviewStore {
    private db;
    private readonly ttlSeconds;
    constructor(dbPath: string, ttlSeconds?: number);
    /** Generate a new spec-shaped preview id. */
    static newPreviewId(): string;
    /** Persist a fresh preview and return its id. */
    put(payload: CascadePreviewPayload): string;
    /**
     * Look up a preview id, returning a discriminated union the caller maps to
     * the appropriate spec error code:
     *   hit       → use the payload
     *   not_found → preview_not_found
     *   expired   → preview_expired (existed but past TTL)
     *   consumed  → preview_not_found (consumed by a prior successful commit)
     */
    lookup(previewId: string): PreviewLookup;
    /**
     * Mark a preview as consumed. Idempotent — re-consuming returns false.
     * Returns true if the preview was active and is now consumed; false if it
     * didn't exist, was already consumed, or was expired.
     */
    consume(previewId: string): boolean;
    /**
     * Delete expired (and consumed) previews. Safe to run on a timer. Returns
     * the count of rows removed.
     */
    gc(): number;
    close(): void;
}
export declare function isValidCascadePreviewId(value: string): boolean;
//# sourceMappingURL=store.d.ts.map