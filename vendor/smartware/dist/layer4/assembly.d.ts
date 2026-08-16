import type { ClaimStore } from '../layer1/store.js';
import type { EpistemicTag } from '../layer1/types.js';
import type { SearchIndex } from '../layer3/search.js';
import type { SmartwareConfig } from '../config.js';
import type { ScopeRegistry } from '../scopes/registry.js';
import { type ScoredResult } from './scoring.js';
import { type TemporalConstraint } from '../layer3/temporal.js';
export interface QueryFilters {
    minConfidence?: number;
    epistemic?: string[];
    epistemicTags?: EpistemicTag[];
    entityType?: string;
    includeSensitive?: boolean;
    includeStale?: boolean;
    includeSuperseded?: boolean;
    includeForgotten?: boolean;
    temporal?: TemporalConstraint;
    limit?: number;
}
export interface AssembledContext {
    results: ScoredResult[];
    total_found: number;
    filtered_out: number;
    query_scope: string;
}
/**
 * Apply all five policy filters from the spec:
 * 1. Capability grants
 * 2. Visibility flags
 * 3. Scope exports
 * 4. Sensitivity (exclude by default)
 * 5. Claim status (exclude stale/retracted by default)
 */
export declare function assembleContext(query: string, queryScope: string, actorId: string, searchIndex: SearchIndex, store: ClaimStore, config: SmartwareConfig, registry: ScopeRegistry, filters?: QueryFilters): AssembledContext;
//# sourceMappingURL=assembly.d.ts.map