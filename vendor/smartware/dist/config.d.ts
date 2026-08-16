import type { ActorType } from './layer0/types.js';
export interface ScopeEntry {
    id: string;
    parent: string | null;
    visibility_default: 'private' | 'scope' | 'workspace' | 'public';
}
export interface Grant {
    id: string;
    actor_type: ActorType;
    actor_id: string;
    capabilities: {
        observe: string[];
        query: string[];
        compile: string[];
        correct: string[];
        forget: string[];
        read: string[];
    };
    trusted: boolean;
    quarantine: boolean;
    created_at: string;
    expires_at: string | null;
    status: 'active' | 'revoked';
}
export interface SmartwareConfig {
    instance_id: string;
    owner_id: string;
    writer_id: string;
    version: string;
    data_dir: string;
    scopes: ScopeEntry[];
    grants: Grant[];
    llm: {
        provider: 'anthropic' | 'openai' | 'openrouter' | 'none';
        model: string;
    };
    staleness: {
        default_half_life_days: number;
        scope_overrides: Record<string, number>;
        stale_threshold: number;
    };
    entity_resolution?: {
        /** Score at or above this → auto-merge (default 0.92) */
        auto_merge_threshold: number;
        /** Score at or above this but below auto_merge → borderline band (default 0.85) */
        borderline_threshold: number;
        /** If true and LLM is available, borderline matches call LLM to disambiguate (default true) */
        llm_disambiguate: boolean;
    };
}
export declare function loadConfig(dataDir: string): SmartwareConfig;
export declare function saveConfig(dataDir: string, config: SmartwareConfig): void;
export declare function createDefaultConfig(dataDir: string): SmartwareConfig;
export declare function getDataDir(): string;
//# sourceMappingURL=config.d.ts.map