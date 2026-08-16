import type { PreExtractedClaim } from '../layer0/types.js';
import type { Entity } from '../layer1/types.js';
import type { SmartwareConfig } from '../config.js';
import type { RelationProposal } from './deterministic.js';
export interface LLMExtractionResult {
    claims: PreExtractedClaim[];
    relation_proposals: RelationProposal[];
    model: string;
    promptHash: string;
}
export declare function extractClaimsLLM(content: string, scope: string, validityFrom: string, existingEntities: Entity[], config: SmartwareConfig): Promise<LLMExtractionResult>;
/** Generate a compiled markdown page using the active LLM provider */
export declare function compileMarkdownLLM(entityName: string, entityType: string, claims: Array<{
    predicate: string;
    object: {
        type: string;
        value: unknown;
    };
    epistemic: string;
    confidence: number;
}>, existingPage: string | null, config: SmartwareConfig): Promise<{
    oneliner: string;
    paragraph: string;
    fullPage: string;
}>;
//# sourceMappingURL=llm.d.ts.map