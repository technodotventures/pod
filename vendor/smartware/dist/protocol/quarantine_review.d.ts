import type { Actor } from '../layer0/types.js';
import type { Layer0Index } from '../layer0/index.js';
import type { ClaimStore } from '../layer1/store.js';
import type { SmartwareConfig } from '../config.js';
export type QuarantineAction = 'approve' | 'reject';
export interface QuarantineReviewParams {
    actor: Actor;
    target_obs_id: string;
    action: QuarantineAction;
    reason?: string;
}
export interface QuarantineReviewResult {
    target_obs_id: string;
    action: QuarantineAction;
    new_status: 'accepted' | 'rejected';
    status: 'reviewed';
}
export declare function handleQuarantineReview(params: QuarantineReviewParams, evidenceDir: string, layer0: Layer0Index, store: ClaimStore, config: SmartwareConfig): Promise<QuarantineReviewResult>;
//# sourceMappingURL=quarantine_review.d.ts.map