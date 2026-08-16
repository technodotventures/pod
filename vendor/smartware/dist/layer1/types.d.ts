import type { TypedValue } from '../layer0/types.js';
export type EpistemicLabel = 'observed' | 'asserted' | 'inferred' | 'user_confirmed' | 'system_generated';
export type ClaimStatus = 'active' | 'superseded' | 'contested' | 'retracted' | 'stale';
export type ClaimTimeState = 'known' | 'inferred' | 'null';
/** Binary state per Protocol Contract v0.4.1. */
export type ClaimState = 'active' | 'forgotten';
/** What kind of assertion the claim is (Spec v1.5.4.2 §"Three orthogonal metadata dimensions"). */
export type ClaimType = 'decision' | 'constraint' | 'correction' | 'lesson' | 'preference' | 'hypothesis' | 'checkpoint' | 'handoff' | 'finding';
/** How the system uses the claim. */
export type ClaimRole = 'memory' | 'working' | 'summary' | 'checkpoint' | 'audit' | 'retrospective';
/** Authorship — governs mutability per Voice protection. */
export type ClaimAuthor = 'agent' | 'user';
/** Bucketed confidence per Spec v1.5.4.2; numeric scoring is post-beta. */
export type ConfidenceBucket = 'high' | 'medium' | 'low';
/** Spec-conformant epistemic tag (distinct from the substrate's internal EpistemicLabel). */
export type EpistemicTag = 'fact' | 'inference' | 'opinion' | 'stale' | 'contested';
/** Inter-claim relation kinds (Spec §"Typed claim relations"). */
export type RelationKind = 'supports' | 'contradicts' | 'supersedes' | 'corrects' | 'invalidates' | 'summarizes' | 'references';
interface ProvenanceBase {
    asserted_in_source_version: number;
    target_claim_version: number;
    observation_ids: string[];
    source_spans?: Array<{
        start: number;
        end: number;
        text?: string;
    }>;
}
export interface DeterministicProvenance extends ProvenanceBase {
    origin: 'deterministic';
    rule_id: string;
    model_id?: string;
}
export interface ModelProvenance extends ProvenanceBase {
    origin: 'model';
    model_id: string;
}
export interface ReviewedProvenance extends ProvenanceBase {
    origin: 'reviewed';
    reviewed_by: string;
    review_operation_id: string;
}
export interface UserReferenceProvenance {
    origin: 'user';
}
export interface UserEpistemicProvenance extends ProvenanceBase {
    origin: 'user';
}
export type RelationProvenance = DeterministicProvenance | ModelProvenance | ReviewedProvenance | UserReferenceProvenance | UserEpistemicProvenance;
export declare const EPISTEMIC_RELATION_KINDS: ReadonlySet<RelationKind>;
export declare function isCanonicalRelationValid(kind: RelationKind, origin: RelationProvenance['origin']): boolean;
/** A single typed temporal claim-to-claim edge (spec §6). */
export interface ClaimRelation {
    /** Stable edge identity. Server-stamped once at admission, immutable on carry-forward. */
    relation_id: string;
    kind: RelationKind;
    /** Target ClaimId. Observation provenance lives in `derived_from`. */
    target: string;
    /** When the relation became true. */
    valid_at: string;
    /** When it stopped being true. null = still valid. */
    invalid_at: string | null;
    /** Required on every canonical relation edge. */
    provenance: RelationProvenance;
}
/**
 * Project the substrate's internal `status` enum onto the spec's binary
 * `state`. `retracted → forgotten`; everything else → active.
 */
export declare function statusToState(status: ClaimStatus): ClaimState;
/**
 * Map the substrate's `epistemic` label onto a spec-conformant epistemic_tag.
 * The substrate's `system_generated` etc. map to `inference`; `user_confirmed`
 * to `fact`. `stale` is preserved when status indicates staleness.
 */
export declare function epistemicToTag(epistemic: EpistemicLabel, status: ClaimStatus): EpistemicTag;
/** Project numeric confidence (0..1) onto a bucket. */
export declare function confidenceToBucket(value: number): ConfidenceBucket;
export interface ClaimTimeValue {
    value: string | null;
    state: ClaimTimeState;
    basis?: string;
}
export interface Claim {
    id: string;
    subject_id: string;
    subject_name: string;
    predicate: string;
    object: TypedValue;
    scope: string;
    /** Compatibility view retained for existing query/conflict/search code. */
    validity: {
        from: string;
        to: string | null;
    };
    t_ingested: ClaimTimeValue;
    t_invalidated: ClaimTimeValue;
    t_valid_from: ClaimTimeValue;
    t_valid_to: ClaimTimeValue;
    source_event_id: string;
    extraction_event_id: string;
    supporting_evidence: string[];
    extraction: {
        method: 'deterministic' | 'llm' | 'user_input';
        model: string | null;
        compiler_version: string;
        prompt_hash: string | null;
        extracted_at: string;
    };
    status: ClaimStatus;
    epistemic: EpistemicLabel;
    confidence: number;
    sensitive: boolean;
    superseded_by: string | null;
    contested_by: string[];
    state?: ClaimState;
    author?: ClaimAuthor;
    epistemic_owner?: ClaimAuthor;
    claim_type?: ClaimType;
    claim_role?: ClaimRole;
    version_at?: string;
    created_at?: string;
    operation_id?: string | null;
    actor_id?: string | null;
    relations?: ClaimRelation[];
}
export interface Entity {
    id: string;
    canonical_name: string;
    aliases: string[];
    type: string;
    scope: string;
    created_at: string;
}
export declare function knownTime(value: string): ClaimTimeValue;
export declare function inferredTime(value: string, basis: string): ClaimTimeValue;
export declare function nullTime(): ClaimTimeValue;
export declare function compatibilityValidity(tValidFrom: ClaimTimeValue, tValidTo: ClaimTimeValue, tIngested: ClaimTimeValue): {
    from: string;
    to: string | null;
};
export declare const STANDARD_PREDICATES: Set<string>;
export declare const ENTITY_TYPES: Set<string>;
/** Canonical claim key used for merge/corroboration checks */
export declare function canonicalKey(subjectId: string, predicate: string, scope: string, validityFrom: string): string;
/** Normalise a typed value for comparison */
export declare function normaliseValue(v: TypedValue): string;
export {};
//# sourceMappingURL=types.d.ts.map