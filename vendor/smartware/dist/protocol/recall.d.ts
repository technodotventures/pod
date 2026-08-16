import type { ClaimStore } from '../layer1/store.js';
import type { SearchIndex } from '../layer3/search.js';
import type { SmartwareConfig } from '../config.js';
import type { ScopeRegistry } from '../scopes/registry.js';
import type { Actor } from '../layer0/types.js';
import type { ConfidenceBucket, EpistemicTag } from '../layer1/types.js';
import type { ScoredResult } from '../layer4/scoring.js';
import type { TemporalConstraint } from '../layer3/temporal.js';
import type { SessionStore } from '../session/store.js';
export interface QueryParams {
    actor: Actor;
    /** When supplied, server-resolved session identity overrides actor.id. */
    session_id?: string;
    query: string;
    scope: string;
    min_confidence?: number | ConfidenceBucket;
    epistemic?: string[];
    epistemic_tags?: EpistemicTag[];
    entity_type?: string;
    include_sensitive?: boolean;
    include_stale?: boolean;
    include_superseded?: boolean;
    include_forgotten?: boolean;
    /** Embedded retrieval constraint. The frozen RECALL HTTP/MCP schema may
     * expose this separately; the core applies it before ranking and limits. */
    temporal?: TemporalConstraint;
    limit?: number;
    resolution?: 'oneline' | 'oneliner' | 'paragraph' | 'full';
    delivery_mode?: 'inline' | 'file_reference' | 'context_bundle';
    /** Reserved post-beta by the frozen v0.4.2 wire contract. */
    as_of?: string;
}
export interface QueryResult {
    results: Array<{
        entity_id: string;
        entity_name: string;
        scope: string;
        score: number;
        signals: ScoredResult['signals'];
        claim?: {
            id: string;
            predicate: string;
            object: unknown;
            epistemic: string;
            confidence: number;
            status: string;
            observation_ids: string[];
            valid_at: string | null;
            invalid_at: string | null;
            recorded_at: string | null;
            invalidated_at: string | null;
        };
    }>;
    total_found: number;
    filtered_out: number;
    query_scope: string;
}
export declare function recallMinimumConfidence(value: QueryParams['min_confidence']): number | undefined;
export declare function handleQuery(params: QueryParams, store: ClaimStore, searchIndex: SearchIndex, config: SmartwareConfig, registry: ScopeRegistry, sessionStore?: SessionStore): Promise<QueryResult>;
export { handleQuery as handleRecall };
export type { QueryParams as RecallParams, QueryResult as RecallResult };
//# sourceMappingURL=recall.d.ts.map