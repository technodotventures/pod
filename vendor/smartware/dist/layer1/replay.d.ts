import type { Layer0Index } from '../layer0/index.js';
import type { ClaimStore } from './store.js';
import type { SmartwareConfig } from '../config.js';
export declare function replayAll(evidenceDir: string, layer0: Layer0Index, store: ClaimStore, config?: SmartwareConfig): Promise<void>;
export declare function replayCatchUp(evidenceDir: string, store: ClaimStore, layer0?: Layer0Index, config?: SmartwareConfig): Promise<void>;
//# sourceMappingURL=replay.d.ts.map