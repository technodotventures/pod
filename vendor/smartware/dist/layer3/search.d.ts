import Database from 'better-sqlite3';
import type { CompiledPage } from '../layer2/types.js';
import type { Claim, Entity } from '../layer1/types.js';
import type { ClaimStore } from '../layer1/store.js';
export interface SearchResult {
    entity_id: string;
    entity_name: string;
    scope: string;
    rank: number;
    snippet?: string;
}
export interface ClaimSearchResult extends SearchResult {
    claim_id: string;
}
export declare class SearchIndex {
    private db;
    constructor(dbPath: string);
    /** Index or re-index a compiled page */
    indexPage(page: CompiledPage): void;
    /** Remove an entity from the index */
    removePage(entityId: string): void;
    /** Full-text search. Returns results sorted by rank (best first). */
    search(query: string, scope?: string): SearchResult[];
    /** Full-text search over individual active/stale claims. */
    searchClaims(query: string, scope?: string): ClaimSearchResult[];
    /** Count indexed pages */
    count(): number;
    /**
     * Index an entity directly from its L1 claims — no L2 CompiledPage needed.
     * This is the key decoupling: L3 search stays current even if L2 synthesis
     * fails or times out.
     */
    indexEntityFromClaims(entity: Entity, claims: Claim[]): void;
    indexClaim(claimId: string, subjectName: string, scope: string, content: string): void;
    /** Replace the claim-granular index for one scope, or for the whole store. */
    replaceClaimIndex(claims: Claim[], scope?: string): void;
    /** Clear all indexed content */
    clear(): void;
    close(): void;
    getDB(): Database.Database;
}
/**
 * Sync Layer 3 search index from Layer 1 claims.
 * Reads all entities and their active claims from the store, indexes each
 * entity's claim content into FTS5. This runs independently of Layer 2
 * synthesis — claims become queryable within seconds of extraction.
 *
 * Returns the number of entities indexed.
 */
export declare function syncSearchFromClaims(store: ClaimStore, searchIndex: SearchIndex, scope?: string): number;
/**
 * Sanitise a free-text query for FTS5.
 *
 * Extracts alphanumeric content words (dropping punctuation and function words),
 * quotes each as a safe phrase, and OR-combines them so a natural-language
 * question matches entities containing ANY content word — FTS5 BM25 then ranks
 * by relevance. Falls back to all words if every word is a stopword.
 */
export declare function searchQueryTerms(query: string): string[];
//# sourceMappingURL=search.d.ts.map