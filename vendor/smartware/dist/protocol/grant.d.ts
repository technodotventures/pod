import type { Actor } from '../layer0/types.js';
import type { Layer0Index } from '../layer0/index.js';
import type { SmartwareConfig } from '../config.js';
import type { Grant } from '../auth/grants.js';
export interface GrantParams {
    actor: Actor;
    grant_actor_id: string;
    grant_actor_type: 'person' | 'agent' | 'system';
    capabilities: Grant['capabilities'];
    trusted?: boolean;
    quarantine?: boolean;
    expires_at?: string | null;
}
export interface GrantResult {
    grant_id: string;
    status: 'granted';
}
export declare function handleGrant(params: GrantParams, evidenceDir: string, layer0: Layer0Index, config: SmartwareConfig, dataDir: string): Promise<GrantResult>;
//# sourceMappingURL=grant.d.ts.map