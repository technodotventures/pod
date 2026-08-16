import { type EmbeddingAdapter, type SemanticDocument, type SemanticEmbeddingRecord, type SemanticMatch } from './semantic.js';
import { type TemporalConstraint } from './temporal.js';
export type SemanticChannelStatus = 'ok' | 'fallback' | 'unavailable' | 'skipped';
export interface HybridFusionOptions {
    limit: number;
    rrf_k?: number;
    lexical_weight?: number;
    semantic_weight?: number;
}
export interface HybridRankOptions extends HybridFusionOptions {
    min_similarity: number;
    candidate_limit?: number;
    temporal?: TemporalConstraint;
    semantic_timeout_ms?: number;
}
export interface HybridMatch extends SemanticDocument {
    /**
     * Query-local reciprocal-rank score. It is not a probability and must not be
     * compared across queries.
     */
    rrf_score: number;
    lexical_rank: number | null;
    semantic_rank: number | null;
    semantic_relevance: number | null;
}
export interface HybridRankResult {
    matches: HybridMatch[];
    semantic_status: SemanticChannelStatus;
    semantic_error?: string;
}
/**
 * Fuse already-ranked, already-eligible lexical and semantic candidates.
 *
 * This pure boundary lets evaluation sweep semantic thresholds without
 * repeating provider requests. It still refuses to expand beyond `documents`.
 */
export declare function fuseHybridRankings(lexicalResultIds: string[], semanticMatches: SemanticMatch[], documents: SemanticDocument[], options: HybridFusionOptions): HybridMatch[];
/**
 * Fuse lexical and semantic rankings without blending their incomparable raw
 * scores.
 *
 * `documents` is the caller-authorized boundary. Lexical ids outside it are
 * ignored, and an explicit temporal constraint is applied to both channels
 * before semantic provider access. A semantic provider or vector failure
 * returns the lexical ranking instead of turning recall into an outage.
 */
export declare function rankHybridDocuments(query: string, lexicalResultIds: string[], documents: SemanticDocument[], records: SemanticEmbeddingRecord[], adapter: EmbeddingAdapter | null, options: HybridRankOptions): Promise<HybridRankResult>;
//# sourceMappingURL=hybrid.d.ts.map