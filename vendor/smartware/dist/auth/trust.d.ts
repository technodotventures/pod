import type { Actor } from '../layer0/types.js';
import type { Grant } from './grants.js';
/**
 * Determine whether an observation from this actor should be quarantined.
 *
 * Rules:
 * - No grant → should never reach here (rejected at middleware), but return true as safety net
 * - grant.quarantine = true → force quarantine
 * - grant.trusted = true → do NOT quarantine
 * - Default: persons and agents are trusted; system actors are quarantined
 */
export declare function shouldQuarantine(_actor: Actor, grant: Grant | null): boolean;
/**
 * Quarantine decision across all grants that authorise a given operation+scope.
 * Using the scope-relevant grants (not an arbitrary "first" grant) stops a
 * trusted grant on one scope from silently trusting observations into another.
 * Precedence: any explicit quarantine → hold; else any trusted → accept; else
 * default by recorded actor type. Empty set → hold (safety net).
 */
export declare function quarantineForGrants(grants: Grant[]): boolean;
/**
 * Determine if the actor is allowed to bypass a minimum confidence threshold.
 * Owners and trusted actors can query lower-confidence claims.
 */
export declare function canQueryLowConfidence(grant: Grant | null): boolean;
//# sourceMappingURL=trust.d.ts.map