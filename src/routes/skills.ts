import type { FastifyInstance } from 'fastify';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ulid } from 'ulid';

import type { CoffeePodEnv } from '../config/env.js';
import { requireActorAuth, requireOwnerAuth } from '../security/auth.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import {
  getDb,
  listSkills,
  getSkill,
  getSkillBySource,
  upsertSkill,
  updateSkillStatus,
  deleteSkill,
  countSkillsUsingGrant,
  listSkillBindings,
  replaceSkillBindings,
  updateSkillBinding,
  captureSkillRevision,
  listSkillRevisions,
  approveSkillRevision,
  rejectSkillRevision,
  listSkillDeployments,
  upsertSkillDeployment,
  deleteSkillDeployment,
  listAgents,
  insertEvent,
  listObjects,
  type PodSkill,
  type PodSkillBinding,
} from '../pod/db.js';
import { detectSkillFrontmatter, type ProcessedFile } from '../services/file-processor.js';
import {
  applySkillDeployment,
  captureSkillPackage,
  previewSkillDeployment,
  scanSkillSource,
  type SkillHarness,
} from '../skills/skill-estate.js';

export function extractJsonArrayField(text: string, field: string): unknown[] {
  const marker = `"${field}":`;
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) throw new Error(`${field} not found`);

  const start = text.indexOf('[', markerIndex + marker.length);
  if (start === -1) throw new Error(`${field} is not an array`);

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index++) {
    const character = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '[') {
      depth += 1;
    } else if (character === ']') {
      depth -= 1;
      if (depth === 0) {
        const parsed = JSON.parse(text.slice(start, index + 1));
        if (!Array.isArray(parsed)) throw new Error(`${field} is not an array`);
        return parsed;
      }
    }
  }

  throw new Error(`${field} array is incomplete`);
}

