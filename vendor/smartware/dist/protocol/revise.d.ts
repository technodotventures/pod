import type { Actor } from '../layer0/types.js';
import type { ClaimAuthor, ConfidenceBucket, EpistemicTag, RelationKind } from '../layer1/types.js';
import { type ActiveClaimVersion } from '../layer1/jsonl.js';
import type { ClaimStore } from '../layer1/store.js';
import type { SmartwareConfig } from '../config.js';
import { type CommitContext, type ReviseOperationIntent } from '../ops_log/index.js';
import type Database from 'better-sqlite3';
export interface ReviseParams {
    actor: Actor;
    target: string;
    expected_base_version: number;
    add_relations?: Array<{
        kind: RelationKind;
        target: string;
        valid_at: string;
        provenance: {
            origin: 'user';
            target_claim_version: number;
        };
    }>;
    set_confidence?: ConfidenceBucket;
    set_epistemic_tag?: EpistemicTag;
    add_derived_from?: string[];
    invalidate_relations?: string[];
    adopt_body?: boolean;
    reason: string;
    operation_id: string;
}
export interface ReviseResult {
    claim_id: string;
    new_version: number;
    epistemic_owner: ClaimAuthor;
    operation_id: string;
    status: 'revised';
}
/** Synchronous fault hooks used by crash-boundary conformance tests. */
export interface ReviseCommitHooks {
    afterIntent?: (intent: ReviseOperationIntent) => void;
    afterClaimVersion?: (record: ActiveClaimVersion) => void;
    afterCommit?: () => void;
}
export declare function handleRevise(params: ReviseParams, dataDir: string, store: ClaimStore, config: SmartwareConfig, commitCtx?: CommitContext, db?: Database.Database, commitHooks?: ReviseCommitHooks): Promise<ReviseResult>;
//# sourceMappingURL=revise.d.ts.map