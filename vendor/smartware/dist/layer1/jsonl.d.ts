import type { ClaimAuthor, ClaimTimeValue, ClaimRelation, ClaimRole, ClaimType, ConfidenceBucket, EpistemicLabel, EpistemicTag } from './types.js';
import type { TypedValue } from '../layer0/types.js';
/**
 * Structured meaning produced by extraction.
 *
 * This is intentionally separate from the admitted epistemic fields on the
 * claim version. reflect.auto may retain a high-quality deterministic parse
 * while still bounding the autonomous claim to low-confidence inference.
 */
export interface ClaimSemanticMaterialization {
    subject_name: string;
    subject_type: string;
    predicate: string;
    object: TypedValue;
    t_valid_from: ClaimTimeValue;
    t_valid_to: ClaimTimeValue;
    extracted_epistemic: EpistemicLabel;
    extracted_confidence: number;
    sensitive: boolean;
    extraction: {
        method: 'deterministic' | 'llm' | 'user_input';
        model: string | null;
        compiler_version: string;
        prompt_hash: string | null;
        extracted_at: string;
    };
}
/** Fields shared by both active and forgotten claim versions. */
interface ClaimVersionBase {
    claim_id: string;
    version: number;
    claim_type: ClaimType;
    claim_role: ClaimRole;
    author: ClaimAuthor;
    /** Epistemic + lifecycle protection. Defaults to author; flips to 'user' on adjudication. */
    epistemic_owner: ClaimAuthor;
    /** Deterministic claim identity: hash(normalized_content + scope + claim_type). */
    fingerprint: string;
    confidence: ConfidenceBucket;
    epistemic_tag: EpistemicTag;
    scope: string;
    derived_from: string[];
    relations: ClaimRelation[];
    created_at: string;
    version_at: string;
    operation_id: string;
    actor_id: string;
    tags: string[];
    /** Required when version > 1. */
    supersedes?: number;
    /** Set on endorsement-cascade-produced versions. */
    endorsement_source?: string;
    /** Set on revival-produced versions. */
    revived_via?: string;
}
/** Active claim version: content is required. */
export interface ActiveClaimVersion extends ClaimVersionBase {
    state: 'active';
    content: string;
    /** Optional for backwards compatibility with pre-v0.6 materializations. */
    semantic?: ClaimSemanticMaterialization;
}
/** Forgotten claim version: content is omitted (lives in tombstone snapshot). */
export interface ForgottenClaimVersion extends ClaimVersionBase {
    state: 'forgotten';
    tombstone_id: string;
    forgotten_at: string;
    forgotten_by: string;
}
/** One line in the L1 JSONL canonical surface. */
export type ClaimVersionRecord = ActiveClaimVersion | ForgottenClaimVersion;
export declare function claimsJsonlPath(dataDir: string, commit_ts: string): string;
/**
 * Append one ClaimVersionRecord to the canonical L1 JSONL surface. Caller
 * is responsible for stamping `version_at`/`operation_id`/`actor_id` per
 * the A0 single-commit-timestamp pattern.
 */
export declare function appendClaimVersion(dataDir: string, record: ClaimVersionRecord): void;
/** Append claim versions with one filesystem append per monthly file. */
export declare function appendClaimVersions(dataDir: string, records: ClaimVersionRecord[]): void;
/** Iterate every claim version on disk in chronological order. */
export declare function iterAllClaimVersions(dataDir: string): Generator<ClaimVersionRecord>;
/** All versions for a given claim_id in version order. */
export declare function readClaimHistory(dataDir: string, claimId: string): ClaimVersionRecord[];
/** Latest version of a claim_id, or null if none exists. */
export declare function readLatestVersion(dataDir: string, claimId: string): ClaimVersionRecord | null;
/** Next version number for a claim_id (1 if no history). */
export declare function nextVersion(dataDir: string, claimId: string): number;
/**
 * Reconstruct a claim's full snapshot at v(N) — used by tombstone repair
 * and as-of queries (post-beta). Walks the version chain forward and
 * returns the state at the requested version, or the latest if version
 * is omitted.
 */
export declare function snapshotAt(dataDir: string, claimId: string, version?: number): ClaimVersionRecord | null;
export {};
//# sourceMappingURL=jsonl.d.ts.map