export async function registerSkillRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);

  app.get('/pod/skills', {
    schema: { summary: 'List all skills' },
  }, async (request) => {
    const query = request.query as { status?: string; limit?: string };
    return {
      skills: listSkills(db, {
        status: query.status,
        limit: query.limit ? Number(query.limit) : undefined,
      }).map(skill => serializeSkill(db, skill)),
    };
  });

  app.get('/pod/skills/:skill_id', {
    schema: { summary: 'Get a skill by ID' },
  }, async (request, reply) => {
    const { skill_id } = request.params as { skill_id: string };
    const skill = getSkill(db, skill_id);
    if (!skill) return reply.code(404).send({ error: 'not_found' });
    return { skill: serializeSkill(db, skill) };
  });

  /* ── Read canonical revision content, with a legacy disk fallback ── */
  app.get('/pod/skills/:skill_id/content', {
    schema: { summary: 'Get canonical Skill package content' },
  }, async (request, reply) => {
    const { skill_id } = request.params as { skill_id: string };
    const skill = getSkill(db, skill_id);
    if (!skill) return reply.code(404).send({ error: 'not_found' });

    const canonical = listSkillRevisions(db, skill_id)
      .find(revision => revision.status === 'draft')
      ?? listSkillRevisions(db, skill_id).find(revision => revision.status === 'approved');
    if (canonical) {
      const files = canonical.files
        ?? (canonical.content ? { 'SKILL.md': canonical.content } : null);
      if (files && Object.keys(files).length > 0) {
        const primaryFile = files['SKILL.md'] ? 'SKILL.md' : Object.keys(files)[0];
        return {
          skill_id: skill.id,
          name: skill.name,
          revision_id: canonical.id,
          primary_file: primaryFile,
          content: files[primaryFile],
          files,
          directory: `Pod Library · revision ${canonical.revision_number}`,
        };
      }
    }

    // Resolve the skill directory — try .agents/skills/{name} then .claude/skills/{name}
    const slugName = skill.name.toLowerCase().replace(/\s+/g, '-');
    const candidates = [
      join(process.cwd(), '.agents', 'skills', slugName),
      join(process.cwd(), '.agents', 'skills', skill.id),
      join(process.cwd(), '.claude', 'skills', slugName),
      join(process.cwd(), '.claude', 'skills', skill.id),
    ];

    for (const dir of candidates) {
      try {
        const files = await readdir(dir);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        const contents: Record<string, string> = {};
        for (const f of mdFiles) {
          contents[f] = await readFile(join(dir, f), 'utf-8');
        }
        if (Object.keys(contents).length > 0) {
          // Return SKILL.md as the primary content, plus all supporting .md files
          const primary = contents['SKILL.md'] ?? contents[mdFiles[0]];
          return {
            skill_id: skill.id,
            name: skill.name,
            primary_file: 'SKILL.md' in contents ? 'SKILL.md' : mdFiles[0],
            content: primary,
            files: contents,
            directory: dir,
          };
        }
      } catch {
        // Directory doesn't exist, try next
      }
    }

    return reply.code(404).send({ error: 'content_not_found', message: 'No skill files found on disk' });
  });

  app.post('/pod/skills', {
    schema: { summary: 'Register a new skill (enters review queue)' },
  }, async (request, reply) => {
    const body = request.body as {
      actor_id: string;
      name: string;
      description?: string;
      version?: string;
      author?: string;
      source?: string;
      source_slug?: string;
      scope?: string;
      permissions?: string[];
      portability?: string;
      agent_ids?: string[];
      equipped_to?: string[];
      metadata?: Record<string, unknown>;
      content?: string;
      files?: Record<string, string>;
    };
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;

    const requestedAgents = resolveAgentIds(db, body.agent_ids ?? body.equipped_to ?? []);
    if (requestedAgents.invalid.length > 0) {
      return reply.code(400).send({
        error: 'invalid_agents',
        message: `Unknown or disconnected agents: ${requestedAgents.invalid.join(', ')}`,
      });
    }

    const source = normalizeSkillSource(body.source);
    const sourceSlug = body.source_slug
      ?? (typeof body.metadata?.source_slug === 'string' ? body.metadata.source_slug : undefined);
    const existing = sourceSlug ? getSkillBySource(db, source, sourceSlug) : null;
    const canUpdateReviewFields = !existing || existing.status === 'review' || existing.status === 'possible';

    const skill = upsertSkill(db, {
      id: existing?.id,
      name: body.name,
      description: body.description ?? existing?.description,
      version: canUpdateReviewFields ? body.version ?? existing?.version : existing?.version,
      author: body.author ?? existing?.author,
      source,
      source_slug: sourceSlug ?? existing?.source_slug,
      scope: canUpdateReviewFields ? body.scope ?? existing?.scope : existing?.scope,
      status: existing?.status ?? 'review',
      trust_score: existing?.trust_score ?? 0,
      trust_level: existing?.trust_level ?? 'blocked',
      permissions: canUpdateReviewFields ? body.permissions ?? existing?.permissions ?? [] : existing?.permissions ?? [],
      grant_id: existing?.grant_id ?? undefined,
      actor_id: existing?.actor_id ?? undefined,
      equipped_to: existing?.equipped_to ?? [],
      portability: canUpdateReviewFields
        ? normalizePortability(body.portability ?? existing?.portability)
        : existing?.portability ?? 'local',
      metadata: { ...(existing?.metadata ?? {}), ...(body.metadata ?? {}), ...(sourceSlug ? { source_slug: sourceSlug } : {}) },
    });

    const revision = captureSkillRevision(db, {
      skill_id: skill.id,
      version: body.version ?? skill.version,
      content: body.content,
      files: body.files,
      origin: source,
      source_ref: sourceSlug ?? skill.source_slug,
      created_by: body.actor_id,
      summary: body.description ?? skill.description,
      status: 'draft',
      metadata: { source_url: body.metadata?.source_url ?? null },
    });

    if (!existing || existing.status === 'review' || existing.status === 'possible') {
      replaceSkillBindings(db, skill.id, requestedAgents.ids, 'pending');
    }

    if (!existing) {
      insertEvent(db, {
        type: 'skill_registered',
        process: 'access',
        actor_id: body.actor_id,
        scope: 'workspace',
        title: skill.name,
        detail: `New skill registered for review · ${skill.permissions.length} permission${skill.permissions.length !== 1 ? 's' : ''} requested`,
        content: { skill_id: skill.id, permissions: skill.permissions, agent_ids: requestedAgents.ids },
      });
    }

    return {
      skill: serializeSkill(db, getSkill(db, skill.id)!),
      created: !existing,
      revision_created: revision.created,
    };
  });

  app.get('/pod/skills/:skill_id/revisions', {
    schema: { summary: 'List immutable revisions for a Skill' },
  }, async (request, reply) => {
    const { skill_id } = request.params as { skill_id: string };
    if (!getSkill(db, skill_id)) return reply.code(404).send({ error: 'not_found' });
    return { revisions: listSkillRevisions(db, skill_id) };
  });

  app.post('/pod/skills/:skill_id/revisions/:revision_id/approve', {
    schema: { summary: 'Approve a Skill revision into the canonical Library' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { skill_id, revision_id } = request.params as { skill_id: string; revision_id: string };
    const body = request.body as { actor_id?: string } | undefined;
    const skill = getSkill(db, skill_id);
    if (!skill) return reply.code(404).send({ error: 'not_found' });
    const revision = approveSkillRevision(db, skill_id, revision_id);
    if (!revision) return reply.code(409).send({ error: 'revision_not_approvable' });
    if (skill.status !== 'installed') updateSkillStatus(db, skill_id, 'approved');
    insertEvent(db, {
      type: 'skill_revision_approved',
      process: 'access',
      actor_id: body?.actor_id ?? 'person-local',
      scope: 'workspace',
      title: skill.name,
      detail: `Revision ${revision.revision_number} approved to Library`,
      content: { skill_id, revision_id },
    });
    return { revision, skill: serializeSkill(db, getSkill(db, skill_id)!) };
  });

  app.post('/pod/skills/:skill_id/revisions/:revision_id/reject', {
    schema: { summary: 'Reject a draft Skill revision' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { skill_id, revision_id } = request.params as { skill_id: string; revision_id: string };
    const body = request.body as { actor_id?: string } | undefined;
    const skill = getSkill(db, skill_id);
    if (!skill) return reply.code(404).send({ error: 'not_found' });
    const revision = rejectSkillRevision(db, skill_id, revision_id);
    if (!revision) return reply.code(409).send({ error: 'revision_not_draft' });
    insertEvent(db, {
      type: 'skill_revision_rejected',
      process: 'access',
      actor_id: body?.actor_id ?? 'person-local',
      scope: 'workspace',
      title: skill.name,
      detail: `Revision ${revision.revision_number} rejected`,
      content: { skill_id, revision_id },
    });
    return { revision, skill: serializeSkill(db, skill) };
  });

  app.post('/pod/skills/scan', {
    schema: { summary: 'Scan native agent Skill directories into the Inbox' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const body = request.body as { actor_id?: string; sources?: SkillHarness[] } | undefined;
    const sources = body?.sources?.length ? body.sources : ['codex', 'claude-code'] as SkillHarness[];
    if (sources.some(source => source !== 'codex' && source !== 'claude-code')) {
      return reply.code(400).send({ error: 'invalid_source' });
    }
    const captured = [];
    for (const source of sources) {
      const packages = await scanSkillSource(source);
      for (const skillPackage of packages) {
        const result = captureSkillPackage(db, skillPackage, body?.actor_id ?? 'person-local');
        captured.push({
          source,
          name: skillPackage.name,
          skill_id: result.skill.id,
          revision_id: result.revision.id,
          created_skill: result.created_skill,
          created_revision: result.created_revision,
        });
        if (result.created_revision) {
          insertEvent(db, {
            type: 'skill_revision_detected',
            process: 'access',
            actor_id: body?.actor_id ?? 'person-local',
            scope: 'workspace',
            title: result.skill.name,
            detail: `${source} revision ${result.revision.revision_number} added to Inbox`,
            content: { skill_id: result.skill.id, revision_id: result.revision.id, source },
          });
        }
      }
    }
    return {
      captured,
      count: captured.filter(result => result.created_revision).length,
      skills: listSkills(db, { limit: 1000 }).map(skill => serializeSkill(db, skill)),
    };
  });

  app.get('/pod/skills/:skill_id/deployments/preview', {
    schema: { summary: 'Preview a Skill deployment without writing agent state' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { skill_id } = request.params as { skill_id: string };
    const query = request.query as { agent_id?: string; target?: SkillHarness; revision_id?: string };
    const skill = getSkill(db, skill_id);
    if (!skill) return reply.code(404).send({ error: 'not_found' });
    if (!query.agent_id) return reply.code(400).send({ error: 'agent_required' });
    if (query.target !== 'codex' && query.target !== 'claude-code') {
      return reply.code(400).send({ error: 'invalid_target' });
    }
    const revision = query.revision_id
      ? listSkillRevisions(db, skill_id).find(candidate => candidate.id === query.revision_id)
      : listSkillRevisions(db, skill_id).find(candidate => candidate.status === 'approved');
    if (!revision) return reply.code(409).send({ error: 'approved_revision_required' });
    return {
      preview: await previewSkillDeployment({
        db,
        skill_id,
        revision_id: revision.id,
        agent_id: query.agent_id,
        target: query.target,
      }),
    };
  });

  app.post('/pod/skills/:skill_id/deployments', {
    schema: { summary: 'Apply and verify an approved Skill revision for an agent' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { skill_id } = request.params as { skill_id: string };
    const body = request.body as {
      actor_id?: string;
      agent_id?: string;
      target?: SkillHarness;
      revision_id?: string;
    } | undefined;
    const skill = getSkill(db, skill_id);
    if (!skill) return reply.code(404).send({ error: 'not_found' });
    if (!body?.agent_id) return reply.code(400).send({ error: 'agent_required' });
    if (body.target !== 'codex' && body.target !== 'claude-code') {
      return reply.code(400).send({ error: 'invalid_target' });
    }
    const connected = resolveAgentIds(db, [body.agent_id]);
    if (connected.invalid.length > 0) return reply.code(400).send({ error: 'invalid_agent' });
    const revision = body.revision_id
      ? listSkillRevisions(db, skill_id).find(candidate => candidate.id === body.revision_id)
      : listSkillRevisions(db, skill_id).find(candidate => candidate.status === 'approved');
    if (!revision) return reply.code(409).send({ error: 'approved_revision_required' });
    const result = await applySkillDeployment({
      db,
      skill_id,
      revision_id: revision.id,
      agent_id: connected.ids[0],
      target: body.target,
    });
    insertEvent(db, {
      type: result.deployment.status === 'synced' ? 'skill_deployed' : 'skill_deployment_blocked',
      process: 'access',
      actor_id: body.actor_id ?? 'person-local',
      scope: 'workspace',
      title: skill.name,
      detail: result.deployment.status === 'synced'
        ? `Revision ${revision.revision_number} synchronized to ${body.target}`
        : result.preview.message,
      content: { skill_id, revision_id: revision.id, agent_id: connected.ids[0], target: body.target },
    });
    return { ...result, skill: serializeSkill(db, getSkill(db, skill_id)!) };
  });

  app.post('/pod/skills/:skill_id/approve', {
    schema: { summary: 'Approve a skill and activate its per-agent grants' },
  }, async (request, reply) => {
    // Approval creates a Smartware grant — owner-only so a paired client
    // can't elevate its own (or a sibling skill's) permissions.
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { skill_id } = request.params as { skill_id: string };
    const body = request.body as { actor_id: string } | undefined;
    const actorId = body?.actor_id ?? 'person-local';

    const skill = getSkill(db, skill_id);
    if (!skill) return reply.code(404).send({ error: 'not_found' });

    let bindings = listSkillBindings(db, skill_id);
    // Older rows stored display names directly on the skill. Materialize
    // those into stable agent-ID bindings the first time they are enabled.
    if (bindings.length === 0 && skill.equipped_to.length > 0) {
      const legacyAgents = resolveAgentIds(db, skill.equipped_to);
      if (legacyAgents.ids.length > 0) {
        bindings = replaceSkillBindings(db, skill_id, legacyAgents.ids, 'pending').bindings;
      }
    }
    if (bindings.length === 0) {
      return reply.code(409).send({
        error: 'agents_required',
        message: 'Assign at least one connected agent before enabling this skill.',
      });
    }

    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const scopePatterns = mapPermissionsToScopes(skill.permissions, profile.scopes);
    const grants = await activateSkillBindings(env, bindings, scopePatterns);
    for (const binding of bindings) {
      updateSkillBinding(db, skill_id, binding.agent_id, {
        status: 'active',
        grant_id: grants.get(binding.agent_id)!,
      });
    }
    await retireLegacySkillGrant(db, env, skill);
    const approvedRevision = approveSkillRevision(db, skill_id);
    updateSkillStatus(db, skill_id, 'installed', null);
    if (approvedRevision) {
      const hasPackage = Boolean(approvedRevision.content?.trim() || (approvedRevision.files && Object.keys(approvedRevision.files).length > 0));
      for (const binding of bindings) {
        upsertSkillDeployment(db, {
          skill_id,
          agent_id: binding.agent_id,
          desired_revision_id: approvedRevision.id,
          status: hasPackage ? 'ready' : 'blocked',
          adapter: 'unresolved',
          last_error: hasPackage ? null : 'Approved revision has no reviewed package files.',
        });
      }
    }

    insertEvent(db, {
      type: 'skill_approved',
      process: 'access',
      actor_id: actorId,
      scope: 'workspace',
      title: skill.name,
      detail: `Skill enabled for ${bindings.length} agent${bindings.length === 1 ? '' : 's'}`,
      content: {
        skill_id: skill.id,
        revision_id: approvedRevision?.id ?? null,
        agent_ids: bindings.map(binding => binding.agent_id),
        grant_ids: [...grants.values()],
      },
    });

    return { skill: serializeSkill(db, getSkill(db, skill_id)!), grant_ids: [...grants.values()] };
  });

  app.put('/pod/skills/:skill_id/agents', {
    schema: { summary: 'Replace the connected agents assigned to a skill' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { skill_id } = request.params as { skill_id: string };
    const body = request.body as { actor_id?: string; agent_ids?: string[] } | undefined;
    const actorId = body?.actor_id ?? 'person-local';
    const skill = getSkill(db, skill_id);
    if (!skill) return reply.code(404).send({ error: 'not_found' });

    const requestedAgents = resolveAgentIds(db, body?.agent_ids ?? []);
    if (requestedAgents.invalid.length > 0) {
      return reply.code(400).send({
        error: 'invalid_agents',
        message: `Unknown or disconnected agents: ${requestedAgents.invalid.join(', ')}`,
      });
    }
    if (skill.status === 'installed' && requestedAgents.ids.length === 0) {
      return reply.code(400).send({
        error: 'agents_required',
        message: 'An enabled skill must be assigned to at least one connected agent. Disable it to remove all assignments.',
      });
    }

    const bindingStatus: PodSkillBinding['status'] = skill.status === 'installed'
      ? 'pending'
      : skill.status === 'disabled' ? 'disabled' : 'pending';
    const { bindings, removed } = replaceSkillBindings(db, skill_id, requestedAgents.ids, bindingStatus);
    await revokeSmartwareGrants(env, removed.map(binding => binding.grant_id).filter((id): id is string => Boolean(id)));
    for (const binding of removed) deleteSkillDeployment(db, skill_id, binding.agent_id);

    if (skill.status === 'installed') {
      const core = await getSmartwareCore(env);
      const profile = getPodProfile(core, env);
      const grants = await activateSkillBindings(env, bindings, mapPermissionsToScopes(skill.permissions, profile.scopes));
      for (const binding of bindings) {
        updateSkillBinding(db, skill_id, binding.agent_id, {
          status: 'active',
          grant_id: grants.get(binding.agent_id)!,
        });
      }
      const approvedRevision = listSkillRevisions(db, skill_id).find(revision => revision.status === 'approved');
      if (approvedRevision) {
        const hasPackage = Boolean(approvedRevision.content?.trim() || (approvedRevision.files && Object.keys(approvedRevision.files).length > 0));
        for (const binding of bindings) {
          upsertSkillDeployment(db, {
            skill_id,
            agent_id: binding.agent_id,
            desired_revision_id: approvedRevision.id,
            status: hasPackage ? 'ready' : 'blocked',
            adapter: 'unresolved',
            last_error: hasPackage ? null : 'Approved revision has no reviewed package files.',
          });
        }
      }
    }

    insertEvent(db, {
      type: 'skill_agents_updated',
      process: 'access',
      actor_id: actorId,
      scope: 'workspace',
      title: skill.name,
      detail: requestedAgents.ids.length > 0
        ? `Assigned to ${requestedAgents.ids.length} agent${requestedAgents.ids.length === 1 ? '' : 's'}`
        : 'All agent assignments removed',
      content: { skill_id: skill.id, agent_ids: requestedAgents.ids },
    });

    return { skill: serializeSkill(db, getSkill(db, skill_id)!) };
  });

  app.post('/pod/skills/:skill_id/disable', {
    schema: { summary: 'Disable a skill and revoke its Smartware grant' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { skill_id } = request.params as { skill_id: string };
    const body = request.body as { actor_id: string } | undefined;
    const actorId = body?.actor_id ?? 'person-local';

    const skill = getSkill(db, skill_id);
    if (!skill) return reply.code(404).send({ error: 'not_found' });

    const bindings = listSkillBindings(db, skill_id);
    try {
      await revokeSmartwareGrants(env, bindings.map(binding => binding.grant_id).filter((id): id is string => Boolean(id)));
      await retireLegacySkillGrant(db, env, skill);
    } catch (err) {
      app.log.warn({ error: err, skill_id }, 'grant revocation failed');
    }
    for (const binding of bindings) {
      updateSkillBinding(db, skill_id, binding.agent_id, { status: 'disabled', grant_id: null });
    }

    updateSkillStatus(db, skill_id, 'disabled', null);

    insertEvent(db, {
      type: 'skill_disabled',
      process: 'access',
      actor_id: actorId,
      scope: 'workspace',
      title: skill.name,
      detail: 'Skill disabled',
      content: { skill_id: skill.id },
    });

    return { skill: serializeSkill(db, getSkill(db, skill_id)!) };
  });

  app.delete('/pod/skills/:skill_id', {
    schema: { summary: 'Remove a skill management record and revoke its grants' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { skill_id } = request.params as { skill_id: string };
    const body = request.body as { actor_id?: string } | undefined;
    const actorId = body?.actor_id ?? 'person-local';

    const skill = getSkill(db, skill_id);
    if (!skill) return reply.code(404).send({ error: 'not_found' });

    const bindings = listSkillBindings(db, skill_id);
    try {
      await revokeSmartwareGrants(env, bindings.map(binding => binding.grant_id).filter((id): id is string => Boolean(id)));
      await retireLegacySkillGrant(db, env, skill);
    } catch {}

    deleteSkill(db, skill_id);

    insertEvent(db, {
      type: 'skill_removed',
      process: 'access',
      actor_id: actorId,
      scope: 'workspace',
      title: skill.name,
      detail: 'Skill management record removed',
      content: { skill_id: skill.id },
    });

    return { deleted: true };
  });

  /* ── Registry proxy — avoids CORS for browser-side fetches ── */

  // Only allow alphanumerics, slash, dash, underscore, and dot in the wildcard
  // path. Rejects encoded traversal (%2e%2e), scheme injection, and any
  // bytes that could split the URL or introduce headers.
  const REGISTRY_PATH = /^[A-Za-z0-9/_.\-]+$/;
  const REGISTRY_QS = /^[A-Za-z0-9_.\-=&]*$/;

  function safeRegistryPath(raw: string): string | null {
    if (!raw || raw.length > 256) return null;
    if (!REGISTRY_PATH.test(raw)) return null;
    if (raw.includes('..')) return null;
    return raw;
  }

  function safeRegistryQuery(raw: string): string | null {
    if (raw.length > 512) return null;
    return REGISTRY_QS.test(raw) ? raw : null;
  }

  async function proxyJsonRegistry(upstream: string, name: string, reply: import('fastify').FastifyReply): Promise<void> {
    try {
      const res = await fetch(upstream, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'CoffeePod/0.1' },
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.text();
      // Clamp content-type to JSON regardless of what the upstream returns —
      // a malicious upstream could try to serve text/html and turn the
      // cockpit into a stored-XSS target.
      reply.code(res.status).header('content-type', 'application/json; charset=utf-8').send(data);
    } catch (err) {
      reply.code(502).send({ error: 'registry_unavailable', upstream: name, detail: String(err) });
    }
  }

  app.get('/pod/skills/registry/clawhub/*', {
    schema: { summary: 'Proxy requests to ClawHub API' },
  }, async (request, reply) => {
    const rawPath = (request.params as { '*': string })['*'];
    const path = safeRegistryPath(rawPath);
    if (!path) return reply.code(400).send({ error: 'invalid_path' });
    const rawQs = new URL(request.url, 'http://localhost').search.replace(/^\?/, '');
    const qs = safeRegistryQuery(rawQs);
    if (qs === null) return reply.code(400).send({ error: 'invalid_query' });
    const url = `https://clawhub.ai/api/v1/${path}${qs ? `?${qs}` : ''}`;
    await proxyJsonRegistry(url, 'clawhub', reply);
  });

  /* ── skills.sh — scrape the RSC homepage payload for initialSkills ── */
  let skillsShCache: { skills: any[]; fetchedAt: number } | null = null;
  const SKILLSSH_CACHE_TTL = 5 * 60 * 1000; // 5 min

  async function fetchSkillsShCatalog(): Promise<{ skills: any[]; fetchedAt: number; cached: boolean }> {
    if (skillsShCache && Date.now() - skillsShCache.fetchedAt < SKILLSSH_CACHE_TTL) {
      return { skills: skillsShCache.skills, fetchedAt: skillsShCache.fetchedAt, cached: true };
    }
    const res = await fetch('https://www.skills.sh/', {
      headers: { 'RSC': '1', 'Accept': 'text/x-component', 'User-Agent': 'CoffeePod/0.1' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`skills.sh ${res.status}`);
    const text = await res.text();
    const skills = extractJsonArrayField(text, 'initialSkills');
    skillsShCache = { skills, fetchedAt: Date.now() };
    return { skills, fetchedAt: skillsShCache.fetchedAt, cached: false };
  }

  app.get('/pod/skills/registry/skillssh/*', {
    schema: { summary: 'Fetch skills from skills.sh (RSC scrape with cache)' },
  }, async (request, reply) => {
    const path = (request.params as { '*': string })['*'];
    const qs = new URL(request.url, 'http://localhost').search;
    const params = new URLSearchParams(qs);
    try {
      const { skills: allSkills, fetchedAt: catalogFetchedAt, cached: catalogCached } = await fetchSkillsShCatalog();
      const q = params.get('q')?.toLowerCase();
      const view = params.get('view') ?? 'trending';
      let filtered = [...allSkills];

      // Search filter
      if (q) {
        filtered = filtered.filter((s: any) =>
          (s.name ?? '').toLowerCase().includes(q) ||
          (s.source ?? '').toLowerCase().includes(q) ||
          (s.skillId ?? '').toLowerCase().includes(q)
        );
      }

      // Sort
      if (view === 'trending' || !q) {
        filtered.sort((a: any, b: any) => (b.installs ?? 0) - (a.installs ?? 0));
      }

      const limit = Math.min(Number(params.get('limit') ?? 24), 100);
      reply.send({ skills: filtered.slice(0, limit), total: filtered.length, fetched_at: new Date(catalogFetchedAt).toISOString(), cached: catalogCached });
    } catch (err) {
      reply.code(502).send({ error: 'registry_unavailable', upstream: 'skillssh', detail: String(err) });
    }
  });

  app.get('/pod/skills/registry/skillsmp/*', {
    schema: { summary: 'Proxy requests to SkillsMP API' },
  }, async (request, reply) => {
    const rawPath = (request.params as { '*': string })['*'];
    const path = safeRegistryPath(rawPath);
    if (!path) return reply.code(400).send({ error: 'invalid_path' });
    const rawQs = new URL(request.url, 'http://localhost').search.replace(/^\?/, '');
    const qs = safeRegistryQuery(rawQs);
    if (qs === null) return reply.code(400).send({ error: 'invalid_query' });
    const url = `https://skillsmp.com/api/v1/${path}${qs ? `?${qs}` : ''}`;
    await proxyJsonRegistry(url, 'skillsmp', reply);
  });

  /* ── Skill detection from existing objects ── */

  app.post('/pod/skills/detect', {
    schema: { summary: 'Scan existing markdown objects for skill frontmatter and register any found' },
  }, async (request, reply) => {
    const body = request.body as { actor_id?: string } | undefined;
    const actorId = body?.actor_id ?? 'person-local';
    if (body?.actor_id && !await requireActorAuth(request, reply, env, body.actor_id)) return;

    const objects = listObjects(db, { kind: 'markdown', limit: 500 });

    const detected: Array<{ object_id: string; title: string; skill_name: string }> = [];

    for (const obj of objects) {
      // Build a minimal ProcessedFile to test detection
      const fm = (obj.metadata as any)?.frontmatter;
      if (!fm) continue;

      const fakeProcessed: ProcessedFile = {
        kind: 'markdown',
        filename: `${obj.title}.md`,
        mimeType: 'text/markdown',
        text: undefined,
        size: 0,
        hasText: false,
        extractionStatus: 'metadata_only',
        chunks: [],
        warnings: [],
        meta: { frontmatter: fm },
      };

      const skillMeta = detectSkillFrontmatter(fakeProcessed);
      if (!skillMeta) continue;

      const existingDetected = getSkill(db, `sk:${obj.id}`);
      const updateDraftFields = !existingDetected || existingDetected.status === 'review' || existingDetected.status === 'possible';

      const detectedSkill = upsertSkill(db, {
        id: `sk:${obj.id}`,
        name: updateDraftFields ? skillMeta.name : existingDetected.name,
        description: updateDraftFields ? skillMeta.description : existingDetected.description,
        version: updateDraftFields ? skillMeta.version : existingDetected.version,
        author: updateDraftFields ? skillMeta.author : existingDetected.author,
        source: 'local',
        scope: updateDraftFields ? skillMeta.scope : existingDetected.scope,
        status: existingDetected?.status ?? 'review',
        trust_score: existingDetected?.trust_score ?? 0,
        trust_level: existingDetected?.trust_level ?? 'blocked',
        permissions: updateDraftFields ? skillMeta.permissions : existingDetected.permissions,
        portability: updateDraftFields ? skillMeta.portability : existingDetected.portability,
        metadata: {
          ...(existingDetected?.metadata ?? {}),
          source_object_id: obj.id,
          auto_detected: true,
          frontmatter: fm,
        },
      });
      captureSkillRevision(db, {
        skill_id: detectedSkill.id,
        version: skillMeta.version,
        content: typeof obj.content === 'string' ? obj.content : obj.content ? JSON.stringify(obj.content, null, 2) : null,
        origin: 'local',
        source_ref: obj.id,
        created_by: actorId,
        summary: skillMeta.description,
        status: 'draft',
        metadata: { source_object_id: obj.id, auto_detected: true },
      });

      detected.push({
        object_id: obj.id,
        title: obj.title,
        skill_name: skillMeta.name,
      });
    }

    return { detected, count: detected.length };
  });
}

type PodDb = ReturnType<typeof getDb>;

function normalizeSkillSource(source?: string): PodSkill['source'] {
  const allowed = new Set<PodSkill['source']>(['coffee', 'skills.sh', 'skillsmp', 'clawhub', 'github', 'local', 'manual']);
  return allowed.has(source as PodSkill['source']) ? source as PodSkill['source'] : 'manual';
}

function normalizePortability(portability?: string): PodSkill['portability'] {
  if (portability === 'exportable' || portability === 'synced') return portability;
  // Historical registry installs used "universal", which was never part of
  // the persisted contract. Exportable is the closest supported meaning.
  if (portability === 'universal') return 'exportable';
  return 'local';
}

function resolveAgentIds(db: PodDb, requested: string[]): { ids: string[]; invalid: string[] } {
  const agents = listAgents(db).filter(agent => agent.status !== 'disabled');
  const byId = new Map(agents.map(agent => [agent.id.toLowerCase(), agent.id]));
  const byName = new Map(agents.map(agent => [agent.name.toLowerCase(), agent.id]));
  const ids = new Set<string>();
  const invalid: string[] = [];
  for (const raw of requested) {
    const value = raw.trim();
    if (!value) continue;
    const resolved = byId.get(value.toLowerCase()) ?? byName.get(value.toLowerCase());
    if (resolved) ids.add(resolved);
    else invalid.push(value);
  }
  return { ids: [...ids].sort(), invalid };
}

async function persistSmartwareConfig(core: Awaited<ReturnType<typeof getSmartwareCore>>, config: ReturnType<typeof core.getConfig>): Promise<void> {
  const { saveConfig, writeRegistryMarkdown } = await import('smartware');
  saveConfig(core.dataDir, config);
  writeRegistryMarkdown(core.dataDir, config);
}

async function activateSkillBindings(
  env: CoffeePodEnv,
  bindings: PodSkillBinding[],
  scopes: string[],
): Promise<Map<string, string>> {
  const core = await getSmartwareCore(env);
  const config = core.getConfig();
  const grantIds = new Map<string, string>();
  let changed = false;

  for (const binding of bindings) {
    const current = binding.grant_id
      ? config.grants.find(grant => grant.id === binding.grant_id && grant.status === 'active' && grant.actor_id === binding.agent_id)
      : undefined;
    if (current) {
      grantIds.set(binding.agent_id, current.id);
      continue;
    }

    const grant = {
      id: `grant_${ulid()}`,
      actor_type: 'agent' as const,
      actor_id: binding.agent_id,
      capabilities: {
        observe: scopes,
        query: scopes,
        compile: scopes,
        correct: scopes,
        forget: [],
        read: scopes,
      },
      trusted: true,
      quarantine: false,
      created_at: new Date().toISOString(),
      expires_at: null,
      status: 'active' as const,
    };
    config.grants.push(grant);
    grantIds.set(binding.agent_id, grant.id);
    changed = true;
  }

  if (changed) await persistSmartwareConfig(core, config);
  return grantIds;
}

async function revokeSmartwareGrants(env: CoffeePodEnv, grantIds: string[]): Promise<void> {
  if (grantIds.length === 0) return;
  const core = await getSmartwareCore(env);
  const config = core.getConfig();
  const wanted = new Set(grantIds);
  let changed = false;
  for (const grant of config.grants) {
    if (wanted.has(grant.id) && grant.status !== 'revoked') {
      grant.status = 'revoked';
      changed = true;
    }
  }
  if (changed) await persistSmartwareConfig(core, config);
}

async function retireLegacySkillGrant(db: PodDb, env: CoffeePodEnv, skill: PodSkill): Promise<void> {
  if (!skill.grant_id) return;
  if (countSkillsUsingGrant(db, skill.grant_id) <= 1) {
    await revokeSmartwareGrants(env, [skill.grant_id]);
  }
  updateSkillStatus(db, skill.id, skill.status, null);
}

function mapPermissionsToScopes(
  permissions: string[],
  podScopes: Record<string, string>,
): string[] {
  const scopes = new Set<string>();
  for (const perm of permissions) {
    if (perm.includes('memory') || perm.includes('learnings') || perm.includes('notes') || perm.includes('docs')) {
      scopes.add(podScopes.personal);
    }
    if (perm.includes('code') || perm.includes('git') || perm.includes('comments') || perm.includes('tasks') || perm.includes('slack') || perm.includes('contacts')) {
      scopes.add(podScopes.workspace);
    }
  }
  if (scopes.size === 0) scopes.add(podScopes.workspace);
  return [...scopes];
}

function serializeSkill(db: PodDb, skill: NonNullable<ReturnType<typeof getSkill>>) {
  const bindings = listSkillBindings(db, skill.id);
  const revisions = listSkillRevisions(db, skill.id);
  return {
    ...skill,
    equipped_to: bindings.length > 0 ? bindings.map(binding => binding.agent_id) : skill.equipped_to,
    agent_bindings: bindings,
    revision_count: revisions.length,
    current_revision: revisions.find(revision => revision.status === 'approved') ?? null,
    pending_revision: revisions.find(revision => revision.status === 'draft') ?? null,
    revisions,
    deployments: listSkillDeployments(db, skill.id),
    review_facets: {
      source: skill.source,
      permissions: skill.permissions,
      local_files: skill.permissions.some((permission) => permission.includes('file') || permission.includes('write')),
      network: skill.permissions.some((permission) => permission.includes('network') || permission.includes('http')),
      shell: skill.permissions.some((permission) => permission.includes('shell') || permission.includes('exec')),
      runtime: {
        runs: skill.runs,
        failures: skill.failures,
        last_run: skill.last_run,
      },
      user_approval: skill.status === 'approved' || skill.status === 'installed',
    },
  };
}
