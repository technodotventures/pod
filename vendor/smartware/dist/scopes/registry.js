// Scopes — Scope registry with parent hierarchy
export class ScopeRegistry {
    scopes;
    constructor(config) {
        this.scopes = new Map(config.scopes.map(s => [s.id, s]));
    }
    get(id) {
        return this.scopes.get(id);
    }
    getAll() {
        return [...this.scopes.values()];
    }
    getParent(id) {
        const entry = this.scopes.get(id);
        if (!entry?.parent)
            return null;
        return this.scopes.get(entry.parent) ?? null;
    }
    /** Return the full ancestor chain including the scope itself */
    getAncestors(id) {
        const chain = [];
        let current = id;
        while (current) {
            chain.push(current);
            const entry = this.scopes.get(current);
            current = entry?.parent ?? null;
        }
        return chain;
    }
    /** Check if targetScope is in the ancestor chain of queryScope */
    isAncestorOf(ancestor, descendant) {
        return this.getAncestors(descendant).includes(ancestor);
    }
    /** Visibility default for a scope */
    getVisibilityDefault(id) {
        return this.scopes.get(id)?.visibility_default ?? 'scope';
    }
}
//# sourceMappingURL=registry.js.map