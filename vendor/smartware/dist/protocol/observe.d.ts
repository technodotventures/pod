import type { Observation, Actor } from '../layer0/types.js';
import type { Layer0Index } from '../layer0/index.js';
import type { SmartwareConfig } from '../config.js';
import type { SessionStore } from '../session/store.js';
import { type ObservationOperationIntent } from '../ops_log/index.js';
export interface ObserveParams {
    actor: Actor;
    type: Observation['type'];
    content: Observation['content'];
    scope: string;
    visibility?: Observation['visibility'];
    source_id?: string | null;
    app?: string;
    app_version?: string;
    observed_at?: string;
    parent_ids?: string[];
    informed_by?: string[];
    sensitive?: boolean;
    pii_detected?: boolean;
    retention?: Observation['policy']['retention'];
    /** @deprecated Rejected in v1.6.16. OBSERVE writes L0 only; claim extraction is reflect.auto's job. */
    claims?: Observation['claims'];
    idempotency_key?: string;
    /** If provided, actor_id is resolved from the session (server-enforced identity) */
    session_id?: string;
    /**
     * Spec-conformant OperationId per Protocol Contract v0.4.1 (PR-21).
     * When supplied AND opsDir is configured on handleObserve, an ops-log
     * entry is appended after the L0 write — the durable commit signal
     * per A0 atomicity strategy.
     */
    operation_id?: string;
}
export interface ObserveResult {
    id: string;
    status: 'accepted' | 'quarantined' | 'duplicate' | 'rejected';
    existing_id?: string;
    sequence: number;
}
/** Synchronous fault hooks used by crash-boundary conformance tests. */
export interface ObserveCommitHooks {
    afterIntent?: (intent: ObservationOperationIntent) => void;
    afterObservation?: (observation: Observation) => void;
    afterCommit?: () => void;
}
export declare function handleObserve(params: ObserveParams, evidenceDir: string, layer0: Layer0Index, config: SmartwareConfig, sessionStore?: SessionStore, opsDir?: string, commitHooks?: ObserveCommitHooks): Promise<ObserveResult>;
//# sourceMappingURL=observe.d.ts.map