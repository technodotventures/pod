export declare const SESSION_CHECKPOINT_KIND: "session_checkpoint";
export declare const SESSION_CHECKPOINT_VERSION: 1;
export declare const SESSION_CHECKPOINT_LIMITS: {
    readonly totalChars: 16384;
    readonly idChars: 256;
    readonly scopeChars: 256;
    readonly summaryChars: 4000;
    readonly listItems: 20;
    readonly listItemChars: 1000;
};
export declare const SESSION_CHECKPOINT_TRIGGERS: readonly ["post_turn", "pre_compaction", "shutdown", "manual"];
export type SessionCheckpointTrigger = typeof SESSION_CHECKPOINT_TRIGGERS[number];
/**
 * Bounded v1 payload carried through OBSERVE as application/json.
 * It is not a new protocol verb: hosts validate this envelope, then write it
 * with their normal OBSERVE operation and operation_id semantics.
 */
export interface SessionCheckpointV1 {
    kind: typeof SESSION_CHECKPOINT_KIND;
    version: typeof SESSION_CHECKPOINT_VERSION;
    operation_id: string;
    checkpoint_id: string;
    session_id: string;
    scope: string;
    trigger: SessionCheckpointTrigger;
    generation: number;
    summary: string;
    decisions: string[];
    open_loops: string[];
    source_digest: string;
}
export declare class SessionCheckpointValidationError extends Error {
    constructor(message: string);
}
export declare function deriveSessionCheckpointId(sessionId: string, trigger: SessionCheckpointTrigger, generation: number): string;
export declare function isSessionCheckpointContent(value: unknown): value is Record<string, unknown>;
/** Validate identity, scope, idempotency and hard size bounds for checkpoint v1. */
export declare function validateSessionCheckpoint(value: unknown): SessionCheckpointV1;
/** Human-readable L1 projection; the complete envelope remains in L0 and semantic metadata. */
export declare function renderSessionCheckpoint(checkpoint: SessionCheckpointV1): string;
//# sourceMappingURL=checkpoint.d.ts.map