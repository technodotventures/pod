import type { Actor } from '../layer0/types.js';
import type { SmartwareConfig } from '../config.js';
import type { SessionStore } from '../session/store.js';
import type { TrustLevel, ClientCapabilities, Session } from '../session/types.js';
export interface SessionStartParams {
    actor: Actor;
    client_id: string;
    client_version: string;
    declared_trust_level: TrustLevel;
    declared_capabilities: ClientCapabilities;
    requested_scopes?: string[];
    opsDir?: string;
}
export interface SessionStartResult {
    session_id: string;
    actor_id: string;
    effective_trust_level: TrustLevel;
    effective_policy: Session['effective_policy'];
    capabilities_granted: string[];
    policy_version: string;
    expires_at: string;
    downgrade_reason?: string;
    snapshot_frozen_at?: string;
}
export declare function handleSessionStart(params: SessionStartParams, sessionStore: SessionStore, config: SmartwareConfig): Promise<SessionStartResult>;
export interface SessionDescribeParams {
    session_id: string;
    actor_id: string;
}
export interface SessionDescribeResult {
    session_id: string;
    client_id: string;
    actor_id: string;
    effective_trust_level: TrustLevel;
    effective_policy: Session['effective_policy'];
    capabilities_granted: string[];
    status: Session['status'];
    created_at: string;
    expires_at: string;
    ended_at: string | null;
}
export declare function handleSessionDescribe(params: SessionDescribeParams, sessionStore: SessionStore, config: SmartwareConfig): Promise<SessionDescribeResult>;
export interface SessionEndParams {
    session_id: string;
    actor_id: string;
    opsDir?: string;
    onSummarize?: (scope: string, actorId: string) => Promise<number>;
}
export interface SessionEndResult {
    session_id: string;
    status: 'ended';
    summary?: {
        write_mode: string;
        durability: 'not_requested' | 'not_configured' | 'persisted' | 'failed';
        claims_persisted?: number;
        sensitive_filtered: boolean;
    };
}
export declare function handleSessionEnd(params: SessionEndParams, sessionStore: SessionStore, config: SmartwareConfig): Promise<SessionEndResult>;
/**
 * Resolve actor from session_id. Used by observe/query/read handlers
 * to look up server-resolved identity instead of trusting client-supplied actor_id.
 *
 * Returns null if session_id not provided (backward compat with actor_id flow).
 */
export declare function resolveActorFromSession(sessionId: string | undefined, sessionStore: SessionStore): {
    actor_id: string;
    effective_policy: Session['effective_policy'];
    requested_scopes: string[];
    capabilities_granted: string[];
} | null;
/**
 * Enforce the capability and scope constraints frozen into a server-anchored
 * session. Normal grant checks still run afterwards against current policy.
 */
export declare function requireSessionCapability(resolved: NonNullable<ReturnType<typeof resolveActorFromSession>>, capability: 'observe' | 'query' | 'read', scope: string): void;
//# sourceMappingURL=session.d.ts.map