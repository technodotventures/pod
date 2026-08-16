import type { Actor } from '../layer0/types.js';
import type { Layer0Index } from '../layer0/index.js';
import type { ClaimStore } from '../layer1/store.js';
import type { SearchIndex } from '../layer3/search.js';
import type { SmartwareConfig } from '../config.js';
export interface StatusParams {
    actor: Actor;
}
export interface StatusResult {
    instance_id: string;
    version: string;
    layer0: {
        total: number;
        by_status: Record<string, number>;
        last_sequence: number;
    };
    layer1: {
        claims: number;
        entities: number;
        last_replayed_sequence: number;
    };
    layer2: {
        pages: number;
    };
    layer3: {
        indexed: number;
    };
    grants: number;
}
export declare function handleStatus(params: StatusParams, layer0: Layer0Index, store: ClaimStore, searchIndex: SearchIndex, wikiDir: string, config: SmartwareConfig): Promise<StatusResult>;
//# sourceMappingURL=status.d.ts.map