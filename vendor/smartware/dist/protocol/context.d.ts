import type { SmartwareConfig } from '../config.js';
import type { Layer0Index } from '../layer0/index.js';
import type { ClaimStore } from '../layer1/store.js';
import type { ClaimAuthor, ClaimRelation, ClaimState, ClaimType, ClaimRole, ConfidenceBucket, EpistemicTag } from '../layer1/types.js';
import type { SearchIndex } from '../layer3/search.js';
import type { ScopeRegistry } from '../scopes/registry.js';
export interface ContextParams {
    query: string;
    scope: string;
    actor_id: string;
    include_superseded?: boolean;
    include_forgotten?: boolean;
    limit?: number;
}
export interface ContextClaimSummary {
    claim_id: string;
    version: number;
    state: ClaimState;
    content: string;
    confidence: ConfidenceBucket;
    epistemic_tag: EpistemicTag;
    author: ClaimAuthor;
    epistemic_owner: ClaimAuthor;
    scope: string;
    claim_type: ClaimType;
    claim_role: ClaimRole;
    version_at: string;
}
interface ContextCurrentVersion {
    version: number;
    state: ClaimState;
    version_at: string;
}
export interface ContextOutboundRelation {
    relation_id: string;
    seed: string;
    kind: string;
    target: string;
    valid_at: string;
    invalid_at: string | null;
    provenance: ClaimRelation['provenance'];
    target_claim: ContextClaimSummary;
    target_current?: ContextCurrentVersion;
}
export interface ContextInboundRelation {
    relation_id: string;
    source: string;
    kind: string;
    seed: string;
    valid_at: string;
    invalid_at: string | null;
    provenance: ClaimRelation['provenance'];
    source_claim: ContextClaimSummary;
    source_current?: ContextCurrentVersion;
}
export interface ContextObservationSummary {
    observation_id: string;
    source: string;
    content: unknown;
    timestamp: string;
}
export interface ContextBundle {
    seeds: ContextClaimSummary[];
    outbound_relations: ContextOutboundRelation[];
    inbound_relations: ContextInboundRelation[];
    provenance: ContextObservationSummary[];
}
export declare function handleContext(params: ContextParams, store: ClaimStore, searchIndex: SearchIndex, config: SmartwareConfig, registry: ScopeRegistry, evidenceDir?: string, layer0?: Layer0Index): Promise<ContextBundle>;
export {};
//# sourceMappingURL=context.d.ts.map