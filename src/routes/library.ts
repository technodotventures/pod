import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { SmartwarePodProfile } from 'smartware';

import type { CoffeePodEnv } from '../config/env.js';
import { requireActorAuth, requireOwnerAuth } from '../security/auth.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { agentCanAccessResolvedScope } from '../pod/agent-access.js';
import { resolveObservationDefaults, resolveReflectionModelUse } from '../services/memory-settings.js';
import { retireArtifactMemory, syncArtifactMemory } from '../services/artifact-memory.js';
import { ensureWorkspaceScope, requestWorkspaceId } from './workspaces.js';
import {
  buildKnowledgeGraphProjection,
  MAX_GRAPH_OBJECT_LIMIT,
  parseGraphObjectLimit,
  parseGraphProjectionMode,
  projectGraphAnnotation,
} from '../pod/knowledge-graph.js';
import {
  DEFAULT_WORKSPACE_ID,
  createGraphAnnotation,
  deleteGraphAnnotation,
  getDb,
  getAgent,
  getObject,
  listCollections,
  listObjects,
  countObjects,
  countBacklinks,
  upsertCollection,
  upsertObject,
  deleteObject,
  patchObject,
  patchCollection,
  deleteCollection,
  listEvents,
  setAttentionEventsDismissed,
  listImports,
  listBacklinks,
  listOutboundReferences,
  listSavedViews,
  upsertSavedView,
  deleteSavedView,
  listTags,
} from '../pod/db.js';

function rejectAgentLibraryRead(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.coffeePodAuth?.kind !== 'agent') return false;
  reply.code(403).send({
    error: 'scoped_memory_required',
    message: 'Agents must read memory through the scoped context or query API.',
  });
  return true;
}

function requireAgentLibraryWrite(
  db: ReturnType<typeof getDb>,
  actorId: string,
  profile: SmartwarePodProfile,
  scope: string,
  reply: FastifyReply,
): boolean {
  const agent = getAgent(db, actorId);
  if (!agent || agentCanAccessResolvedScope(agent, 'write', profile, scope)) return true;
  reply.code(403).send({
    error: 'no_scope_access',
    message: `Agent "${agent.name}" cannot add memory to this area.`,
  });
  return false;
}

const ENTITY_BUCKETS = [
  { id: 'people', label: 'People', types: new Set(['person']) },
  { id: 'organizations', label: 'Organizations / Companies', types: new Set(['organisation', 'organization', 'company']) },
  { id: 'projects', label: 'Projects', types: new Set(['project']) },
  { id: 'topics', label: 'Topics', types: new Set(['concept', 'topic']) },
  { id: 'tasks', label: 'Tasks', types: new Set(['task']) },
  { id: 'events', label: 'Events / Meetings', types: new Set(['event', 'meeting']) },
  { id: 'locations', label: 'Locations', types: new Set(['location']) },
  { id: 'goals', label: 'Goals', types: new Set(['goal']) },
  { id: 'documents', label: 'Documents', types: new Set(['document']) },
] as const;

function serializeObjectForMemory(db: ReturnType<typeof getDb>, object: ReturnType<typeof getObject> extends infer T ? NonNullable<T> : never) {
  return {
    ...object,
    source: {
      app: object.source_app,
      external_id: object.source_external_id,
      url: object.source_url,
    },
    backlink_count: countBacklinks(db, object.id),
  };
}

function inferPreview(object: ReturnType<typeof getObject> extends infer T ? NonNullable<T> : never): string {
  if (object.summary) return object.summary;
  if (typeof object.content === 'string') {
    return object.content.slice(0, 180);
  }
  const text = typeof (object.content as Record<string, unknown> | null)?.['text'] === 'string'
    ? String((object.content as Record<string, unknown>)['text'])
    : '';
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? '';
}

// ─────────────────────────────────────────────────────────────────────
// Wiki-page projection: surface compiled L2 wiki pages as virtual
// PodObject rows inside /pod/objects so the Memories list can show them
// alongside user-authored docs. Read-only — wiki bodies are sourced from
// disk (not pod.db) and labelled origin: 'reflected' (or 'agent-edited'
// once endorsed by user via REVISE).
// ─────────────────────────────────────────────────────────────────────

const WIKI_CATEGORIES = ['concepts', 'entities', 'decisions', 'synthesis', 'profiles'] as const;
const WIKI_COLLECTION_ID = 'wiki';

function parseFrontmatter(text: string): Record<string, string> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1');
    fm[key] = value;
  }
  return fm;
}

function readBody(text: string): string {
  const m = text.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return m ? m[1] : text;
}

/** Normalize a compiled wiki body for client-side markdown rendering:
 *  - strip HTML comments (e.g. `<!-- cached view ... -->`) so they don't
 *    leak as visible text
 *  - ensure a blank line precedes GFM tables, otherwise Plate's markdown
 *    deserializer falls back to paragraph and the pipes render raw
 */
