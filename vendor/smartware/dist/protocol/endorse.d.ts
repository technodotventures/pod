import type { Actor } from '../layer0/types.js';
import type { ClaimStore } from '../layer1/store.js';
import type { SmartwareConfig } from '../config.js';
import { type ActiveClaimVersion } from '../layer1/jsonl.js';
import { CascadePreviewStore } from '../preview_store/store.js';
import { type CommitContext, type EndorseOperationIntent } from '../ops_log/index.js';
export interface EndorseParams {
    actor: Actor;
    page_id: string;
    page_path: string;
    dry_run: boolean;
    cascade_preview_id?: string;
    reason: string;
    operation_id?: string;
}
export interface EndorsePreviewResult {
    cascade_preview_id: string;
    sources: string[];
    shared_claims: string[];
    status: 'preview';
}
export interface EndorseCommitResult {
    page_id: string;
    claims_endorsed: number;
    operation_id: string;
    commit_ts: string;
    status: 'endorsed';
}
export type EndorseResult = EndorsePreviewResult | EndorseCommitResult;
export interface EndorseCommitHooks {
    afterIntent?: (intent: EndorseOperationIntent) => void;
    afterClaimVersions?: (records: ActiveClaimVersion[]) => void;
    afterPage?: () => void;
    afterCommit?: () => void;
}
export declare function handleEndorse(params: EndorseParams, dataDir: string, store: ClaimStore, previewStore: CascadePreviewStore, config: SmartwareConfig, commitCtx?: CommitContext, commitHooks?: EndorseCommitHooks): Promise<EndorseResult>;
//# sourceMappingURL=endorse.d.ts.map