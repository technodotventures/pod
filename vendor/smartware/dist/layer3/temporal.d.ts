export type TemporalAxis = 'valid_time' | 'transaction_time';
export type TemporalRangeRelation = 'overlaps' | 'starts_in';
export interface TemporalInterval {
    from: string | null;
    to: string | null;
}
export interface TemporalDocument {
    valid_time: TemporalInterval;
    transaction_time: TemporalInterval;
}
export type TemporalConstraint = {
    mode: 'current';
    axis: TemporalAxis;
    /** Defaults to the current clock time when omitted. */
    at?: string;
} | {
    mode: 'as_of';
    axis: TemporalAxis;
    at: string;
} | {
    mode: 'range';
    axis: TemporalAxis;
    from: string;
    to: string;
    /** Defaults to interval overlap for backward compatibility. */
    relation?: TemporalRangeRelation;
};
/**
 * Match a document against an explicit bi-temporal constraint.
 *
 * Intervals are half-open: [from, to). Valid time answers when the claim was
 * true in the represented world; transaction time answers when Smartware knew
 * it. The caller remains responsible for supplying policy-eligible documents.
 */
export declare function matchesTemporalConstraint(document: TemporalDocument, constraint: TemporalConstraint): boolean;
//# sourceMappingURL=temporal.d.ts.map