function normalizeWikiBody(body: string): string {
  let out = body;
  // Strip HTML comments (single and multi-line)
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  // Ensure a blank line before any `| ... |` table-start. Match a non-blank
  // preceding line that doesn't itself begin with `|` to avoid touching
  // mid-table rows.
  out = out.replace(/^([^\n|][^\n]*)\n(\|[^\n]*\|)$/gm, '$1\n\n$2');
  // Collapse any 3+ consecutive newlines introduced above
  out = out.replace(/\n{3,}/g, '\n\n');
  return out;
}

/** Parse a frontmatter list like `[a, b, c]` or `[]` into string[]. */
function parseListField(raw: string | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim().replace(/^\[|\]$/g, '').trim();
  if (!trimmed) return [];
  return trimmed.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

interface WikiVirtualObject {
  id: string;
  collection_id: string;
  kind: string;
  title: string;
  summary: string | null;
  origin: 'reflected' | 'agent-edited' | 'written';
  source: { app: string; external_id: string; url: string | null };
  tags: string[];
  created_at: string;
  updated_at: string;
  sensitive: boolean;
  needs_review: boolean;
  backlink_count: number;
  version: number;
  hash_algorithm: string;
  hash_value: string;
  reflection_claim_count: number;
  archived_at: null;
  deleted_at: null;
  processing_state: null;
  sync_status: null;
  last_modified_by: string | null;
  created_origin: 'reflected' | 'agent-edited' | 'written';
  authored_by: string | null;
  scope: string | null;
  confidence: string | null;
  related_to: string[];
  metadata: Record<string, unknown>;
  content: Record<string, unknown>;
}

function listWikiPagesAsObjects(wikiDir: string): WikiVirtualObject[] {
  const out: WikiVirtualObject[] = [];
  for (const category of WIKI_CATEGORIES) {
    const dir = path.join(wikiDir, category);
    if (!existsSync(dir)) continue;
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith('.md') || name === '_index.md') continue;
      const slug = name.replace(/\.md$/, '');
      const filePath = path.join(dir, name);
      let body: string;
      try {
        body = readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }
      const fm = parseFrontmatter(body);
      const pageBody = readBody(body);
      const author = (fm['author'] ?? 'agent') as 'agent' | 'user';
      const endorsedBy = fm['endorsed_by'];
      const compiledAt = fm['compiled_at'] ?? fm['updated'] ?? new Date(0).toISOString();
      const origin: 'reflected' | 'agent-edited' | 'written' =
        author === 'user'
          ? 'written'
          : endorsedBy
            ? 'agent-edited'
            : 'reflected';

      const sources = parseListField(fm['sources']);
      const claimIds = parseListField(fm['claim_ids'] ?? fm['sources_claim_ids']);
      const related = parseListField(fm['related']);
      const supersedes = parseListField(fm['supersedes']);
      // h2 headings in the body, used as "sections" in the page detail handler
      const sectionMatches = pageBody.match(/^##\s+(.+)$/gm) ?? [];
      const sections = sectionMatches.map((h) => h.replace(/^##\s+/, '').trim());

      // Tag dedupe: category is usually plural ("concepts"), fm.type is singular
      // ("concept") — keep category, drop type if it's the singular form of it.
      const fmType = (fm['type'] ?? '').trim();
      const dedupedTags: string[] = [category];
      if (fmType && fmType !== category && `${fmType}s` !== category && fmType !== category.replace(/s$/, '')) {
        dedupedTags.push(fmType);
      }

      // Strip a leading h1 in the body that just repeats the title — the UI
      // already renders title as h1 above the body.
      const titleForCompare = (fm['title'] ?? fm['entity'] ?? slug).trim().toLowerCase();
      const bodyNoDupTitle = pageBody.replace(
        /^\s*#\s+(.+?)\s*$/m,
        (match, captured: string) =>
          captured.trim().toLowerCase() === titleForCompare ? '' : match,
      );
      const bodyNormalized = normalizeWikiBody(bodyNoDupTitle);

      out.push({
        id: fm['page_id'] ?? `wiki:${category}/${slug}`,
        collection_id: WIKI_COLLECTION_ID,
        // Map to existing kinds so MemoryDetailPanel renders rich metadata
        // instead of falling through to the JSON dump. Entities category gets
        // 'entity' (Role/Org/Type/Related); everything else is 'page'.
        kind: category === 'entities' ? 'entity' : 'page',
        title: fm['title'] ?? fm['entity'] ?? slug,
        summary: fm['summary'] || null,
        origin,
        created_origin: origin,
        last_modified_by: endorsedBy ?? fm['compiled_by'] ?? null,
        authored_by: fm['model'] ?? fm['compiled_by'] ?? null,
        scope: fm['scope'] ?? null,
        confidence: fm['confidence'] ?? null,
        related_to: related,
        // Use claim count + supersedes as a coarse backlink count proxy until
        // we wire real cross-page references via /pod/wiki/edges.
        backlink_count: claimIds.length + supersedes.length,
        source: { app: 'smartware-wiki', external_id: `${category}/${slug}`, url: null },
        tags: dedupedTags,
        created_at: compiledAt,
        updated_at: fm['updated'] ?? compiledAt,
        sensitive: fm['sensitive'] === 'true',
        needs_review: false,
        version: 1,
        hash_algorithm: 'none',
        hash_value: '',
        reflection_claim_count: claimIds.length,
        archived_at: null,
        deleted_at: null,
        processing_state: null,
        sync_status: null,
        metadata: {
          authored_by: fm['model'] ?? fm['compiled_by'] ?? null,
          epistemic: fm['epistemic'] ?? null,
          page_id: fm['page_id'] ?? null,
          entity_id: fm['entity_id'] ?? null,
          entity_type: fm['type'] ?? null,
          endorsed_by: endorsedBy ?? null,
          endorsed_at: fm['endorsed_at'] ?? null,
          wiki_category: category,
          wiki_slug: slug,
          sources,
          claim_ids: claimIds,
          related,
          supersedes,
        },
        // Populated to match the case 'page' / case 'entity' detail handlers
        // in MemoryDetailPanel. `body` ships the markdown so a doc viewer can
        // render it without a second fetch.
        content: category === 'entities'
          ? {
              type: fm['type'] ?? null,
              summary: fm['summary'] ?? null,
              description: fm['summary'] ?? null,
              related: related.length ? related : undefined,
              body: bodyNormalized,
              slug,
              category,
            }
          : {
              confidence: fm['confidence'] != null ? Number(fm['confidence']) : null,
              compiled_from: sources.length,
              sections,
              body: bodyNormalized,
              slug,
              category,
            },
      });
    }
  }
  return out;
}

function filterWikiObjects(
  rows: WikiVirtualObject[],
  q: {
    collectionId?: string;
    kind?: string;
    origin?: string;
    sourceApp?: string;
    tags?: string[];
    query?: string;
  },
): WikiVirtualObject[] {
  // If caller explicitly scoped to a different collection or non-wiki kind, drop wiki rows.
  if (q.collectionId && q.collectionId !== WIKI_COLLECTION_ID) return [];
  if (q.kind && q.kind !== 'wiki') return [];
  if (q.sourceApp && q.sourceApp !== 'smartware-wiki') return [];
  let out = rows;
  if (q.origin) out = out.filter((r) => r.origin === q.origin);
  if (q.tags && q.tags.length) {
    out = out.filter((r) => q.tags!.every((t) => r.tags.includes(t)));
  }
  if (q.query) {
    const needle = q.query.toLowerCase();
    out = out.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        (r.summary ?? '').toLowerCase().includes(needle),
    );
  }
  return out;
}

function mapScopeAlias(profile: { scopes: { personal: string; workspace: string } }, scopeAlias?: string): string | undefined {
  if (!scopeAlias || scopeAlias === 'all' || scopeAlias === 'archive') return undefined;
  if (scopeAlias === 'private') return profile.scopes.personal;
  if (scopeAlias === 'workspace') return profile.scopes.workspace;
  return undefined;
}

export async function registerLibraryRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);

  // Debounced background reflection — coalesce bursty object writes (e.g. a
  // bulk import) into a single deterministic compile per scope, so imported
  // memory becomes queryable as CLAIMS (what /pod/context reads) without
  // flooding the extractor or incurring LLM cost. LLM reflection stays an
  // explicit opt-in via POST /pod/reflect.
  const reflectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  function scheduleReflect(actorId: string, scope: string): void {
    const existing = reflectTimers.get(scope);
    if (existing) clearTimeout(existing);
    reflectTimers.set(scope, setTimeout(() => {
      reflectTimers.delete(scope);
      (async () => {
        try {
          const core = await getSmartwareCore(env);
          await core.compile({
            actor: { type: 'agent', id: actorId, display_name: actorId },
            scope,
            use_llm: resolveReflectionModelUse(db),
          });
        } catch (error) {
          app.log.warn({ error, scope }, 'background reflect (deterministic) failed');
        }
      })();
    }, 4000));
  }

  /* ── Collections ── */

  app.get('/pod/collections', {
    schema: { summary: 'List Pod collections with object counts' },
  }, async (request, reply) => {
    if (rejectAgentLibraryRead(request, reply)) return;
    const workspaceId = requestWorkspaceId(request);
    const collections = listCollections(db, workspaceId);
    return {
      collections: collections.map(c => ({
        ...c,
        count: countObjects(db, { workspaceId, collectionId: c.id }),
      })),
    };
  });

  app.post('/pod/collections', {
    schema: { summary: 'Create or update a Pod collection' },
  }, async (request, reply) => {
    const body = request.body as { actor_id: string; id?: string; name: string; parent_id?: string | null; description?: string; metadata?: Record<string, unknown> };
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;

    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const workspaceId = requestWorkspaceId(request);
    const workspaceScope = ensureWorkspaceScope(core, env, workspaceId);
    if (!requireAgentLibraryWrite(db, body.actor_id, profile, workspaceScope, reply)) return;
    const collection = upsertCollection(db, { ...body, workspace_id: workspaceId });

    try {
      await core.observe({
        actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
        type: 'system',
        scope: workspaceScope,
        source_id: `pod-collection:${collection.id}`,
        content: { format: 'application/json', body: { action: 'collection_upserted', collection } },
        visibility: 'scope',
        app: 'coffee-pod',
      });
    } catch (error) {
      app.log.warn({ error, collection_id: collection.id }, 'smartware observe failed for collection upsert');
    }
    return { collection };
  });

  app.patch('/pod/collections/:collection_id', {
    schema: { summary: 'Partially update a collection (name, parent_id)' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const params = request.params as { collection_id: string };
    const body = request.body as { name?: string; parent_id?: string | null; sort_order?: number };
    const updated = patchCollection(db, params.collection_id, body, requestWorkspaceId(request));
    if (!updated) {
      return reply.code(404).send({ error: 'not_found', message: 'Collection not found' });
    }
    return { collection: updated };
  });

  app.delete('/pod/collections/:collection_id', {
    schema: { summary: 'Delete a collection, moving its objects to inbox' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const params = request.params as { collection_id: string };
    const deleted = deleteCollection(db, params.collection_id, requestWorkspaceId(request));
    if (!deleted) {
      return reply.code(404).send({ error: 'not_found', message: 'Collection not found' });
    }
    return { deleted: true };
  });

  /* ── Objects ── */

  app.get('/pod/objects', {
    schema: { summary: 'List Pod objects' },
  }, async (request, reply) => {
    if (rejectAgentLibraryRead(request, reply)) return;
    const query = request.query as {
      collection_id?: string;
      kind?: string;
      origin?: string;
      source_app?: string;
      state?: string;
      tags?: string | string[];
      include_archived?: string | boolean;
      query?: string;
      limit?: string | number;
      offset?: string | number;
    };
    const tags = Array.isArray(query.tags)
      ? query.tags
      : typeof query.tags === 'string'
        ? query.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : undefined;
    const workspaceId = requestWorkspaceId(request);
    const dbRows = listObjects(db, {
      workspaceId,
      collectionId: query.collection_id,
      kind: query.kind,
      origin: query.origin,
      sourceApp: query.source_app,
      processingState: query.state,
      includeArchived: query.include_archived === true || query.include_archived === 'true',
      tags,
      query: query.query,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    }).map((object) => serializeObjectForMemory(db, object));

    // Project compiled L2 wiki pages as virtual rows. Read-only;
    // edits flow through REVISE / FORGET, not /pod/objects PATCH.
    let wikiRows: WikiVirtualObject[] = [];
    try {
      const core = await getSmartwareCore(env);
      const workspaceScope = ensureWorkspaceScope(core, env, workspaceId);
      wikiRows = filterWikiObjects(listWikiPagesAsObjects(core.wikiDir), {
        collectionId: query.collection_id,
        kind: query.kind,
        origin: query.origin,
        sourceApp: query.source_app,
        tags,
        query: query.query,
      }).filter(row => row.scope === workspaceScope);
    } catch (error) {
      app.log.warn({ error }, 'wiki projection into /pod/objects failed');
    }

    return { objects: [...dbRows, ...wikiRows] };
  });

  app.post('/pod/objects', {
    schema: { summary: 'Create or update a Pod object' },
  }, async (request, reply) => {
    const body = request.body as {
      actor_id: string;
      id?: string;
      collection_id?: string;
      kind: string;
      title: string;
      content?: unknown;
      origin?: string;
      created_origin?: string;
      last_modified_by?: string;
      sync_status?: string;
      processing_state?: string;
      tags?: string[];
      summary?: string | null;
      sensitive?: boolean;
      visibility?: 'private' | 'scope' | 'workspace' | 'public';
      source?: { app?: string; external_id?: string; url?: string };
      metadata?: Record<string, unknown>;
    };
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;

    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const workspaceId = requestWorkspaceId(request);
    const workspaceScope = ensureWorkspaceScope(core, env, workspaceId);
    if (!requireAgentLibraryWrite(db, body.actor_id, profile, workspaceScope, reply)) return;
    const existing = body.id ? getObject(db, body.id) : null;
    if (existing && existing.workspace_id !== workspaceId) {
      return reply.code(409).send({ error: 'object_workspace_conflict', message: 'That object ID belongs to another workspace.' });
    }
    const memoryPolicy = resolveObservationDefaults(db, {
      visibility: body.visibility,
      sensitive: body.sensitive ?? existing?.sensitive,
    });

    const object = upsertObject(db, {
      ...body,
      workspace_id: workspaceId,
      created_origin: body.created_origin,
      last_modified_by: body.last_modified_by,
      sync_status: body.sync_status,
      processing_state: body.processing_state,
      tags: body.tags,
      summary: body.summary,
      sensitive: memoryPolicy.sensitive,
    });

    let memory: Awaited<ReturnType<typeof syncArtifactMemory>> | null = null;
    // The Pod write remains durable if Smartware is temporarily unavailable;
    // the warning is returned and logged rather than silently claiming sync.
    try {
      memory = await syncArtifactMemory({
        db,
        core,
        object,
        actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
        type: object.kind === 'file' ? 'file' : 'tool_output',
        scope: workspaceScope,
        content: { format: 'application/json', body: { action: 'object_upserted', object } },
        visibility: memoryPolicy.visibility,
        sensitive: memoryPolicy.sensitive,
        app: 'coffee-pod',
        observed_at: object.updated_at,
        legacy_sources: [{ app: 'coffee-pod', source_id: `pod-object:${object.id}` }],
      });
      if (memory.status === 'created') scheduleReflect(body.actor_id, workspaceScope);
    } catch (error) {
      app.log.warn({ error, object_id: object.id }, 'smartware observe failed for object upsert');
    }
    return {
      object: serializeObjectForMemory(db, object),
      memory: memory ?? { status: 'pending', message: 'Smartware observation will need retry.' },
    };
  });

  app.get('/pod/objects/:object_id', {
    schema: { summary: 'Get a Pod object by ID' },
  }, async (request, reply) => {
    if (rejectAgentLibraryRead(request, reply)) return;
    const params = request.params as { object_id: string };
    const object = getObject(db, params.object_id);
    if (!object || object.workspace_id !== requestWorkspaceId(request)) {
      return reply.code(404).send({ error: 'not_found', message: 'Pod object not found' });
    }
    return { object: serializeObjectForMemory(db, object) };
  });

  app.patch('/pod/objects/:object_id', {
    schema: { summary: 'Partially update a Pod object (title, content)' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const params = request.params as { object_id: string };
    const body = request.body as {
      title?: string;
      content?: unknown;
      collection_id?: string | null;
      sort_order?: number;
      tags?: string[];
      metadata?: Record<string, unknown>;
      last_modified_by?: string;
      sync_status?: string;
      processing_state?: string;
      archived_at?: string | null;
      needs_review?: boolean;
    };
    const existing = getObject(db, params.object_id);
    if (!existing || existing.workspace_id !== requestWorkspaceId(request)) {
      return reply.code(404).send({ error: 'not_found', message: 'Pod object not found' });
    }
    const updated = patchObject(db, params.object_id, body);
    if (!updated) {
      return reply.code(404).send({ error: 'not_found', message: 'Pod object not found' });
    }
    const core = await getSmartwareCore(env);
    const workspaceScope = ensureWorkspaceScope(core, env, updated.workspace_id);
    const memoryPolicy = resolveObservationDefaults(db, { sensitive: updated.sensitive });
    let memory: Awaited<ReturnType<typeof syncArtifactMemory>> | null = null;
    try {
      memory = await syncArtifactMemory({
        db,
        core,
        object: updated,
        actor: { type: 'person', id: 'person-local', display_name: 'Owner' },
        type: updated.kind === 'file' ? 'file' : 'tool_output',
        scope: workspaceScope,
        content: { format: 'application/json', body: { action: 'object_versioned', object: updated } },
        visibility: memoryPolicy.visibility,
        sensitive: memoryPolicy.sensitive,
        app: 'coffee-pod',
        observed_at: updated.updated_at,
        legacy_sources: [{ app: 'coffee-pod', source_id: `pod-object:${updated.id}` }],
      });
      if (memory.status === 'created') scheduleReflect('person-local', workspaceScope);
    } catch (error) {
      app.log.warn({ error, object_id: updated.id }, 'smartware observe failed for object patch');
    }
    return {
      object: serializeObjectForMemory(db, updated),
      memory: memory ?? { status: 'pending', message: 'Smartware observation will need retry.' },
    };
  });

  app.delete('/pod/objects/:object_id', {
    schema: { summary: 'Delete a Pod object, optionally forgetting extracted knowledge' },
  }, async (request, reply) => {
    const params = request.params as { object_id: string };
    const query = request.query as { forget?: string };
    const body = request.body as { actor_id?: string } | undefined;
    const actorId = body?.actor_id ?? 'person-local';
    // Deletion is destructive and the body's actor_id is unauthenticated user
    // input, so require owner-level auth before honouring it.
    if (!await requireOwnerAuth(request, reply, env)) return;
    if (body?.actor_id && !await requireActorAuth(request, reply, env, body.actor_id)) return;

    const object = getObject(db, params.object_id);
    if (!object || object.workspace_id !== requestWorkspaceId(request)) {
      return reply.code(404).send({ error: 'not_found', message: 'Pod object not found' });
    }

    let forgotten = false;
    let retiredObservationIds: string[] = [];
    if (query.forget !== 'false') {
      try {
        const core = await getSmartwareCore(env);
        const retired = await retireArtifactMemory(
          db,
          core,
          object.id,
          `User ${actorId} deleted source artifact`,
          [{ app: 'coffee-pod', source_id: `pod-object:${object.id}` }],
        );
        if (retired.retirement_failures.length > 0) {
          return reply.code(409).send({
            error: 'memory_retirement_failed',
            message: 'The artifact was not deleted because its semantic memory could not be retired safely.',
            failures: retired.retirement_failures,
          });
        }
        retiredObservationIds = retired.retired_observation_ids;
        forgotten = retiredObservationIds.length > 0;
      } catch (err) {
        app.log.warn({ error: err, object_id: params.object_id }, 'forget after delete failed');
        return reply.code(409).send({
          error: 'memory_retirement_failed',
          message: 'The artifact was not deleted because its semantic memory could not be retired safely.',
        });
      }
    }

    const deleted = deleteObject(db, params.object_id, requestWorkspaceId(request));
    if (!deleted) {
      return reply.code(404).send({ error: 'not_found', message: 'Pod object not found' });
    }
    return { deleted: true, forgotten, retired_observation_ids: retiredObservationIds };
  });

  /* ── Search ── */

  app.get('/pod/search', {
    schema: { summary: 'Search Pod objects and Smartware entities' },
  }, async (request, reply) => {
    if (rejectAgentLibraryRead(request, reply)) return;
    const query = request.query as { q?: string; limit?: string };
    const q = query.q?.trim();
    if (!q || q.length < 2) return { objects: [], entities: [] };
    const limit = Math.min(Number(query.limit) || 10, 50);

    const workspaceId = requestWorkspaceId(request);
    const objects = listObjects(db, { workspaceId, query: q, limit });

    let entities: Array<{ entity_id: string; entity_name: string; score: number; claim?: unknown }> = [];
    try {
      const core = await getSmartwareCore(env);
      const profile = getPodProfile(core, env);
      const workspaceScope = ensureWorkspaceScope(core, env, workspaceId);
      const byEntity = new Map<string, typeof entities[number]>();
      const queryScopes = workspaceId === DEFAULT_WORKSPACE_ID
        ? Object.values(profile.scopes)
        : [profile.scopes.personal, workspaceScope];
      for (const scope of new Set(queryScopes)) {
        const result = await core.query({
          actor: { type: 'person', id: 'person-local', display_name: 'Owner' },
          query: q,
          scope,
          limit,
        });
        for (const item of result.results) {
          const current = byEntity.get(item.entity_id);
          if (!current || item.score > current.score) byEntity.set(item.entity_id, item);
        }
      }
      entities = [...byEntity.values()].sort((a, b) => b.score - a.score).slice(0, limit);
    } catch { /* smartware search unavailable */ }

    return { objects, entities };
  });

  /* ── Activity events ── */

  app.get('/pod/events', {
    schema: { summary: 'List recent activity events' },
  }, async (request, reply) => {
    if (rejectAgentLibraryRead(request, reply)) return;
    const query = request.query as { process?: string; limit?: string | number; offset?: string | number };
    return {
      events: listEvents(db, {
        workspaceId: requestWorkspaceId(request),
        process: query.process,
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      }),
    };
  });

  app.patch('/pod/events/attention', {
    schema: {
      summary: 'Dismiss or restore attention events without resolving them',
      body: {
        type: 'object',
        properties: {
          event_ids: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            minItems: 1,
            maxItems: 100,
          },
          dismissed: { type: 'boolean' },
        },
        required: ['event_ids', 'dismissed'],
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const body = request.body as { event_ids: string[]; dismissed: boolean };
    const eventIds = setAttentionEventsDismissed(
      db,
      requestWorkspaceId(request),
      body.event_ids,
      body.dismissed ? new Date().toISOString() : null,
    );
    return {
      status: body.dismissed ? 'dismissed' : 'restored',
      event_ids: eventIds,
    };
  });

  /* ── Imports ── */

  app.get('/pod/imports', {
    schema: { summary: 'List recent imports' },
  }, async (request, reply) => {
    if (rejectAgentLibraryRead(request, reply)) return;
    const query = request.query as { limit?: string | number };
    return {
      imports: listImports(db, query.limit ? Number(query.limit) : undefined, requestWorkspaceId(request)),
    };
  });

  app.get('/pod/memories/sidebar', {
    schema: { summary: 'Sidebar data for the Memories UI' },
  }, async (request, reply) => {
    if (rejectAgentLibraryRead(request, reply)) return;
    const query = request.query as { scope?: string; scope_alias?: string };
    const workspaceId = requestWorkspaceId(request);
    const objects = listObjects(db, { workspaceId, includeArchived: false, limit: 500 });
    const bySource = new Map<string, number>();
    for (const object of objects) {
      const source = object.source_app ?? 'local';
      bySource.set(source, (bySource.get(source) ?? 0) + 1);
    }

    let entityBuckets = ENTITY_BUCKETS.map((bucket) => ({ id: bucket.id, label: bucket.label, count: 0, last_seen: null as string | null }));
    try {
      const core = await getSmartwareCore(env);
      const profile = getPodProfile(core, env);
      const workspaceScope = ensureWorkspaceScope(core, env, workspaceId);
      const scope = query.scope ?? (query.scope_alias === 'workspace' ? workspaceScope : mapScopeAlias(profile, query.scope_alias)) ?? workspaceScope;
      const entityBrowse = await core.read({
        actor: { type: 'person', id: env.ownerId ?? 'person-local', display_name: env.ownerId ?? 'Owner' },
        scope,
        include_sensitive: false,
      }) as { entities?: Array<{ entity_name: string; type: string; oneliner: string }> };
      const bucketCounts = new Map<string, number>();
      for (const entity of entityBrowse.entities ?? []) {
        const bucket = ENTITY_BUCKETS.find((candidate) => candidate.types.has(entity.type));
        if (!bucket) continue;
        bucketCounts.set(bucket.id, (bucketCounts.get(bucket.id) ?? 0) + 1);
      }
      entityBuckets = entityBuckets.map((bucket) => ({
        ...bucket,
        count: bucketCounts.get(bucket.id) ?? 0,
      }));
    } catch {
      // Smartware entity browse is best-effort in the UI sidebar.
    }

    return {
      core: [
        { id: 'inbox', label: 'Inbox', count: countObjects(db, { workspaceId, collectionId: 'inbox' }) },
        { id: 'all-docs', label: 'All Docs', count: countObjects(db, { workspaceId }) },
        { id: 'archive', label: 'Archive', count: countObjects(db, { workspaceId, includeArchived: true }) - countObjects(db, { workspaceId }) },
      ],
      folders: listCollections(db, workspaceId).filter((collection) => !['inbox', 'archive'].includes(collection.id)),
      entities: entityBuckets,
      sources: [
        { id: 'coffee', label: 'Coffee', count: bySource.get('coffee') ?? 0 },
        { id: 'google-drive', label: 'Google Drive', count: bySource.get('google-drive') ?? 0 },
        { id: 'upload', label: 'Upload', count: bySource.get('upload') ?? 0 },
        { id: 'local-folder', label: 'Local Folder', count: bySource.get('local-folder') ?? 0 },
      ],
      saved_views: listSavedViews(db),
      tags: listTags(db, workspaceId),
    };
  });

  app.get('/pod/memories/list', {
    schema: { summary: 'List rows for the Memories UI' },
  }, async (request, reply) => {
    if (rejectAgentLibraryRead(request, reply)) return;
    const query = request.query as {
      collection_id?: string;
      kind?: string;
      origin?: string;
      source_app?: string;
      state?: string;
      tags?: string;
      q?: string;
      include_archived?: string | boolean;
      limit?: string | number;
      offset?: string | number;
    };
    const tags = typeof query.tags === 'string'
      ? query.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : undefined;
    const workspaceId = requestWorkspaceId(request);
    const objects = listObjects(db, {
      workspaceId,
      collectionId: query.collection_id,
      kind: query.kind,
      origin: query.origin,
      sourceApp: query.source_app,
      processingState: query.state,
      includeArchived: query.include_archived === true || query.include_archived === 'true',
      tags,
      query: query.q,
      limit: query.limit ? Number(query.limit) : 100,
      offset: query.offset ? Number(query.offset) : 0,
    });
    return {
      rows: objects.map((object) => ({
        id: object.id,
        title: object.title,
        preview: inferPreview(object),
        modified_at: object.updated_at,
        type: object.kind,
        tags: object.tags,
        origin: object.created_origin ?? object.origin,
        source: object.source_app,
        processing_state: object.processing_state,
        backlink_count: countBacklinks(db, object.id),
      })),
    };
  });

  app.get('/pod/memories/backlinks/:object_id', {
    schema: { summary: 'Grouped backlinks for a Pod object' },
  }, async (request, reply) => {
    if (rejectAgentLibraryRead(request, reply)) return;
    const { object_id } = request.params as { object_id: string };
    const object = getObject(db, object_id);
    if (!object || object.workspace_id !== requestWorkspaceId(request)) return reply.code(404).send({ error: 'not_found', message: 'Pod object not found' });
    return {
      object_id,
      backlinks: listBacklinks(db, object_id),
    };
  });

  app.get('/pod/memories/inspector/:object_id', {
    schema: { summary: 'Inspector payload for a Pod object' },
  }, async (request, reply) => {
    if (rejectAgentLibraryRead(request, reply)) return;
    const { object_id } = request.params as { object_id: string };
    const object = getObject(db, object_id);
    if (!object || object.workspace_id !== requestWorkspaceId(request)) return reply.code(404).send({ error: 'not_found', message: 'Pod object not found' });
    return {
      target_type: 'doc',
      object: serializeObjectForMemory(db, object),
      backlinks: listBacklinks(db, object_id),
      outbound_references: listOutboundReferences(db, object_id),
    };
  });

  app.get('/pod/memories/saved-views', {
    schema: { summary: 'List saved Memories views' },
  }, async (request, reply) => {
    if (rejectAgentLibraryRead(request, reply)) return;
    return { saved_views: listSavedViews(db) };
  });

  app.post('/pod/memories/saved-views', {
    schema: { summary: 'Create or update a saved Memories view' },
  }, async (request, reply) => {
    const body = request.body as { actor_id: string; id?: string; name: string; filters: Record<string, unknown>; is_default?: boolean };
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    return { saved_view: upsertSavedView(db, body) };
  });

  app.delete('/pod/memories/saved-views/:view_id', {
    schema: { summary: 'Delete a saved Memories view' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { view_id } = request.params as { view_id: string };
    return { deleted: deleteSavedView(db, view_id) };
  });

  /* ── Knowledge Graph ── */

  app.get('/pod/graph', {
    schema: { summary: 'Build knowledge graph from Pod objects, collections, and Smartware entities' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { limit, view, root, depth } = request.query as {
      limit?: string;
      view?: string;
      root?: string;
      depth?: string;
    };
    const objectLimit = parseGraphObjectLimit(limit);
    if (objectLimit === null) {
      return reply.code(400).send({
        error: 'invalid_limit',
        message: 'limit must be a positive integer',
      });
    }
    const projectionMode = parseGraphProjectionMode(view);
    if (!projectionMode) {
      return reply.code(400).send({
        error: 'invalid_view',
        message: 'view must be overview, complete, or neighborhood',
      });
    }
    const parsedDepth = depth === undefined ? 1 : Number(depth);
    if (!Number.isInteger(parsedDepth) || parsedDepth < 1 || parsedDepth > 3) {
      return reply.code(400).send({
        error: 'invalid_depth',
        message: 'depth must be an integer from 1 to 3',
      });
    }
    if (projectionMode === 'neighborhood' && !root?.trim()) {
      return reply.code(400).send({
        error: 'root_required',
        message: 'root is required for a neighborhood view',
      });
    }
    const workspaceId = requestWorkspaceId(request);
    const core = await getSmartwareCore(env);
    return buildKnowledgeGraphProjection(db, env, objectLimit, {
      id: workspaceId,
      scope: ensureWorkspaceScope(core, env, workspaceId),
    }, {
      mode: projectionMode,
      rootNodeId: root,
      depth: parsedDepth,
    });
  });

  app.post('/pod/graph/edges', {
    schema: { summary: 'Create a durable owner graph annotation' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const body = (request.body ?? {}) as {
      source_node_id?: string;
      target_node_id?: string;
      source?: string;
      target?: string;
      label?: string;
      relation?: string;
      direction?: 'directed' | 'undirected';
      note?: string;
    };
    const sourceNodeId = typeof (body.source_node_id ?? body.source) === 'string'
      ? (body.source_node_id ?? body.source) as string
      : undefined;
    const targetNodeId = typeof (body.target_node_id ?? body.target) === 'string'
      ? (body.target_node_id ?? body.target) as string
      : undefined;
    if (!sourceNodeId?.trim() || !targetNodeId?.trim()) {
      return reply.code(400).send({
        error: 'invalid_edge',
        message: 'source_node_id and target_node_id are required',
      });
    }
    const normalizedSource = sourceNodeId.trim();
    const normalizedTarget = targetNodeId.trim();
    const allowedNodeId = /^(?:obj|col|sw):\S{1,500}$/;
    if (!allowedNodeId.test(normalizedSource) || !allowedNodeId.test(normalizedTarget) || normalizedSource === normalizedTarget) {
      return reply.code(400).send({
        error: 'invalid_edge',
        message: 'Graph annotations require two different obj:, col:, or sw: node ids',
      });
    }
    const textFields = [body.label, body.relation, body.note];
    if (textFields.some((value) => value !== undefined && typeof value !== 'string')
      || (body.label?.length ?? 0) > 200
      || (body.relation?.length ?? 0) > 200
      || (body.note?.length ?? 0) > 2_000) {
      return reply.code(400).send({
        error: 'invalid_edge',
        message: 'label and relation must be at most 200 characters; note must be at most 2000 characters',
      });
    }
    if (body.direction && body.direction !== 'directed' && body.direction !== 'undirected') {
      return reply.code(400).send({
        error: 'invalid_direction',
        message: 'direction must be directed or undirected',
      });
    }
    const workspaceId = requestWorkspaceId(request);
    const core = await getSmartwareCore(env);
    const currentGraph = await buildKnowledgeGraphProjection(db, env, MAX_GRAPH_OBJECT_LIMIT, {
      id: workspaceId,
      scope: ensureWorkspaceScope(core, env, workspaceId),
    }, {
      mode: 'complete',
      semanticLimit: MAX_GRAPH_OBJECT_LIMIT,
    });
    const currentNodeIds = new Set(currentGraph.nodes.map((node) => node.id));
    if (!currentNodeIds.has(normalizedSource) || !currentNodeIds.has(normalizedTarget)) {
      return reply.code(404).send({
        error: 'unknown_node',
        message: 'Graph annotations require two nodes visible in the current owner graph',
      });
    }
    const edge = createGraphAnnotation(db, {
      source_node_id: normalizedSource,
      target_node_id: normalizedTarget,
      label: body.label,
      relation: body.relation,
      direction: body.direction,
      note: body.note,
    });
    return reply.code(201).send({ edge: projectGraphAnnotation(edge) });
  });

  app.delete('/pod/graph/edges/:edge_id', {
    schema: { summary: 'Delete a durable owner graph annotation' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { edge_id } = request.params as { edge_id: string };
    const annotationId = edge_id.startsWith('annotation:') ? edge_id.slice('annotation:'.length) : edge_id;
    if (!annotationId || !deleteGraphAnnotation(db, annotationId)) {
      return reply.code(404).send({ error: 'not_found', message: 'Graph annotation not found' });
    }
    return { deleted: true };
  });
}
