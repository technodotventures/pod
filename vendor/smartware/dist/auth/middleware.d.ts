import type { SmartwareConfig } from '../config.js';
import type { Grant } from './grants.js';
export declare class ProtocolError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/**
 * Require a grant for an operation on a scope.
 * Owners bypass all grant checks.
 * Throws ProtocolError if insufficient permission.
 */
export declare function requireGrant(actorId: string, operation: keyof Grant['capabilities'], scope: string, config: SmartwareConfig): void;
/**
 * Require that the actor is the owner.
 * Throws ProtocolError if not.
 */
export declare function requireOwner(actorId: string, config: SmartwareConfig): void;
/**
 * Resolve the actor's grant (or null if no grant exists).
 * Note: for owners, returns null (they bypass grant checks anyway).
 */
export declare function resolveGrant(actorId: string, config: SmartwareConfig): Grant | null;
/**
 * Spec-conformant ACCESS decision per Protocol Contract v0.4.1 + Errors and
 * Recovery v0.1.1. Returns a structured allow/deny rather than throwing,
 * so the /pod/access route can surface the same envelope ACCESS expects.
 *
 *   - Owner → allow (AC-01)
 *   - Registered actor with required capability covering scope → allow (AC-02)
 *   - Registered actor outside capability or scope → deny (AC-03, AC-05)
 *   - Unregistered actor → deny with code `actor_unregistered` (AC-04)
 *
 * `forbidden` is a generic deny; `actor_unregistered` is its more-specific
 * counterpart for the no-grant case so consumers can surface the right UX.
 */
export type AccessOperation = keyof Grant['capabilities'];
export interface AccessDecision {
    decision: 'allow' | 'deny';
    reason: string;
    /** Spec error code when deny; undefined when allow. */
    code?: 'forbidden' | 'actor_unregistered';
}
/**
 * Reject writes from unregistered actors. An actor is registered if they
 * are the owner or have any active grant. Throws ProtocolError with code
 * `actor_unregistered` if not.
 */
export declare function requireRegisteredActor(actorId: string, config: SmartwareConfig): void;
export declare function evaluateAccess(actorId: string, operation: AccessOperation, scope: string, config: SmartwareConfig): AccessDecision;
//# sourceMappingURL=middleware.d.ts.map