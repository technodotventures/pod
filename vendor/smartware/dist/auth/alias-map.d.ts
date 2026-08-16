export interface AliasEntry {
    legacy_id: string;
    spec_id: string;
    since: string;
    /** Optional free-text rationale. */
    reason?: string;
}
/** Read the alias map into an in-memory `legacy → spec` lookup. */
export declare function loadAliasMap(dataDir: string): Map<string, string>;
/**
 * Append a new alias entry. Idempotent on (legacy_id, spec_id): re-appending
 * the same pair adds a duplicate line; resolveActorId returns the last one.
 */
export declare function appendAlias(dataDir: string, entry: Omit<AliasEntry, 'since'> & {
    since?: string;
}): AliasEntry;
/**
 * Translate an actor id through the alias map. Returns the spec-conformant
 * id if a mapping exists; otherwise returns the input unchanged.
 */
export declare function resolveActorId(map: Map<string, string>, actorId: string): string;
/**
 * Coffee Pod default aliases. Called from SmartwareCore.open() so existing
 * Pods get the canonical rename mapping without operator intervention.
 *
 * Adding entries here is forward-compatible — running the migration twice
 * just appends duplicate lines, which loadAliasMap collapses on read.
 */
export declare const COFFEE_POD_DEFAULT_ALIASES: Array<{
    legacy: string;
    spec: string;
    reason: string;
}>;
export declare function ensureDefaultAliases(dataDir: string): void;
//# sourceMappingURL=alias-map.d.ts.map