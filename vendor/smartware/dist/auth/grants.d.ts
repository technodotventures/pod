import type { Grant, SmartwareConfig } from '../config.js';
import type { ActorType } from '../layer0/types.js';
export type { Grant };
/**
 * Spec-conformant ActorId pattern per common.schema.json:
 *   ^(user|agent|sidecar|substrate):[a-z0-9-]+$
 *
 * Pre-PR-5 actor IDs (e.g. `person-local`, `coffee:<client-id>`,
 * `google-drive:connector`) do NOT match. The substrate accepts both
 * shapes during the migration window; PR-A4-alias-map (deferred) will
 * resolve legacy IDs through the alias map.
 */
export declare const ACTOR_ID_PATTERN: RegExp;
export declare function isSpecConformantActorId(actorId: string): boolean;
export declare function isExpired(grant: Grant): boolean;
export declare function getActiveGrants(config: SmartwareConfig): Grant[];
export declare function checkGrant(actorId: string, operation: keyof Grant['capabilities'], scope: string, config: SmartwareConfig): boolean;
/** Owner can do anything */
export declare function isOwner(actorId: string, config: SmartwareConfig): boolean;
export declare function createGrant(dataDir: string, input: {
    actor_type: ActorType;
    actor_id: string;
    capabilities: Grant['capabilities'];
    trusted?: boolean;
    quarantine?: boolean;
    expires_at?: string | null;
}): Grant;
export declare function revokeGrant(dataDir: string, grantId: string): boolean;
export declare function getGrantForActor(actorId: string, config: SmartwareConfig): Grant | null;
/** All active grants that authorise `operation` on `scope` for this actor. */
export declare function getAuthorizingGrants(actorId: string, operation: keyof Grant['capabilities'], scope: string, config: SmartwareConfig): Grant[];
//# sourceMappingURL=grants.d.ts.map