import type { Actor, ClaimTimeValue } from '../layer0/types.js';
import type { Layer0Index } from '../layer0/index.js';
import type { ClaimStore } from '../layer1/store.js';
import type { SmartwareConfig } from '../config.js';
export type CorrectReason = 'changed' | 'wrong' | 'extraction_error' | 'duplicate';
export interface CorrectParams {
    actor: Actor;
    target_claim_id: string;
    corrected_predicate?: string;
    corrected_object?: {
        type: string;
        value: unknown;
    };
    corrected_validity?: {
        from: string;
        to: string | null;
    };
    corrected_t_valid_from?: ClaimTimeValue;
    corrected_t_valid_to?: ClaimTimeValue;
    merge_into_claim_id?: string;
    change_time?: string;
    reason: CorrectReason | string;
}
export interface CorrectResult {
    original_claim_id: string;
    new_claim_id: string | null;
    merged_into_claim_id?: string | null;
    audit_observation_id: string;
    reason: CorrectReason;
    status: 'corrected';
}
export declare function handleCorrect(params: CorrectParams, evidenceDir: string, layer0: Layer0Index, store: ClaimStore, config: SmartwareConfig): Promise<CorrectResult>;
export { handleCorrect as handleRevise };
export type { CorrectParams as ReviseParams, CorrectResult as ReviseResult };
//# sourceMappingURL=_correct_legacy.d.ts.map