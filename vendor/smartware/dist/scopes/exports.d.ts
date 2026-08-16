import type { SmartwareConfig } from '../config.js';
/**
 * Export rules define which personal-scope data is shared with other scopes.
 * For MVP this is a simple allow-list based on predicate patterns.
 */
export interface ExportRule {
    from_scope: string;
    to_scope: string;
    predicates: string[];
}
/**
 * Determine whether a claim in fromScope is visible to a query from toScope,
 * based on export rules.
 */
export declare function isExported(fromScope: string, toScope: string, predicate: string, config: SmartwareConfig): boolean;
/**
 * Check if the effective visibility of a claim allows it to be returned
 * to an actor querying from a given scope.
 */
export declare function isVisibleToActor(claimScope: string, claimVisibility: string, querierScope: string, config: SmartwareConfig): boolean;
//# sourceMappingURL=exports.d.ts.map