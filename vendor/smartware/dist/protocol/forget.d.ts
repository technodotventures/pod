import type { Observation, Actor } from '../layer0/types.js';
import type { Layer0Index } from '../layer0/index.js';
import type { ClaimStore } from '../layer1/store.js';
import type { SmartwareConfig } from '../config.js';
import { type ActiveClaimVersion, type ForgottenClaimVersion } from '../layer1/jsonl.js';
import { type CommitContext, type ForgetOperationIntent, type ReviveOperationIntent } from '../ops_log/index.js';
export type ForgetMode = 'tombstone' | 'delete_object' | 'redact_if_supported';
export type ForgetTarget = {
    type: 'observation';
    id: string;
} | {
    type: 'claim';
    id: string;
};
export interface ForgetParams {
    actor: Actor;
    target?: ForgetTarget;
    target_obs_id?: string;
    target_claim_id?: string;
    mode: ForgetMode;
    reason?: string;
    redaction_reason?: 'sensitive' | 'requested_by_user' | 'extraction_error' | 'policy_violation';
    operation_id?: string;
}
export interface ForgetCommitHooks {
    afterIntent?: (intent: ForgetOperationIntent) => void;
    afterAuditObservation?: (observation: Observation) => void;
    afterClaimVersion?: (record: ForgottenClaimVersion) => void;
    afterCommit?: () => void;
}
export interface ForgetResult {
    target_id: string;
    target_kind: ForgetTarget['type'];
    mode: ForgetMode;
    claims_retracted: number;
    claims_reduced: number;
    audit_observation_id: string;
    status: 'forgotten';
}
export declare function handleForget(params: ForgetParams, evidenceDir: string, layer0: Layer0Index, store: ClaimStore, config: SmartwareConfig, commitCtx?: CommitContext, commitHooks?: ForgetCommitHooks): Promise<ForgetResult>;
export interface ReviveParams {
    actor: Actor;
    tombstone_id: string;
    reason: string;
    operation_id: string;
}
export interface ReviveResult {
    claim_id: string;
    new_version: number;
    operation_id: string;
    invalidated_edges: string[];
    status: 'revived';
}
export interface ReviveCommitHooks {
    afterIntent?: (intent: ReviveOperationIntent) => void;
    afterClaimVersion?: (record: ActiveClaimVersion) => void;
    afterCommit?: () => void;
}
export declare function handleRevive(params: ReviveParams, dataDir: string, store: ClaimStore, config: SmartwareConfig, commitCtx?: CommitContext, db?: import('better-sqlite3').Database, commitHooks?: ReviveCommitHooks): Promise<ReviveResult>;
//# sourceMappingURL=forget.d.ts.map