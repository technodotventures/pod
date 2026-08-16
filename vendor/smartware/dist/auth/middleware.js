// Auth — Per-tool auth check middleware
import { checkGrant, isOwner, getGrantForActor } from './grants.js';
export class ProtocolError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'ProtocolError';
    }
}
/**
 * Require a grant for an operation on a scope.
 * Owners bypass all grant checks.
 * Throws ProtocolError if insufficient permission.
 */
export function requireGrant(actorId, operation, scope, config) {
    if (isOwner(actorId, config))
        return;
    if (!checkGrant(actorId, operation, scope, config)) {
        throw new ProtocolError('insufficient_permission', `Actor '${actorId}' does not have '${operation}' permission for scope '${scope}'`);
    }
}
/**
 * Require that the actor is the owner.
 * Throws ProtocolError if not.
 */
export function requireOwner(actorId, config) {
    if (!isOwner(actorId, config)) {
        throw new ProtocolError('owner_required', `This operation requires owner privileges. Actor '${actorId}' is not the owner.`);
    }
}
/**
 * Resolve the actor's grant (or null if no grant exists).
 * Note: for owners, returns null (they bypass grant checks anyway).
 */
export function resolveGrant(actorId, config) {
    if (isOwner(actorId, config))
        return null;
    return getGrantForActor(actorId, config);
}
/**
 * Reject writes from unregistered actors. An actor is registered if they
 * are the owner or have any active grant. Throws ProtocolError with code
 * `actor_unregistered` if not.
 */
export function requireRegisteredActor(actorId, config) {
    if (isOwner(actorId, config))
        return;
    if (!getGrantForActor(actorId, config)) {
        throw new ProtocolError('actor_unregistered', `Actor '${actorId}' is not registered with this Pod.`);
    }
}
export function evaluateAccess(actorId, operation, scope, config) {
    if (isOwner(actorId, config)) {
        return { decision: 'allow', reason: 'Pod owner bypasses grant checks.' };
    }
    const grant = getGrantForActor(actorId, config);
    if (!grant) {
        return {
            decision: 'deny',
            reason: `Actor '${actorId}' is not registered with this Pod.`,
            code: 'actor_unregistered',
        };
    }
    if (!checkGrant(actorId, operation, scope, config)) {
        const granted = grant.capabilities[operation] ?? [];
        return {
            decision: 'deny',
            reason: granted.length === 0
                ? `Actor '${actorId}' has no '${operation}' capability.`
                : `Actor '${actorId}' has '${operation}' capability but not for scope '${scope}'.`,
            code: 'forbidden',
        };
    }
    return { decision: 'allow', reason: `Grant ${grant.id} authorises '${operation}' on '${scope}'.` };
}
//# sourceMappingURL=middleware.js.map