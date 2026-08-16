import type { TrustLevel, EffectivePolicy, ClientCapabilities } from './types.js';
import type { SmartwareConfig } from '../config.js';
export interface TrustResolution {
    effective_trust_level: TrustLevel;
    effective_policy: EffectivePolicy;
    actor_id: string;
    capabilities_granted: string[];
    expires_at: string;
    downgrade_reason?: string;
}
/**
 * Resolve the effective trust level and policy for a session start request.
 *
 * Rules:
 * 1. Owner with declared "verified" → verified (full access)
 * 2. Actor with trusted grant + declared "verified"/"user_facing" → honour declaration
 * 3. Actor with grant but not trusted → cap at "user_facing"
 * 4. Actor with no grant → downgrade to "untrusted"
 * 5. Unknown actor claiming "verified" without proof → "untrusted"
 */
export declare function resolveTrust(clientId: string, declaredTrust: TrustLevel, declaredCapabilities: ClientCapabilities, actorId: string, requestedScopes: string[], config: SmartwareConfig): TrustResolution;
export declare function getSessionDurationHours(level: TrustLevel): number;
//# sourceMappingURL=policy.d.ts.map