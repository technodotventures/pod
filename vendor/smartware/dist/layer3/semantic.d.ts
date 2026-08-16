import type { Claim } from '../layer1/types.js';
import { type TemporalConstraint, type TemporalDocument } from './temporal.js';
export declare const SEMANTIC_INDEX_VERSION = 1;
export interface EmbeddingAdapter {
    provider: string;
    model: string;
    dimensions?: number;
    embed(texts: string[]): Promise<number[][]>;
}
export interface SemanticDocument extends TemporalDocument {
    id: string;
    scope: string;
    version: string;
    text: string;
}
export interface SemanticEmbeddingRecord {
    id: string;
    scope: string;
    content_hash: string;
    model_key: string;
    index_version: number;
    dimensions: number;
    vector: number[];
}
export interface SemanticSyncResult {
    records: SemanticEmbeddingRecord[];
    embedded: number;
    reused: number;
    removed: number;
}
export interface SemanticMatch extends SemanticDocument {
    semantic_relevance: number;
}
export interface SemanticRankOptions {
    min_similarity: number;
    limit: number;
    temporal?: TemporalConstraint;
    timeout_ms?: number;
}
export declare function semanticModelKey(adapter: Pick<EmbeddingAdapter, 'provider' | 'model'>): string;
export declare function semanticContentHash(text: string): string;
/** Exact, order-independent identity of the documents eligible for indexing. */
export declare function semanticDocumentSetHash(documents: SemanticDocument[]): string;
export declare function semanticRecordSetHash(records: Pick<SemanticEmbeddingRecord, 'id' | 'scope' | 'content_hash'>[]): string;
export declare function claimToSemanticDocument(claim: Claim): SemanticDocument;
/**
 * Update a rebuildable embedding record set.
 *
 * Only changed content or a changed model key triggers embedding work.
 * Deleted documents disappear from the returned records. Persistence belongs
 * to the host, allowing local files, SQLite, or a vector backend without
 * changing Smartware's retrieval semantics.
 */
export declare function syncSemanticRecords(documents: SemanticDocument[], existingRecords: SemanticEmbeddingRecord[], adapter: EmbeddingAdapter, batchSize?: number, timeoutMs?: number): Promise<SemanticSyncResult>;
/**
 * Rank a policy-eligible document set by cosine similarity.
 *
 * The function never expands beyond `documents`: authorization, sensitivity,
 * lifecycle, and scope filtering must happen before this boundary. An explicit
 * temporal constraint is also applied before the query embedding is requested.
 */
export declare function rankSemanticDocuments(query: string, documents: SemanticDocument[], records: SemanticEmbeddingRecord[], adapter: EmbeddingAdapter, options: SemanticRankOptions): Promise<SemanticMatch[]>;
//# sourceMappingURL=semantic.d.ts.map