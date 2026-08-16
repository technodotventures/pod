import type { Layer0Index } from '../layer0/index.js';
import type { ClaimStore } from '../layer1/store.js';
import type { SearchIndex } from '../layer3/search.js';
import type { SmartwareConfig } from '../config.js';
import type { Actor } from '../layer0/types.js';
import { type CompileResult } from '../layer2/compiler.js';
import type { CompileTelemetry } from '../layer2/types.js';
import { type ActiveClaimVersion } from '../layer1/jsonl.js';
import { type CommitContext, type OpLogEntry, type ReflectClaimOperationIntent } from '../ops_log/index.js';
export interface CompileParams {
    actor: Actor;
    scope?: string;
    entity_id?: string;
    use_llm?: boolean;
    operation_id?: string;
}
export interface CompileHandlerResult {
    pages_compiled: number;
    claims_created: number;
    git_sha?: string;
    audit: CompileResult['audit'];
    telemetry: CompileTelemetry;
}
export interface ReflectCommitHooks {
    afterIntent?: (intent: ReflectClaimOperationIntent) => void;
    afterClaimVersion?: (record: ActiveClaimVersion) => void;
    afterCommit?: () => void;
}
export type ReflectAutoTerminalOutcome = 'ignored_context_only' | 'ignored_short_content' | 'no_claims' | 'claims_processed';
/** Content-free replay checkpoint for one observation considered by REFLECT. */
export interface ReflectAutoTerminalReceipt extends Record<string, unknown> {
    observation_id: string;
    scope: string;
    reflection_complete: true;
    outcome: ReflectAutoTerminalOutcome;
    candidates_found?: number;
    claim_versions_written?: number;
}
export declare function isReflectAutoTerminalReceipt(entry: OpLogEntry): entry is OpLogEntry & {
    details: ReflectAutoTerminalReceipt;
};
export declare function handleCompile(params: CompileParams, evidenceDir: string, wikiDir: string, layer0: Layer0Index, store: ClaimStore, searchIndex: SearchIndex, config: SmartwareConfig, dataDir?: string, commitCtx?: CommitContext, commitHooks?: ReflectCommitHooks): Promise<CompileHandlerResult>;
export { handleCompile as handleReflect };
export type { CompileParams as ReflectParams, CompileHandlerResult as ReflectResult };
//# sourceMappingURL=reflect.d.ts.map