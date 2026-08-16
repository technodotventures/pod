import type { Actor } from '../layer0/types.js';
import type { Layer0Index } from '../layer0/index.js';
import type { ClaimStore } from '../layer1/store.js';
import type { SmartwareConfig } from '../config.js';
export interface ExplainParams {
    actor: Actor;
    claim_id?: string;
    entity_id?: string;
}
export interface ClaimProvenance {
    claim_id: string;
    subject: {
        id: string;
        name: string;
    };
    predicate: string;
    object: {
        type: string;
        value: unknown;
    };
    scope: string;
    status: string;
    epistemic: string;
    confidence: number;
    validity: {
        from: string;
        to: string | null;
    };
    extraction: {
        method: string;
        model: string | null;
        extracted_at: string;
    };
    source_observation: ObsSummary | null;
    extraction_event: ObsSummary | null;
    derived_from: string[];
    derived_observations: ObsSummary[];
    superseded_by: string | null;
    contested_by: string[];
    supporting_evidence: string[];
    author?: string;
    epistemic_owner?: string;
    fingerprint?: string;
}
export interface ObsSummary {
    id: string;
    type: string;
    status: string;
    actor: {
        type: string;
        id: string;
        display_name: string;
    };
    app: string;
    captured_at: string;
    observed_at: string;
    scope: string;
    content_preview: string;
}
export interface EntityExplanation {
    entity: {
        id: string;
        canonical_name: string;
        type: string;
        scope: string;
        aliases: string[];
        created_at: string;
    };
    claims: ClaimProvenance[];
    source_observations: ObsSummary[];
    total_claims: number;
    active_claims: number;
}
export interface ExplainResult {
    type: 'claim' | 'entity';
    claim?: ClaimProvenance;
    entity?: EntityExplanation;
}
export declare function handleExplain(params: ExplainParams, evidenceDir: string, layer0: Layer0Index, store: ClaimStore, config: SmartwareConfig, dataDir?: string): Promise<ExplainResult>;
//# sourceMappingURL=explain.d.ts.map