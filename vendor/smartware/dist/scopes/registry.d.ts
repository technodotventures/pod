import type { SmartwareConfig, ScopeEntry } from '../config.js';
export type { ScopeEntry };
export declare class ScopeRegistry {
    private scopes;
    constructor(config: SmartwareConfig);
    get(id: string): ScopeEntry | undefined;
    getAll(): ScopeEntry[];
    getParent(id: string): ScopeEntry | null;
    /** Return the full ancestor chain including the scope itself */
    getAncestors(id: string): string[];
    /** Check if targetScope is in the ancestor chain of queryScope */
    isAncestorOf(ancestor: string, descendant: string): boolean;
    /** Visibility default for a scope */
    getVisibilityDefault(id: string): ScopeEntry['visibility_default'];
}
//# sourceMappingURL=registry.d.ts.map