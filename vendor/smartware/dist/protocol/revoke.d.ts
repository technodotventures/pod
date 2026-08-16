import type { Actor } from '../layer0/types.js';
import type { Layer0Index } from '../layer0/index.js';
import type { SmartwareConfig } from '../config.js';
export interface RevokeParams {
    actor: Actor;
    grant_id: string;
    reason?: string;
}
export interface RevokeResult {
    grant_id: string;
    status: 'revoked';
}
export declare function handleRevoke(params: RevokeParams, evidenceDir: string, layer0: Layer0Index, config: SmartwareConfig, dataDir: string): Promise<RevokeResult>;
//# sourceMappingURL=revoke.d.ts.map