// Scopes — Personal preference exports
/**
 * Determine whether a claim in fromScope is visible to a query from toScope,
 * based on export rules.
 */
export function isExported(fromScope, toScope, predicate, config) {
    if (fromScope === toScope)
        return true;
    // Check if the scope visibility allows cross-scope access
    const scopeEntry = config.scopes.find(s => s.id === fromScope);
    if (!scopeEntry)
        return false;
    // Private scopes are never exported unless explicitly configured
    if (scopeEntry.visibility_default === 'private')
        return false;
    if (scopeEntry.visibility_default === 'public')
        return true;
    // Workspace/scope: accessible within the same parent
    // For MVP, use simple parent matching
    return false;
}
/**
 * Check if the effective visibility of a claim allows it to be returned
 * to an actor querying from a given scope.
 */
export function isVisibleToActor(claimScope, claimVisibility, querierScope, config) {
    if (claimScope === querierScope)
        return true;
    if (claimVisibility === 'public')
        return true;
    if (claimVisibility === 'private')
        return false;
    const scopeEntry = config.scopes.find(s => s.id === claimScope);
    if (!scopeEntry)
        return false;
    if (claimVisibility === 'workspace' || claimVisibility === 'scope') {
        // Check if they share a workspace parent
        const querierEntry = config.scopes.find(s => s.id === querierScope);
        if (!querierEntry)
            return false;
        // Same parent = siblings
        if (scopeEntry.parent && scopeEntry.parent === querierEntry.parent)
            return true;
        // Direct parent/child
        if (scopeEntry.parent === querierScope || querierEntry.parent === claimScope)
            return true;
    }
    return false;
}
//# sourceMappingURL=exports.js.map