import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import {
  approvePluginRevision,
  capturePluginRevision,
  deletePlugin,
  getDb,
  getPlugin,
  getPluginByName,
  getPluginBySource,
  insertEvent,
  listPluginRevisionComponents,
  listPluginRevisions,
  listPlugins,
  rejectPluginRevision,
  upsertPlugin,
  type PodPlugin,
  type PodPluginRevision,
} from '../pod/db.js';
import { requireOwnerAuth } from '../security/auth.js';
import {
  inspectAgentPluginPackage,
  pluginManifestSummary,
  type PluginPackageFileInput,
} from '../capabilities/plugin-package.js';

type PodDb = ReturnType<typeof getDb>;

function normalizePluginSource(source?: string): PodPlugin['source'] {
  return source === 'local' || source === 'github' ? source : 'manual';
}

function serializeRevision(db: PodDb, revision: PodPluginRevision) {
  return {
    ...revision,
    files: Object.fromEntries(Object.entries(revision.files).map(([filePath, file]) => [filePath, {
      encoding: file.encoding,
      size: file.size,
      sha256: file.sha256,
    }])),
    components: listPluginRevisionComponents(db, revision.id),
  };
}

function serializePlugin(db: PodDb, plugin: PodPlugin) {
  const revisions = listPluginRevisions(db, plugin.id);
  const pending = revisions.find(revision => revision.status === 'draft') ?? null;
  const current = revisions.find(revision => revision.status === 'approved') ?? null;
  return {
    ...plugin,
    kind: 'plugin' as const,
    revision_count: revisions.length,
    pending_revision: pending ? serializeRevision(db, pending) : null,
    current_revision: current ? serializeRevision(db, current) : null,
    revisions: revisions.map(revision => serializeRevision(db, revision)),
  };
}

export async function registerPluginRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);

  app.get('/pod/plugins', {
    schema: { summary: 'List Agent Plugin packages in the Capability Library' },
  }, async (request) => {
    const query = request.query as { status?: string; limit?: string };
    return {
      plugins: listPlugins(db, {
        status: query.status,
        limit: query.limit ? Number(query.limit) : undefined,
      }).map(plugin => serializePlugin(db, plugin)),
    };
  });

  app.get('/pod/plugins/:plugin_id', {
    schema: { summary: 'Get one Agent Plugin package' },
  }, async (request, reply) => {
    const { plugin_id } = request.params as { plugin_id: string };
    const plugin = getPlugin(db, plugin_id);
    if (!plugin) return reply.code(404).send({ error: 'not_found' });
    return { plugin: serializePlugin(db, plugin) };
  });

  app.post('/pod/plugins', {
    schema: { summary: 'Inspect an Agent Plugin package and add its revision to the Inbox' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const body = request.body as {
      actor_id?: string;
      source?: string;
      source_ref?: string | null;
      files?: Record<string, PluginPackageFileInput>;
    };
    if (!body.files || typeof body.files !== 'object' || Array.isArray(body.files)) {
      return reply.code(400).send({ error: 'invalid_package', message: 'Plugin package files are required.' });
    }

    let inspected: ReturnType<typeof inspectAgentPluginPackage>;
    try {
      inspected = inspectAgentPluginPackage(body.files);
    } catch (error) {
      return reply.code(400).send({ error: 'invalid_package', message: String(error) });
    }
    if (!inspected.inspection.valid || !inspected.inspection.manifest) {
      return reply.code(422).send({
        error: 'plugin_manifest_invalid',
        message: 'The Agent Plugin manifest is not valid for a supported schema.',
        inspection: inspected.inspection,
      });
    }

    const summary = pluginManifestSummary(inspected.inspection.manifest);
    const source = normalizePluginSource(body.source);
    const sourceRef = body.source_ref?.trim() || null;
    const existing = sourceRef
      ? getPluginBySource(db, source, sourceRef)
      : getPluginByName(db, summary.name);
    const plugin = upsertPlugin(db, {
      id: existing?.id,
      name: summary.name,
      description: summary.description,
      version: existing && (existing.status === 'approved' || existing.status === 'disabled')
        ? existing.version
        : summary.version,
      author: summary.author,
      source,
      source_ref: sourceRef,
      status: existing?.status ?? 'review',
      schema_version: inspected.inspection.specification,
      trust_score: existing?.trust_score ?? 0,
      trust_level: existing?.trust_level ?? 'blocked',
      metadata: {
        ...(existing?.metadata ?? {}),
        package_format: 'agent-plugins',
      },
    });
    const revision = capturePluginRevision(db, {
      plugin_id: plugin.id,
      version: summary.version,
      package_hash: inspected.package_hash,
      schema_uri: String(inspected.inspection.manifest.$schema),
      manifest: inspected.inspection.manifest,
      files: inspected.files,
      inspection: inspected.inspection as unknown as Record<string, unknown>,
      components: inspected.components,
      source_ref: sourceRef,
      created_by: body.actor_id ?? 'person-local',
      status: 'draft',
      metadata: { source },
    });
    if (revision.created) {
      insertEvent(db, {
        type: 'plugin_revision_detected',
        process: 'access',
        actor_id: body.actor_id ?? 'person-local',
        scope: 'workspace',
        title: plugin.name,
        detail: `Agent Plugin revision ${revision.revision.revision_number} added to the Capability Inbox`,
        content: { plugin_id: plugin.id, revision_id: revision.revision.id, source },
      });
    }
    return {
      plugin: serializePlugin(db, getPlugin(db, plugin.id)!),
      created: !existing,
      revision_created: revision.created,
    };
  });

  app.post('/pod/plugins/:plugin_id/revisions/:revision_id/approve', {
    schema: { summary: 'Approve an Agent Plugin revision into the Capability Library' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { plugin_id, revision_id } = request.params as { plugin_id: string; revision_id: string };
    const body = request.body as { actor_id?: string } | undefined;
    const plugin = getPlugin(db, plugin_id);
    if (!plugin) return reply.code(404).send({ error: 'not_found' });
    const revision = approvePluginRevision(db, plugin_id, revision_id);
    if (!revision) return reply.code(409).send({ error: 'revision_not_approvable' });
    insertEvent(db, {
      type: 'plugin_revision_approved',
      process: 'access',
      actor_id: body?.actor_id ?? 'person-local',
      scope: 'workspace',
      title: plugin.name,
      detail: `Agent Plugin revision ${revision.revision_number} approved to the Capability Library`,
      content: { plugin_id, revision_id },
    });
    return { revision: serializeRevision(db, revision), plugin: serializePlugin(db, getPlugin(db, plugin_id)!) };
  });

  app.post('/pod/plugins/:plugin_id/revisions/:revision_id/reject', {
    schema: { summary: 'Reject a draft Agent Plugin revision' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { plugin_id, revision_id } = request.params as { plugin_id: string; revision_id: string };
    const plugin = getPlugin(db, plugin_id);
    if (!plugin) return reply.code(404).send({ error: 'not_found' });
    const revision = rejectPluginRevision(db, plugin_id, revision_id);
    if (!revision) return reply.code(409).send({ error: 'revision_not_draft' });
    return { revision: serializeRevision(db, revision), plugin: serializePlugin(db, plugin) };
  });

  app.delete('/pod/plugins/:plugin_id', {
    schema: { summary: 'Remove an Agent Plugin and its revision history' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { plugin_id } = request.params as { plugin_id: string };
    if (!deletePlugin(db, plugin_id)) return reply.code(404).send({ error: 'not_found' });
    return { deleted: true };
  });
}
