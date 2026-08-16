import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { DEFAULT_WORKSPACE_ID, getDb, upsertCollection, upsertObject, insertEvent } from '../pod/db.js';
import type { PodEventBody } from '../pod/types.js';
import { ensureAppDataSpace } from '../pod/data-spaces.js';
import { requireActorAuth } from '../security/auth.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { resolveObservationDefaults, resolveReflectionModelUse } from '../services/memory-settings.js';
import { ensureWorkspaceScope, requestWorkspaceId } from './workspaces.js';
import { syncArtifactMemory } from '../services/artifact-memory.js';

function normaliseId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9:_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function eventTitle(body: PodEventBody): string {
  return body.object?.title ?? `${body.source_app} ${body.event_type}`;
}

function observationType(eventType: string): 'message' | 'file' | 'decision' | 'tool_output' | 'system' {
  if (/\b(file|document|doc|upload)\b/i.test(eventType)) return 'file';
  if (/\b(decision|decided)\b/i.test(eventType)) return 'decision';
  if (/\b(message|chat|email|note|meeting)\b/i.test(eventType)) return 'message';
  if (/\b(agent|tool|workflow|session)\b/i.test(eventType)) return 'tool_output';
  return 'system';
}

export async function registerEventRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);

  app.post('/pod/events', {
    schema: {
      summary: 'Ingest a generic app event into Pod memory',
      body: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          source_app: { type: 'string' },
          event_type: { type: 'string' },
          object: { type: 'object' },
          text: { type: 'string' },
          scope: { type: 'string' },
          scope_alias: { type: 'string' },
          collection_id: { type: 'string' },
          memory_policy: { type: 'object' },
        },
        required: ['actor_id', 'source_app', 'event_type'],
      },
    },
  }, async (request, reply) => {
    const body = request.body as PodEventBody;
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;

    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const workspaceId = requestWorkspaceId(request);
    const workspaceScope = ensureWorkspaceScope(core, env, workspaceId);
    const appSpace = ensureAppDataSpace(core, env, body.source_app);
    const memoryPolicy = resolveObservationDefaults(db, {
      visibility: body.memory_policy?.visibility,
      sensitive: body.memory_policy?.sensitive,
    });
    const scopeAlias = body.scope_alias ?? (workspaceId === DEFAULT_WORKSPACE_ID ? appSpace.id : 'workspace');
    const scope = body.scope ?? (scopeAlias === 'workspace' ? workspaceScope : profile.scopes[scopeAlias]) ?? appSpace.scope;
    const baseCollectionId = body.collection_id ?? normaliseId(body.source_app);
    const collectionId = workspaceId === DEFAULT_WORKSPACE_ID ? baseCollectionId : `${workspaceId}:${baseCollectionId}`;
    const objectId = body.object?.id
      ? `${workspaceId === DEFAULT_WORKSPACE_ID ? '' : `${workspaceId}:`}${normaliseId(body.source_app)}:${body.object.id}`
      : `${workspaceId === DEFAULT_WORKSPACE_ID ? '' : `${workspaceId}:`}${normaliseId(body.source_app)}:${normaliseId(body.event_type)}:${Date.now()}`;

    const collection = upsertCollection(db, {
      id: collectionId,
      workspace_id: workspaceId,
      name: body.source_app,
      description: `Objects and events from ${body.source_app}.`,
      metadata: { app: body.source_app },
    });

    const object = upsertObject(db, {
      id: objectId,
      workspace_id: workspaceId,
      collection_id: collection.id,
      kind: body.object?.kind ?? body.event_type,
      title: eventTitle(body),
      content: body.object?.content ?? { text: body.text ?? '', event_type: body.event_type },
      source: {
        app: body.source_app,
        external_id: body.object?.id,
        url: body.object?.url,
      },
      metadata: {
        event_type: body.event_type,
        ...(body.object?.metadata ?? {}),
      },
      sensitive: memoryPolicy.sensitive,
    });

    // Persist to events table
    insertEvent(db, {
      workspace_id: workspaceId,
      type: body.event_type,
      process: 'observe',
      actor_id: body.actor_id,
      scope: scopeAlias,
      title: eventTitle(body),
      detail: body.text,
      content: { source_app: body.source_app, object_id: object.id },
    });

    const legacySourceId = `pod-event:${object.id}`;
    const observation = await syncArtifactMemory({
      db,
      core,
      object,
      actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
      type: observationType(body.event_type),
      scope,
      content: {
        format: 'application/json',
        body: {
          source_app: body.source_app,
          event_type: body.event_type,
          object,
          text: body.text ?? '',
        },
      },
      visibility: memoryPolicy.visibility,
      sensitive: memoryPolicy.sensitive,
      app: body.source_app,
      legacy_sources: [{ app: body.source_app, source_id: legacySourceId }],
    });

    const shouldExtract = body.memory_policy?.extract !== false;
    if (shouldExtract) {
      void core.compile({
        actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
        scope,
        use_llm: resolveReflectionModelUse(db, body.memory_policy?.use_llm),
      }).then(result => {
        for (const entry of result.audit) {
          insertEvent(db, {
            workspace_id: workspaceId,
            type: 'entity_compiled',
            process: 'reflect',
            actor_id: body.actor_id,
            scope: scopeAlias,
            title: entry.entity_name,
            detail: `Extracted from ${body.source_app} · ${entry.claims_used} claim${entry.claims_used !== 1 ? 's' : ''}`,
            content: { entity_id: entry.entity_id, claims_used: entry.claims_used, source_app: body.source_app },
          });
        }
      }).catch(error => {
        app.log.warn({ error, scope, object_id: object.id }, 'background extraction failed');
      });
    }

    return {
      event: {
        source_app: body.source_app,
        event_type: body.event_type,
        extraction: shouldExtract ? 'queued' : 'skipped',
      },
      collection,
      object,
      observation,
    };
  });
}
