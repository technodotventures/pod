import { type Grant, type ScopeEntry, type SmartwareConfig } from './config.js';
import { CascadePreviewStore } from './preview_store/index.js';
import { type EmbeddingAdapter, type SemanticDocument } from './layer3/semantic.js';
import type { TemporalConstraint } from './layer3/temporal.js';
import { type PersistedSemanticSyncResult, type SemanticRecordLoadStatus, type SemanticRecordStore } from './layer3/semantic-store.js';
import { type HybridMatch, type SemanticChannelStatus } from './layer3/hybrid.js';
import { ScopeRegistry } from './scopes/registry.js';
import type { Actor } from './layer0/types.js';
import type { ClaimRelation, EpistemicTag } from './layer1/types.js';
import { type DreamResult } from './dream/phases.js';
import { type ObserveParams, type ObserveResult } from './protocol/observe.js';
import { type QueryParams, type QueryResult } from './protocol/query.js';
import { type CompileParams, type CompileHandlerResult } from './protocol/compile.js';
import { type ReadParams, type ReadResult, type ScopeBrowseResult } from './protocol/read.js';
import { type ExplainParams, type ExplainResult } from './protocol/explain.js';
import { type CorrectParams, type CorrectResult } from './protocol/correct.js';
import { type ReviseParams, type ReviseResult } from './protocol/revise.js';
import { type ForgetParams, type ForgetResult, type ReviveParams, type ReviveResult } from './protocol/forget.js';
import { type EndorseParams, type EndorseResult } from './protocol/endorse.js';
import { type QuarantineReviewParams, type QuarantineReviewResult } from './protocol/quarantine_review.js';
import { type GrantParams, type GrantResult } from './protocol/grant.js';
import { type RevokeParams, type RevokeResult } from './protocol/revoke.js';
import { type SessionStartParams, type SessionStartResult, type SessionDescribeResult, type SessionEndResult } from './protocol/session.js';
import { type StatusResult } from './protocol/status.js';
import { type ContextParams, type ContextBundle } from './protocol/context.js';
export interface SmartwareCoreOptions {
    dataDir: string;
    ownerId?: string;
}
export interface SmartwareDreamParams {
    actor: Actor;
    scope: string;
}
export interface SmartwareSemanticDocumentsParams {
    actor: Actor;
    /** Server-anchored identity overrides actor.id when supplied. */
    session_id?: string;
    scope: string;
    min_confidence?: number;
    epistemic?: string[];
    epistemic_tags?: EpistemicTag[];
    entity_type?: string;
    include_sensitive?: boolean;
    include_stale?: boolean;
}
export interface SmartwareSemanticIndexOptions {
    adapter: EmbeddingAdapter;
    store: SemanticRecordStore;
    batch_size?: number;
    max_documents?: number;
    timeout_ms?: number;
}
export interface SmartwareHybridRecallOptions {
    adapter: EmbeddingAdapter | null;
    store: SemanticRecordStore | null;
    min_similarity: number;
    limit?: number;
    candidate_limit?: number;
    rrf_k?: number;
    lexical_weight?: number;
    semantic_weight?: number;
    semantic_timeout_ms?: number;
    temporal?: TemporalConstraint;
}
export interface SmartwareHybridRecallMatch extends HybridMatch {
    claim_id: string;
    entity_id: string;
    entity_name: string;
    predicate: string;
    object: unknown;
    epistemic: string;
    confidence: number;
    status: string;
    observation_ids: string[];
}
export interface SmartwareHybridRecallResult {
    canonical: QueryResult;
    hybrid_results: SmartwareHybridRecallMatch[];
    selected_channel: 'canonical' | 'hybrid';
    semantic_status: SemanticChannelStatus;
    semantic_index_status: SemanticRecordLoadStatus | 'not_configured';
    semantic_error?: string;
    semantic_index_error?: string;
}
export interface SmartwareActivityEvent {
    id: string;
    type: string;
    scope: string;
    actor_id: string;
    actor_type: string;
    actor_display_name: string;
    observed_at: string;
    captured_at: string;
    content: string | object;
    source_id: string | null;
    sensitive: boolean;
}
export interface SmartwareObservationSearchResult {
    id: string;
    type: string;
    scope: string;
    actor_id: string;
    observed_at: string;
    captured_at: string;
    snippet: string;
    source_app: string;
    source_id: string | null;
}
export interface SmartwareObservationEvidence extends SmartwareActivityEvent {
    status: string;
    source_app: string;
}
export interface SmartwareKnowledgeGraphSnapshot {
    entities: Array<{
        entity_id: string;
        entity_name: string;
        type: string;
        scope: string;
        created_at: string;
    }>;
    claims: Array<{
        claim_id: string;
        subject_id: string;
        subject_name: string;
        predicate: string;
        object: {
            type: string;
            value: unknown;
        };
        scope: string;
        epistemic_tag: EpistemicTag;
        confidence: number;
        created_at: string;
        valid_at: string;
        invalid_at: string | null;
        recorded_at: string | null;
        invalidated_at: string | null;
        provenance: {
            origin: 'deterministic' | 'model' | 'user';
            observation_ids: string[];
            model_id?: string;
        };
        relations: ClaimRelation[];
    }>;
}
export interface SmartwareConflictSnapshot {
    claims: Array<{
        claim_id: string;
        subject_id: string;
        subject_name: string;
        predicate: string;
        object: {
            type: string;
            value: unknown;
        };
        scope: string;
        status: 'contested';
        contested_by: string[];
        epistemic_tag: EpistemicTag;
        confidence: number;
        version: number;
        created_at: string;
        valid_at: string;
        invalid_at: string | null;
        provenance: {
            origin: 'deterministic' | 'model' | 'user';
            observation_ids: string[];
            model_id?: string;
        };
    }>;
}
export interface SmartwarePodProfile {
    pod_id: string;
    name: string;
    owner_id: string;
    scopes: {
        personal: string;
        workspace: string;
    };
    memory_policy: {
        read_policy: 'task_start';
        write_policy: 'durable_summary';
        sensitive_policy: 'confirm';
        raw_transcript_policy: 'off';
    };
}
export declare class SmartwareCore {
    readonly dataDir: string;
    readonly evidenceDir: string;
    readonly wikiDir: string;
    /** Operations log canonical surface — see ops_log/ and docs/atomicity.md. */
    readonly opsDir: string;
    /** Cascade preview store for REVISE two-phase endorsement (PR-7 / A6). */
    readonly previewStore: CascadePreviewStore;
    private layer0;
    private store;
    private searchIndex;
    private sessionStore;
    private previewGcInterval;
    private constructor();
    static open(options: SmartwareCoreOptions): Promise<SmartwareCore>;
    getConfig(): SmartwareConfig;
    getRegistry(): ScopeRegistry;
    /**
     * Ensure an application-defined set of scopes exists.
     *
     * Smartware owns scope enforcement and hierarchy, not product taxonomy.
     * Consumers may register app, project, or domain spaces without adding
     * those concepts to Smartware's profile contract.
     */
    ensureScopes(entries: ScopeEntry[]): void;
    createPodProfile(podId: string, name?: string): SmartwarePodProfile;
    ensureTrustedClientGrant(actorId: string, actorType: 'agent' | 'person' | 'system', scopes: string[]): Grant;
    observe(params: ObserveParams): Promise<ObserveResult>;
    query(params: QueryParams): Promise<QueryResult>;
    recall(params: QueryParams): Promise<QueryResult>;
    context(params: ContextParams): Promise<ContextBundle>;
    /**
     * Produce claim-level semantic documents through Smartware's canonical
     * authorization, sensitivity, lifecycle, and effective-current boundary.
     *
     * This is an embedded-core extension, not a change to the frozen RECALL wire
     * contract. Hosts may persist embeddings for these rebuildable documents but
     * must pass the same returned set to semantic ranking.
     */
    prepareSemanticDocuments(params: SmartwareSemanticDocumentsParams): SemanticDocument[];
    /**
     * Refresh one disposable semantic-index scope through Smartware's canonical
     * query eligibility boundary. This is an explicit maintenance operation and
     * never runs as an implicit side effect of RECALL.
     */
    syncSemanticIndex(params: SmartwareSemanticDocumentsParams, options: SmartwareSemanticIndexOptions): Promise<PersistedSemanticSyncResult>;
    /**
     * Evaluate opt-in hybrid retrieval without changing canonical RECALL.
     *
     * The canonical result is returned byte-for-byte from the existing path.
     * Hybrid candidates become selectable only after a complete local index and
     * successful semantic query. Missing/corrupt indices and provider failures
     * select the canonical result instead.
     */
    recallHybrid(params: QueryParams, options: SmartwareHybridRecallOptions): Promise<SmartwareHybridRecallResult>;
    listActivity(options?: {
        scope?: string;
        types?: string[];
        actorId?: string;
        limit?: number;
        includeSensitive?: boolean;
    }): SmartwareActivityEvent[];
    searchObservations(query: string, scope: string, options?: {
        limit?: number;
        includeSensitive?: boolean;
        temporalRange?: {
            from: string;
            to: string;
        };
    }): SmartwareObservationSearchResult[];
    readObservationEvidence(params: {
        actor: Actor;
        observation_id: string;
        include_sensitive?: boolean;
    }): SmartwareObservationEvidence | null;
    compile(params: CompileParams): Promise<CompileHandlerResult>;
    reflect(params: CompileParams): Promise<CompileHandlerResult>;
    /**
     * Run one owner-authorized Dream inspection pass.
     *
     * This is intentionally manual and derived-only: it does not install a
     * scheduler and does not pass a canonical L2 recompile callback.
     */
    dream(params: SmartwareDreamParams): DreamResult;
    read(params: ReadParams): Promise<ReadResult | ScopeBrowseResult>;
    /**
     * Authorization-aware view of unresolved contested claims. Conflict status
     * is intentionally separate from ordinary RECALL because contested claims
     * are not eligible current context.
     */
    readConflicts(params: {
        actor: Actor;
        scopes: string[];
        include_sensitive?: boolean;
    }): SmartwareConflictSnapshot;
    /**
     * Bulk, authorization-aware L1 snapshot for host knowledge-graph projections.
     * This is deliberately narrower than exposing ClaimStore: grants are checked
     * before a single bulk entity/claim read, and sensitive claims never cross
     * this seam unless the caller explicitly opts in.
     */
    readKnowledgeGraph(params: {
        actor: Actor;
        scopes: string[];
        include_sensitive?: boolean;
    }): SmartwareKnowledgeGraphSnapshot;
    explain(params: ExplainParams): Promise<ExplainResult>;
    correct(params: CorrectParams): Promise<CorrectResult>;
    revise(params: ReviseParams): Promise<ReviseResult>;
    forget(params: ForgetParams): Promise<ForgetResult>;
    revive(params: ReviveParams): Promise<ReviveResult>;
    endorse(params: EndorseParams): Promise<EndorseResult>;
    quarantineReview(params: QuarantineReviewParams): Promise<QuarantineReviewResult>;
    grant(params: GrantParams): Promise<GrantResult>;
    revoke(params: RevokeParams): Promise<RevokeResult>;
    sessionStart(params: SessionStartParams): Promise<SessionStartResult>;
    sessionDescribe(actorId: string, sessionId: string): Promise<SessionDescribeResult>;
    sessionEnd(actorId: string, sessionId: string): Promise<SessionEndResult>;
    status(ownerActorId?: string): Promise<StatusResult>;
    findObservationBySource(app: string, sourceId: string): string | null;
    close(): void;
    /**
     * Start the cascade preview store's GC timer. Run-once on open. Idempotent
     * — calling twice is a no-op. Tests can skip by setting interval = 0.
     */
    startPreviewGc(intervalMs?: number): void;
}
export * from './config.js';
export * from './layer0/types.js';
export type { Claim, Entity, ClaimStatus, ClaimState, ClaimType, ClaimRole, ClaimAuthor, ClaimRelation, ConfidenceBucket, EpistemicTag, EpistemicLabel, RelationKind, } from './layer1/types.js';
export { statusToState, epistemicToTag, confidenceToBucket, } from './layer1/types.js';
export * from './layer3/semantic.js';
export * from './layer3/semantic-store.js';
export * from './layer3/temporal.js';
export * from './layer3/hybrid.js';
export * from './evaluation/retrieval.js';
export * from './ops_log/index.js';
export { appendClaimVersion, claimsJsonlPath, iterAllClaimVersions, nextVersion as nextClaimVersion, readClaimHistory, readLatestVersion as readLatestClaimVersion, snapshotAt as snapshotClaimAt, } from './layer1/jsonl.js';
export type { ClaimVersionRecord } from './layer1/jsonl.js';
export { ACTOR_ID_PATTERN, isSpecConformantActorId, } from './auth/grants.js';
export { evaluateAccess, } from './auth/middleware.js';
export type { AccessDecision, AccessOperation } from './auth/middleware.js';
export { renderRegistryMarkdown, writeRegistryMarkdown } from './auth/registry-md.js';
export { appendAlias, ensureDefaultAliases, loadAliasMap, resolveActorId, COFFEE_POD_DEFAULT_ALIASES, } from './auth/alias-map.js';
export type { AliasEntry } from './auth/alias-map.js';
export { CascadePreviewStore, DEFAULT_TTL_SECONDS as CASCADE_PREVIEW_TTL_SECONDS, PREVIEW_ID_PATTERN, isValidCascadePreviewId, } from './preview_store/index.js';
export type { CascadePreviewPayload, PreviewLookup } from './preview_store/index.js';
export * from './layer4/context-planning.js';
export * from './protocol/observe.js';
export * from './protocol/query.js';
export * from './protocol/compile.js';
export * from './protocol/read.js';
export * from './protocol/explain.js';
export * from './protocol/correct.js';
export * from './protocol/revise.js';
export * from './protocol/endorse.js';
export * from './protocol/forget.js';
export * from './protocol/session.js';
export * from './protocol/status.js';
export * from './session/types.js';
export * from './session/checkpoint.js';
//# sourceMappingURL=core.d.ts.map