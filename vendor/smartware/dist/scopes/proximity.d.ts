import type { ScopeRegistry } from './registry.js';
/**
 * Compute a 0–1 proximity score between a query scope and a result scope.
 *
 * 1.0 — exact match
 * 0.7 — direct parent/child relationship
 * 0.3 — siblings (share same parent)
 * 0.0 — unrelated
 */
export declare function getScopeProximity(queryScope: string, resultScope: string, registry: ScopeRegistry): number;
//# sourceMappingURL=proximity.d.ts.map