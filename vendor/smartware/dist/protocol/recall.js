// Protocol — RECALL handler (spec verb; formerly QUERY)
import { assembleContext } from '../layer4/assembly.js';
import { ProtocolError } from '../auth/middleware.js';
import { requireSessionCapability, resolveActorFromSession } from './session.js';
export function recallMinimumConfidence(value) {
    if (typeof value === 'number')
        return value;
    if (value === 'high')
        return 0.7;
    if (value === 'medium')
        return 0.4;
    if (value === 'low')
        return 0;
    return undefined;
}
export async function handleQuery(params, store, searchIndex, config, registry, sessionStore) {
    if (!params.query?.trim() && !params.temporal) {
        throw new ProtocolError('invalid_query', 'Query string is required');
    }
    if (!params.scope) {
        throw new ProtocolError('invalid_scope', 'Scope is required');
    }
    if (params.as_of !== undefined) {
        throw new ProtocolError('invalid_payload', 'as_of is reserved for post-beta temporal recall');
    }
    const minConfidence = recallMinimumConfidence(params.min_confidence);
    let actorId = params.actor.id;
    if (params.session_id) {
        if (!sessionStore) {
            throw new ProtocolError('internal_error', 'SessionStore required for session-authenticated recall');
        }
        const resolved = resolveActorFromSession(params.session_id, sessionStore);
        if (!resolved) {
            throw new ProtocolError('session_not_found', `Session '${params.session_id}' not found`);
        }
        if (resolved.effective_policy.read_mode === 'off') {
            throw new ProtocolError('read_disabled', 'Session policy does not allow reads');
        }
        requireSessionCapability(resolved, 'query', params.scope);
        actorId = resolved.actor_id;
    }
    const filters = {
        minConfidence,
        epistemic: params.epistemic,
        epistemicTags: params.epistemic_tags,
        entityType: params.entity_type,
        includeSensitive: params.include_sensitive ?? false,
        includeStale: params.include_stale ?? false,
        includeSuperseded: params.include_superseded ?? false,
        includeForgotten: params.include_forgotten ?? false,
        temporal: params.temporal,
        limit: params.limit ?? 20,
    };
    const assembled = assembleContext(params.query, params.scope, actorId, searchIndex, store, config, registry, filters);
    const results = assembled.results.map(r => ({
        entity_id: r.entity_id,
        entity_name: r.entity_name,
        scope: r.scope,
        score: r.score,
        signals: r.signals,
        claim: r.claim
            ? {
                id: r.claim.id,
                predicate: r.claim.predicate,
                object: r.claim.object,
                epistemic: r.claim.epistemic,
                confidence: r.claim.confidence,
                status: r.claim.status,
                observation_ids: [...r.claim.supporting_evidence],
                valid_at: r.claim.t_valid_from.value,
                invalid_at: r.claim.t_valid_to.value,
                recorded_at: r.claim.t_ingested.value,
                invalidated_at: r.claim.t_invalidated.value,
            }
            : undefined,
    }));
    return {
        results,
        total_found: assembled.total_found,
        filtered_out: assembled.filtered_out,
        query_scope: assembled.query_scope,
    };
}
export { handleQuery as handleRecall };
//# sourceMappingURL=recall.js.map