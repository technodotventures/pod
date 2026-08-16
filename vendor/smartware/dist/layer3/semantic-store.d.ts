import { type EmbeddingAdapter, type SemanticDocument, type SemanticEmbeddingRecord, type SemanticSyncResult } from './semantic.js';
export type SemanticIndexCoverage = 'complete' | 'partial';
export interface SemanticIndexSnapshot {
    source_document_count: number;
    document_set_hash: string;
    coverage: SemanticIndexCoverage;
}
export interface SemanticIndexExpectation {
    source_document_count: number;
    document_set_hash: string;
    require_complete?: boolean;
}
export type SemanticRecordLoadStatus = 'ready' | 'missing' | 'degraded' | 'unavailable';
export interface SemanticRecordLoadResult {
    status: SemanticRecordLoadStatus;
    records: SemanticEmbeddingRecord[];
    invalid_records: number;
    expected_records: number | null;
    source_document_count: number | null;
    document_set_hash: string | null;
    coverage: SemanticIndexCoverage | null;
    error?: string;
}
export type SemanticRecordStoreOpenResult = {
    status: 'ready';
    store: SemanticRecordStore;
} | {
    status: 'unavailable';
    store: null;
    error: string;
};
export interface PersistedSemanticSyncResult extends SemanticSyncResult {
    prior_status: SemanticRecordLoadStatus;
    invalid_records: number;
    indexed_document_count: number;
    source_document_count: number;
    document_set_hash: string;
    coverage: SemanticIndexCoverage;
}
export interface PersistedSemanticSyncOptions {
    source_documents?: SemanticDocument[];
    coverage?: SemanticIndexCoverage;
    timeout_ms?: number;
}
export interface SemanticRecordResetOptions {
    model_key?: string;
    scope?: string;
}
/**
 * Disposable local persistence for derived semantic records.
 *
 * Canonical claims never live here. Replacing a model-and-scope partition is
 * atomic, and callers can delete the database or call reset without affecting
 * memory.
 */
export declare class SemanticRecordStore {
    private db;
    constructor(dbPath: string);
    load(adapter: EmbeddingAdapter, scope: string, indexVersion?: number, expected?: SemanticIndexExpectation): SemanticRecordLoadResult;
    replace(adapter: EmbeddingAdapter, scope: string, records: SemanticEmbeddingRecord[], indexVersion?: number, snapshot?: SemanticIndexSnapshot): void;
    reset(options?: SemanticRecordResetOptions): number;
    close(): void;
}
export declare function openSemanticRecordStore(dbPath: string): SemanticRecordStoreOpenResult;
export declare function syncPersistedSemanticRecords(store: SemanticRecordStore, scope: string, documents: SemanticDocument[], adapter: EmbeddingAdapter, batchSize?: number, options?: PersistedSemanticSyncOptions): Promise<PersistedSemanticSyncResult>;
//# sourceMappingURL=semantic-store.d.ts.map