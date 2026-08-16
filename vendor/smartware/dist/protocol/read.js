// Protocol — READ handler (returns compiled page content)
//
// Two modes:
//   1. Entity read — given entity_id or entity_name, return the compiled page
//   2. Scope browse — given scope (no entity_id), list all entities in that scope
import fs from 'fs';
import path from 'path';
import { parseFrontmatter } from '../layer2/frontmatter.js';
import { requireGrant, ProtocolError } from '../auth/middleware.js';
import { isOwner } from '../auth/grants.js';
import { requireSessionCapability, resolveActorFromSession } from './session.js';
export async function handleRead(params, wikiDir, config, store, sessionStore) {
    let actorId = params.actor.id;
    if (params.session_id) {
        if (!sessionStore) {
            throw new ProtocolError('internal_error', 'SessionStore required for session-authenticated read');
        }
        const resolved = resolveActorFromSession(params.session_id, sessionStore);
        if (!resolved) {
            throw new ProtocolError('session_not_found', `Session '${params.session_id}' not found`);
        }
        if (resolved.effective_policy.read_mode === 'off') {
            throw new ProtocolError('read_disabled', 'Session policy does not allow reads');
        }
        const requestedScope = params.scope ?? resolveEntityScope(params, wikiDir, store);
        requireSessionCapability(resolved, 'read', requestedScope);
        actorId = resolved.actor_id;
    }
    // ── Mode 2: Scope browse ──────────────────────────────────────────────
    if (!params.entity_id && !params.entity_name && params.scope) {
        if (!store) {
            throw new ProtocolError('internal_error', 'ClaimStore required for scope browse');
        }
        requireGrant(actorId, 'read', params.scope, config);
        return browseScopeEntities(params.scope, store, wikiDir, params.include_sensitive ?? false, config, actorId);
    }
    // ── Mode 1: Entity read ──────────────────────────────────────────────
    // Resolve entity by name if entity_id not provided
    let entityId = params.entity_id;
    if (!entityId && params.entity_name && store) {
        const entity = store.findEntityByName(params.entity_name, params.scope);
        if (!entity) {
            throw new ProtocolError('not_found', `No entity found with name '${params.entity_name}'${params.scope ? ` in scope '${params.scope}'` : ''}`);
        }
        entityId = entity.id;
    }
    if (!entityId) {
        throw new ProtocolError('invalid_params', 'Either entity_id, entity_name, or scope is required');
    }
    // Find the page file for this entity
    const pagePath = findEntityPage(wikiDir, entityId);
    if (!pagePath) {
        throw new ProtocolError('not_found', `No compiled page found for entity '${entityId}'`);
    }
    const raw = fs.readFileSync(pagePath, 'utf-8');
    const parsed = parseFrontmatter(raw);
    if (!parsed) {
        throw new ProtocolError('parse_error', `Could not parse frontmatter for '${entityId}'`);
    }
    const { frontmatter, body } = parsed;
    // Check grant on the page's scope
    requireGrant(actorId, 'read', frontmatter.scope, config);
    // Sensitive pages: explicit opt-in required even for the owner. Non-owners
    // are never permitted, regardless of the flag.
    if (frontmatter.sensitive) {
        if (!isOwner(actorId, config)) {
            throw new ProtocolError('sensitive', 'This page is sensitive. Access requires owner privileges.');
        }
        if (!params.include_sensitive) {
            throw new ProtocolError('sensitive_opt_in_required', 'This page is sensitive. Pass include_sensitive=true to read it.');
        }
    }
    // Return content at requested resolution
    let content;
    const lines = body.split('\n');
    switch (params.resolution ?? 'full') {
        case 'oneliner': {
            // First non-empty line after frontmatter
            content = lines.find(l => l.trim() !== '') ?? '';
            break;
        }
        case 'paragraph': {
            // First paragraph (up to first blank line after content starts)
            const startIdx = lines.findIndex(l => l.trim() !== '');
            if (startIdx === -1) {
                content = '';
                break;
            }
            const endIdx = lines.findIndex((l, i) => i > startIdx + 1 && l.trim() === '');
            content = lines.slice(startIdx, endIdx === -1 ? startIdx + 5 : endIdx).join('\n');
            break;
        }
        default:
            content = body.trim();
    }
    return {
        entity_id: frontmatter.entity_id,
        entity_name: frontmatter.entity,
        scope: frontmatter.scope,
        content,
        sensitive: frontmatter.sensitive,
        compiled_at: frontmatter.compiled_at,
        confidence: frontmatter.confidence,
    };
}
function resolveEntityScope(params, wikiDir, store) {
    let entityId = params.entity_id;
    if (!entityId && params.entity_name && store) {
        entityId = store.findEntityByName(params.entity_name, params.scope)?.id;
    }
    if (!entityId) {
        throw new ProtocolError('invalid_params', 'A scope is required for session-authenticated reads by name');
    }
    const pagePath = findEntityPage(wikiDir, entityId);
    if (!pagePath) {
        throw new ProtocolError('not_found', `No compiled page found for entity '${entityId}'`);
    }
    const parsed = parseFrontmatter(fs.readFileSync(pagePath, 'utf-8'));
    if (!parsed) {
        throw new ProtocolError('parse_error', `Could not parse frontmatter for '${entityId}'`);
    }
    return parsed.frontmatter.scope;
}
// ── Scope browse ────────────────────────────────────────────────────────────
function browseScopeEntities(scope, store, wikiDir, includeSensitive, config, actorId) {
    const entities = store.getAllEntities(scope);
    const results = [];
    for (const entity of entities) {
        const claims = store.getActiveClaims(entity.scope)
            .filter(c => c.subject_id === entity.id && c.status === 'active');
        if (claims.length === 0)
            continue;
        // Sensitive entities require the opt-in flag AND owner privileges — mirror
        // the entity-read and query gates. A non-owner must never see them, even
        // with include_sensitive=true.
        const sensitive = claims.some(c => c.sensitive);
        if (sensitive && (!includeSensitive || !isOwner(actorId, config)))
            continue;
        const confidence = claims.reduce((sum, c) => sum + c.confidence, 0) / claims.length;
        // Try to read oneliner from compiled page
        let oneliner = '';
        const pagePath = findEntityPage(wikiDir, entity.id);
        if (pagePath) {
            try {
                const raw = fs.readFileSync(pagePath, 'utf-8');
                const parsed = parseFrontmatter(raw);
                if (parsed) {
                    const lines = parsed.body.split('\n');
                    oneliner = lines.find(l => l.trim() !== '') ?? '';
                }
            }
            catch { /* skip if page unreadable */ }
        }
        // Fallback oneliner from claims
        if (!oneliner) {
            const nameClaim = claims.find(c => c.predicate === 'name_is' || c.predicate === 'description_is');
            if (nameClaim && typeof nameClaim.object.value === 'string') {
                oneliner = nameClaim.object.value;
            }
            else {
                oneliner = `${entity.type}: ${entity.canonical_name}`;
            }
        }
        results.push({
            entity_id: entity.id,
            entity_name: entity.canonical_name,
            type: entity.type,
            claim_count: claims.length,
            confidence: Math.round(confidence * 1000) / 1000,
            oneliner,
        });
    }
    // Sort by claim count descending (most claims = most important)
    results.sort((a, b) => b.claim_count - a.claim_count);
    return {
        scope,
        entities: results,
        total: results.length,
    };
}
// ── Helpers ─────────────────────────────────────────────────────────────────
function findEntityPage(wikiDir, entityId) {
    const search = (dir) => {
        if (!fs.existsSync(dir))
            return null;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                const found = search(path.join(dir, entry.name));
                if (found)
                    return found;
            }
            else if (entry.name.endsWith('.md')) {
                const p = path.join(dir, entry.name);
                const raw = fs.readFileSync(p, 'utf-8');
                if (raw.includes(`entity_id: ${entityId}`))
                    return p;
            }
        }
        return null;
    };
    return search(wikiDir);
}
//# sourceMappingURL=read.js.map