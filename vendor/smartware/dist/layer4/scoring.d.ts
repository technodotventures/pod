import type { Claim } from '../layer1/types.js';
import type { SearchResult } from '../layer3/search.js';
import type { ScopeRegistry } from '../scopes/registry.js';
export interface ScoredResult {
    entity_id: string;
    entity_name: string;
    scope: string;
    claim?: Claim;
    score: number;
    signals: {
        textRelevance: number;
        recency: number;
        epistemicConf: number;
        scopeProximity: number;
    };
}
/**
 * Score a search result using four signals:
 * - textRelevance (BM25): 0.35 weight
 * - recency: 0.25 weight
 * - epistemicConf: 0.25 weight
 * - scopeProximity: 0.15 weight
 */
export declare function scoreResult(searchResult: SearchResult, claim: Claim | undefined, queryScope: string, registry: ScopeRegistry, textRelevance: number): ScoredResult;
/**
 * Convert FTS5 BM25 magnitudes into query-local 0-1 relevance.
 *
 * SQLite's hidden FTS5 rank is negative and query/corpus dependent.
 * SearchIndex preserves its magnitude, where larger means a stronger match.
 * Those magnitudes are commonly around 1e-6, so dividing by a global constant
 * erases lexical relevance and lets recency/confidence dominate.
 *
 * This value is intentionally relative to one eligible candidate set. It is a
 * ranking signal, not calibrated confidence, and must not be compared with a
 * semantic cosine score or used as a cross-query threshold.
 */
export declare function normaliseTextRelevance(ranks: number[]): number[];
/** Sort scored results descending by composite score */
export declare function rankResults(results: ScoredResult[]): ScoredResult[];
//# sourceMappingURL=scoring.d.ts.map