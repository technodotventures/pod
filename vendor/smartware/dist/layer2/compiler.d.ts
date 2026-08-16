import type { Observation } from '../layer0/types.js';
import type { Layer0Index } from '../layer0/index.js';
import type { ClaimStore } from '../layer1/store.js';
import type { SmartwareConfig } from '../config.js';
import type { CompiledPage, CompilationAudit, CompileTelemetry } from './types.js';
import type { SearchIndex } from '../layer3/search.js';
export interface CompileOptions {
    scope?: string;
    entityId?: string;
    useLLM?: boolean;
}
export interface CompileResult {
    pages: CompiledPage[];
    audit: CompilationAudit[];
    telemetry: CompileTelemetry;
    gitSha?: string;
}
export declare function isContextOnlyObservation(obs: Observation, contextClaimIds: Set<string>): boolean;
export declare function compile(evidenceDir: string, wikiDir: string, layer0: Layer0Index, store: ClaimStore, config: SmartwareConfig, options?: CompileOptions, searchIndex?: SearchIndex): Promise<CompileResult>;
//# sourceMappingURL=compiler.d.ts.map