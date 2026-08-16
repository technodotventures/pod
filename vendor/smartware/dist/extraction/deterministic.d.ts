import type { PreExtractedClaim } from '../layer0/types.js';
export interface RelationProposal {
    kind: 'references';
    source_content: string;
    target_content: string;
    rule_id: string;
    observation_ids: string[];
    origin: 'deterministic';
}
export interface DeterministicResult {
    claims: PreExtractedClaim[];
    entities: Array<{
        name: string;
        type: string;
    }>;
    relation_proposals: RelationProposal[];
}
/**
 * Extract structured claims deterministically from text content.
 */
export declare function extractDeterministic(content: string, scope: string, subjectName: string, validityFrom: string): DeterministicResult;
/**
 * Detect dates in text for use in validity ranges.
 */
export declare function extractDates(text: string): string[];
//# sourceMappingURL=deterministic.d.ts.map