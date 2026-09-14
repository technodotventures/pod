// Named-agent registry — CRUD for agents (Hermes, Pythia, etc.) and their
// enforced memory access preset. Legacy collection-grant routes remain for
// compatibility, but they are not the memory authorization boundary.
//
// Not to be confused with src/routes/agents.ts, which is MCP server lifecycle
// (detect / apply-config). This file is about *identity* and *authorization*.

import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { requireOwnerAuth } from '../security/auth.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { listPodDataSpaces } from '../pod/data-spaces.js';
import {
  EARLY_HARNESS_ADAPTERS,
  getHarnessAdapter,
  harnessProfileActorId,
  readHarnessProfileMetadata,
  validateHarnessProfileId,
} from '../services/harness-adapters.js';
import {
  agentProfileIntegrity,
  buildAgentProfileManifest,
  isAgentProfileTarget,
  materializeAgentProfile,
} from '../services/agent-profile-manifest.js';
import {
  applyOpenClawMigration,
  discoverOpenClawMigration,
  listAgentMigrationReceipts,
  OpenClawMigrationError,
  rollbackAgentMigration,
} from '../services/openclaw-migration.js';
import {
  agentAllowedScopeNames,
  isAgentAccessMode,
  revokeAgentAccessGrant,
  syncAgentAccessGrant,
  type AgentAccessMode,
} from '../pod/agent-access.js';
import {
  addAgentGrant,
  deleteAgent,
  getAgent,
  getDb,
  hasAgentToken,
  listAgentGrants,
  listAgents,
  revokeAgentGrant,
  rotateAgentToken,
  upsertAgent,
  type PodAgent,
} from '../pod/db.js';

interface DiscoveredAgentStub {
  id: string;            // raw actor_id (e.g. "agent:hermes-9w6ct6")
  name: string;          // friendly fallback (e.g. "hermes-9w6ct6")
  role: PodAgent['role'];
  status: string;        // mirrors grant status when discovered
  discovered: true;
  grant_id: string;
  source: string;        // smartware-grant / connection-grant
}

/**
 * Derive a display label and role from a raw actor_id like
 * `agent:hermes-9w6ct6`, `sync:google-drive`, `person-local`.
 */
function classifyActor(actorId: string, actorType?: string): { role: PodAgent['role']; name: string } {
  const id = actorId.toLowerCase();
  if (id === 'person-local' || id === 'user' || id.startsWith('person:')) {
    return { role: 'system', name: actorId.replace(/^person:/, '') };
  }
  if (id.startsWith('sync:') || id.startsWith('sidecar:') || id.startsWith('system:')) {
    return { role: 'system', name: actorId };
  }
  if (id.startsWith('agent:')) {
    const tail = actorId.slice('agent:'.length);
    return { role: 'agent', name: tail };
  }
  // Fallback — use actor_type if smartware tagged it
  const role: PodAgent['role'] = actorType === 'person' ? 'system' : 'agent';
  return { role, name: actorId };
}

export async function registerAgentRegistryRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);

  app.get('/pod/harnesses', {
    schema: { summary: 'List early harness adapters and their Pod-bound profiles.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const agents = listAgents(db);
    return {
      adapters: EARLY_HARNESS_ADAPTERS.map(adapter => ({
        ...adapter,
        profiles: agents.flatMap(agent => {
          const metadata = readHarnessProfileMetadata(agent.metadata);
          if (!metadata || metadata.harness_id !== adapter.id) return [];
          return [{
            actor_id: agent.id,
            profile_id: metadata.harness_profile_id,
            profile_label: metadata.harness_profile_label,
            name: agent.name,
            status: agent.status,
            access_mode: agent.access_mode,
            scopes: agent.scopes ?? [],
            updated_at: agent.updated_at,
          }];
        }),
      })),
    };
  });

  app.post('/pod/harnesses/:harness_id/profiles', {
    schema: { summary: 'Create or update a stable Pod identity for one harness profile.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { harness_id } = request.params as { harness_id: string };
    const adapter = getHarnessAdapter(harness_id);
    if (!adapter) return reply.code(404).send({ error: 'not_found', message: 'Harness adapter not found' });
    const body = request.body as {
      profile_id: string;
      profile_label?: string;
      name: string;
      description?: string;
      model?: string | null;
      status?: string;
      persona?: string | null;
      access_mode?: AgentAccessMode;
      scopes?: string[] | null;
      context_budget?: number | null;
      metadata?: Record<string, unknown>;
    };
    const profileId = validateHarnessProfileId(body?.profile_id);
    if (!profileId) {
      return reply.code(400).send({ error: 'invalid_payload', message: 'profile_id must use letters, numbers, dots, hyphens, or underscores' });
    }
    if (!body.name || !body.name.trim()) {
      return reply.code(400).send({ error: 'invalid_payload', message: 'name is required' });
    }
    if (body.access_mode !== undefined && !isAgentAccessMode(body.access_mode)) {
      return reply.code(400).send({ error: 'invalid_payload', message: 'access_mode must be all, scoped, capture_only, or none' });
    }

    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const availableScopes = new Set(Object.keys(profile.scopes));
    const unknownScopes = (body.scopes ?? []).filter(scope => !availableScopes.has(scope));
    if (unknownScopes.length > 0) {
      return reply.code(400).send({ error: 'invalid_payload', message: `Unknown data space: ${unknownScopes.join(', ')}` });
    }

    const id = harnessProfileActorId(adapter.id, profileId);
    const existing = getAgent(db, id);
    const profileLabel = body.profile_label?.trim() || body.profile_id.trim();
    const agent = upsertAgent(db, {
      id,
      name: body.name.trim(),
      description: body.description,
      role: 'agent',
      model: body.model,
      status: body.status,
      persona: body.persona,
      access_mode: body.access_mode ?? (existing ? undefined : 'all'),
      scopes: body.scopes,
      context_budget: body.context_budget,
      created_by: 'user',
      metadata: {
        ...(existing?.metadata ?? {}),
        ...(body.metadata ?? {}),
        harness_id: adapter.id,
        harness_profile_id: profileId,
        harness_profile_label: profileLabel,
        adapter_contract: 'v1',
      },
    });
    syncAgentAccessGrant(core, profile, agent);
    return { agent, adapter, profile: readHarnessProfileMetadata(agent.metadata) };
  });

  // Reconcile persisted policies on startup so legacy named agents receive a
  // deterministic Smartware grant before their token is used.
  try {
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    for (const agent of listAgents(db)) syncAgentAccessGrant(core, profile, agent);
  } catch (error) {
    app.log.warn({ error }, 'agent-registry: access grant reconciliation failed');
  }

  app.get('/pod/registry/agents', {
    schema: { summary: 'List named + discovered agents in this Pod.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const named = listAgents(db);
    const namedIds = new Set(named.map(a => a.id));

    // Merge in actor_ids that Smartware has issued grants to but the user
    // hasn't yet named. These show up as "discovered" stubs so the user can
    // adopt them with a friendly name + memory access preset.
    const discovered: DiscoveredAgentStub[] = [];
    try {
      const core = await getSmartwareCore(env);
      const config = core.getConfig();
      const grants = (config.grants ?? []) as Array<{
        id: string;
        actor_id: string;
        actor_type?: string;
        status: string;
      }>;
      for (const g of grants) {
        if (namedIds.has(g.actor_id)) continue;
        if (g.status === 'revoked') continue;
        const { role, name } = classifyActor(g.actor_id, g.actor_type);
        discovered.push({
          id: g.actor_id,
          name,
          role,
          status: g.status,
          discovered: true,
          grant_id: g.id,
          source: 'smartware-grant',
        });
        namedIds.add(g.actor_id); // de-dupe across grant rows for same actor
      }
    } catch (error) {
      request.log.warn({ error }, 'agent-registry: smartware grants discovery failed');
    }

    // Tag the named ones with discovered: false for symmetry on the client.
    const enrichedNamed = named.map(a => ({
      ...a,
      discovered: false as const,
      harness: readHarnessProfileMetadata(a.metadata)?.harness_id ?? null,
    }));
    const core = await getSmartwareCore(env);
    const selectedScopes = named.flatMap(agent => agent.scopes ?? []);
    return {
      agents: [...enrichedNamed, ...discovered],
      data_spaces: listPodDataSpaces(core, env, selectedScopes),
    };
  });

  app.get('/pod/registry/agents/:agent_id', {
    schema: { summary: 'Get a named agent + its active grants.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { agent_id } = request.params as { agent_id: string };
    const agent = getAgent(db, agent_id);
    if (!agent) return reply.code(404).send({ error: 'not_found', message: 'Agent not found' });
    return { agent, grants: listAgentGrants(db, agent_id) };
  });

  app.get('/pod/registry/agents/:agent_id/profile-manifest', {
    schema: { summary: 'Export a portable, secret-free agent profile manifest.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { agent_id } = request.params as { agent_id: string };
    const agent = getAgent(db, agent_id);
    if (!agent) return reply.code(404).send({ error: 'not_found', message: 'Agent not found' });
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const manifest = buildAgentProfileManifest(db, env, agent, Object.keys(profile.scopes));
    return { manifest, integrity: agentProfileIntegrity(manifest) };
  });

  app.get('/pod/registry/agents/:agent_id/profile-materializations/:target_id', {
    schema: { summary: 'Preview a native agent profile projection without writing runtime state.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { agent_id, target_id } = request.params as { agent_id: string; target_id: string };
    const agent = getAgent(db, agent_id);
    if (!agent) return reply.code(404).send({ error: 'not_found', message: 'Agent not found' });
    if (!isAgentProfileTarget(target_id)) {
      return reply.code(404).send({ error: 'target_not_found', message: 'Profile materialization target not found' });
    }
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const manifest = buildAgentProfileManifest(db, env, agent, Object.keys(profile.scopes));
    return {
      manifest_integrity: agentProfileIntegrity(manifest),
      materialization: materializeAgentProfile(manifest, target_id),
    };
  });

  app.post('/pod/registry/agents/:agent_id/migrations/openclaw/preview', {
    schema: { summary: 'Preview a secret-safe OpenClaw to Pod and Hermes migration.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { agent_id } = request.params as { agent_id: string };
    const body = (request.body ?? {}) as {
      source_path?: string;
      workspace?: string;
      memory_scope?: string;
    };
    const agent = getAgent(db, agent_id);
    if (!agent) return reply.code(404).send({ error: 'not_found', message: 'Agent not found' });
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const writableScopes = agentAllowedScopeNames(agent, 'write', Object.keys(profile.scopes));
    const memoryScope = body.memory_scope?.trim() || writableScopes[0];
    if (!memoryScope || !writableScopes.includes(memoryScope)) {
      return reply.code(403).send({
        error: 'no_scope_access',
        message: 'This agent has no writable Pod data space for imported memory.',
      });
    }
    try {
      const discovery = await discoverOpenClawMigration({
        agent,
        source_path: body.source_path,
        workspace: body.workspace,
        memory_scope: memoryScope,
      });
      return { plan: discovery.plan };
    } catch (error) {
      if (error instanceof OpenClawMigrationError) {
        return reply.code(error.statusCode).send({ error: error.code, message: error.message });
      }
      throw error;
    }
  });

  app.post('/pod/registry/agents/:agent_id/migrations/openclaw/apply', {
    schema: { summary: 'Apply a previously previewed OpenClaw migration and return a rollback receipt.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { agent_id } = request.params as { agent_id: string };
    const body = (request.body ?? {}) as {
      source_path?: string;
      workspace?: string;
      memory_scope?: string;
      plan_digest?: string;
      resolutions?: Record<string, 'keep' | 'use_incoming'>;
    };
    const agent = getAgent(db, agent_id);
    if (!agent) return reply.code(404).send({ error: 'not_found', message: 'Agent not found' });
    if (!body.plan_digest?.trim()) {
      return reply.code(400).send({
        error: 'preview_required',
        message: 'plan_digest from a current migration preview is required.',
      });
    }
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const writableScopes = agentAllowedScopeNames(agent, 'write', Object.keys(profile.scopes));
    const memoryScope = body.memory_scope?.trim() || writableScopes[0];
    if (!memoryScope || !writableScopes.includes(memoryScope) || !profile.scopes[memoryScope]) {
      return reply.code(403).send({
        error: 'no_scope_access',
        message: 'This agent has no writable Pod data space for imported memory.',
      });
    }
    try {
      const result = await applyOpenClawMigration({
        db,
        core,
        agent,
        source_path: body.source_path,
        workspace: body.workspace,
        memory_scope_name: memoryScope,
        memory_scope_id: profile.scopes[memoryScope]!,
        expected_plan_digest: body.plan_digest,
        resolutions: body.resolutions,
      });
      const updatedAgent = getAgent(db, agent_id)!;
      const manifest = buildAgentProfileManifest(db, env, updatedAgent, Object.keys(profile.scopes));
      return {
        receipt: result.receipt,
        idempotent: result.idempotent,
        manifest_integrity: agentProfileIntegrity(manifest),
        hermes_projection: materializeAgentProfile(manifest, 'hermes'),
      };
    } catch (error) {
      if (error instanceof OpenClawMigrationError) {
        return reply.code(error.statusCode).send({ error: error.code, message: error.message });
      }
      throw error;
    }
  });

  app.get('/pod/registry/agents/:agent_id/migration-receipts', {
    schema: { summary: 'List reversible agent migration receipts.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { agent_id } = request.params as { agent_id: string };
    if (!getAgent(db, agent_id)) {
      return reply.code(404).send({ error: 'not_found', message: 'Agent not found' });
    }
    return { receipts: listAgentMigrationReceipts(db, agent_id) };
  });

  app.post('/pod/registry/agents/:agent_id/migration-receipts/:receipt_id/rollback', {
    schema: { summary: 'Rollback only the Pod state created or changed by one agent migration.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { agent_id, receipt_id } = request.params as { agent_id: string; receipt_id: string };
    try {
      const core = await getSmartwareCore(env);
      const receipt = await rollbackAgentMigration({
        db,
        core,
        agent_id,
        receipt_id,
      });
      return { receipt };
    } catch (error) {
      if (error instanceof OpenClawMigrationError) {
        return reply.code(error.statusCode).send({ error: error.code, message: error.message });
      }
      throw error;
    }
  });

  // Audit — what this brain has read and written. Feeds the trust dashboard:
  // every /pod/context read logs a system observation tagged context_read.
  app.get('/pod/registry/agents/:agent_id/activity', {
    schema: { summary: 'Recent memory activity for an agent (reads + writes) — the audit trail.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { agent_id } = request.params as { agent_id: string };
    const { limit } = request.query as { limit?: string };
    const core = await getSmartwareCore(env);
    let events: Array<Record<string, unknown>> = [];
    try {
      events = core.listActivity({ actorId: agent_id, limit: limit ? Number(limit) : 40 }) as unknown as Array<Record<string, unknown>>;
    } catch (err) {
      app.log.warn({ err, agent_id }, 'agent activity lookup failed');
    }
    // Normalise into audit rows the UI can render directly.
    const rows = events.map((e) => {
      const content = e.content;
      let action = String(e.type ?? 'activity');
      let detail = '';
      if (content && typeof content === 'object') {
        const body = (content as Record<string, unknown>).body ?? content;
        if (body && typeof body === 'object') {
          const b = body as Record<string, unknown>;
          if (b.action === 'context_read') {
            action = 'read';
            const scopes = Array.isArray(b.scopes) ? (b.scopes as string[]).join(', ') : '';
            detail = `${b.returned ?? 0} memories · ${scopes}${b.query ? ` · “${String(b.query).slice(0, 40)}”` : ''}`;
          }
        }
      }
      return {
        id: e.id,
        action,
        detail,
        scope: e.scope,
        at: e.observed_at,
      };
    });
    return { activity: rows };
  });

  // Subagent delegation — a parent brain spawns a child whose memory view is a
  // strict SUBSET of its own (attenuation: a child can never see more than its
  // parent), with its trust tier dropped a notch. The child is a first-class
  // agent row, so the audit trail and Brain UX apply to it automatically.
  app.post('/pod/agents/spawn', {
    schema: { summary: 'Spawn an attenuated subagent (scope view ⊆ parent, trust tier dropped).' },
  }, async (request, reply) => {
    // Parent is the authenticated agent (Bearer token). Owner may spawn too.
    const auth = request.coffeePodAuth;
    const parentId = auth?.kind === 'agent' ? auth.actor_id : undefined;
    if (!parentId && auth?.kind !== 'owner' && auth?.kind !== 'session') {
      // Only an authenticated agent or the owner can spawn.
      if (!await requireOwnerAuth(request, reply, env)) return;
    }
    const body = request.body as {
      name: string;
      persona?: string | null;
      scopes?: string[] | null;      // requested view — intersected with parent's
      context_budget?: number | null;
      model?: string | null;
    };
    if (!body.name || !body.name.trim()) {
      return reply.code(400).send({ error: 'invalid_payload', message: 'name is required' });
    }

    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const allScopeNames = Object.keys(profile.scopes);

    const parent = parentId ? getAgent(db, parentId) : null;
    // Parent's effective view: its brain scopes, or all (owner-spawned).
    const parentScopes = parent
      ? agentAllowedScopeNames(parent, 'read', allScopeNames)
      : allScopeNames;

    // Attenuation — the child sees only what BOTH the parent has and the
    // request asks for. Default: inherit the parent's full view.
    const requested = body.scopes && body.scopes.length > 0 ? body.scopes : parentScopes;
    const childScopes = requested.filter(s => parentScopes.includes(s));
    if (childScopes.length === 0) {
      return reply.code(403).send({
        error: 'attenuation_empty',
        message: 'Requested scopes are outside the parent brain’s view; a child cannot exceed its parent.',
      });
    }

    // Child budget cannot exceed the parent's.
    const parentBudget = parent?.context_budget ?? 1500;
    const childBudget = Math.min(body.context_budget ?? parentBudget, parentBudget);

    const childId = `agent:${(parent?.id ?? 'owner').replace(/^agent:/, '')}-${body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const child = upsertAgent(db, {
      id: childId,
      name: body.name.trim(),
      description: `Subagent of ${parent?.name ?? 'owner'}`,
      role: 'agent',
      model: body.model ?? parent?.model ?? null,
      persona: body.persona ?? parent?.persona ?? null,
      access_mode: 'scoped',
      scopes: childScopes,
      context_budget: childBudget,
      created_by: parent?.id ?? 'owner',
      metadata: {
        parent_id: parent?.id ?? 'owner',
        // Trust drops one tier from the parent (user_facing → background_agent).
        trust_tier: 'background_agent',
        spawned_at: new Date().toISOString(),
      },
    });
    syncAgentAccessGrant(core, profile, child);

    // The child needs a working bearer. If this call created the child, the
    // fresh value rides on `child.auth_token`; otherwise rotate — the stored
    // value is only a hash (POD-AUDIT-002), so re-spawning issues a new
    // bearer and the previous one dies.
    return {
      agent: child,
      token: child.auth_token ?? rotateAgentToken(db, child.id) ?? null,
      parent_id: parent?.id ?? 'owner',
      inherited_view: parentScopes,
      granted_view: childScopes,
    };
  });

  app.post('/pod/registry/agents', {
    schema: { summary: 'Create or update a named agent.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const body = request.body as {
      id?: string;
      name: string;
      description?: string;
      role?: 'agent' | 'substrate' | 'system';
      workspace_id?: string | null;
      model?: string | null;
      status?: string;
      metadata?: Record<string, unknown>;
      // Agent behaviour plus its enforced memory boundary.
      persona?: string | null;
      access_mode?: AgentAccessMode;
      scopes?: string[] | null;
      context_budget?: number | null;
    };
    if (!body.name || !body.name.trim()) {
      return reply.code(400).send({ error: 'invalid_payload', message: 'name is required' });
    }
    if (body.access_mode !== undefined && !isAgentAccessMode(body.access_mode)) {
      return reply.code(400).send({ error: 'invalid_payload', message: 'access_mode must be all, scoped, capture_only, or none' });
    }
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const availableScopes = new Set(Object.keys(profile.scopes));
    const unknownScopes = (body.scopes ?? []).filter(scope => !availableScopes.has(scope));
    if (unknownScopes.length > 0) {
      return reply.code(400).send({
        error: 'invalid_payload',
        message: `Unknown data space: ${unknownScopes.join(', ')}`,
      });
    }
    const agent = upsertAgent(db, { ...body, created_by: 'user' });
    syncAgentAccessGrant(core, profile, agent);
    return { agent };
  });

  app.delete('/pod/registry/agents/:agent_id', {
    schema: { summary: 'Delete or dismiss an agent. Named agents are deleted from the DB; discovered agents have their Smartware grant revoked.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { agent_id } = request.params as { agent_id: string };

    // Try deleting from the agents table first (named agents)
    const namedAgent = getAgent(db, agent_id);
    const deletedFromDb = deleteAgent(db, agent_id);
    if (deletedFromDb) {
      if (namedAgent) {
        const core = await getSmartwareCore(env);
        revokeAgentAccessGrant(core, namedAgent.id);
      }
      return { deleted: true };
    }

    // Not in DB — likely a discovered agent backed by a Smartware grant.
    // Revoke the grant so it stops appearing in the discovered list.
    try {
      const core = await getSmartwareCore(env);
      const config = core.getConfig();
      const grants = (config.grants ?? []) as Array<{ id: string; actor_id: string; status: string }>;
      const matching = grants.filter(g => g.actor_id === agent_id && g.status !== 'revoked');
      if (matching.length === 0) {
        return reply.code(404).send({ error: 'not_found', message: 'Agent not found' });
      }
      for (const g of matching) {
        g.status = 'revoked';
      }
      const { saveConfig } = await import('smartware');
      saveConfig(core.dataDir, config);
      return { deleted: true, dismissed: true };
    } catch (err) {
      request.log.warn({ err, agent_id }, 'agent-registry: dismiss discovered agent failed');
      return reply.code(500).send({ error: 'dismiss_failed', message: 'Could not revoke Smartware grant' });
    }
  });

  app.get('/pod/registry/agents/:agent_id/grants', {
    schema: { summary: 'List active collection grants for an agent.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { agent_id } = request.params as { agent_id: string };
    const q = request.query as { include_revoked?: string };
    return { grants: listAgentGrants(db, agent_id, q.include_revoked === 'true') };
  });

  app.post('/pod/registry/agents/:agent_id/grants', {
    schema: { summary: 'Grant an agent access to a collection (read by default).' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { agent_id } = request.params as { agent_id: string };
    const body = request.body as { collection_id: string; access?: 'read' | 'write'; note?: string };
    if (!getAgent(db, agent_id)) {
      return reply.code(404).send({ error: 'not_found', message: 'Agent not found' });
    }
    if (!body.collection_id) {
      return reply.code(400).send({ error: 'invalid_payload', message: 'collection_id is required' });
    }
    const grant = addAgentGrant(db, {
      agent_id,
      collection_id: body.collection_id,
      access: body.access ?? 'read',
      created_by: 'user',
      note: body.note,
    });
    return { grant };
  });

  app.delete('/pod/registry/agents/:agent_id/grants/:grant_id', {
    schema: { summary: 'Revoke an agent grant.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { grant_id } = request.params as { grant_id: string };
    const ok = revokeAgentGrant(db, grant_id);
    if (!ok) return reply.code(404).send({ error: 'not_found', message: 'Grant not found or already revoked' });
    return { revoked: true };
  });

  /**
   * GET /pod/registry/agents/:agent_id/connection
   *
   * Returns everything needed to hand off to the agent: actor_id, Pod URL,
   * bearer token, granted collections, capabilities, and a pre-rendered
   * invite blob the user can copy-paste into the agent's config OR chat.
   *
   * Owner-only. The bearer is stored only as a hash, so it can never be
   * re-read: `?reveal=1` rotates — minting a fresh bearer (the previous one
   * dies immediately) — and returns the new value for the invite blob.
   */
  app.get<{ Params: { agent_id: string } }>('/pod/registry/agents/:agent_id/connection', {
    schema: { summary: 'Return the parts needed to compose an agent invite; ?reveal=1 rotates the bearer and returns it once.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { agent_id } = request.params;
    const agent = getAgent(db, agent_id);
    if (!agent) return reply.code(404).send({ error: 'not_found', message: 'Agent not found' });

    // POD-AUDIT-002: storage holds sha256(token) only, so the raw bearer is
    // unrecoverable by design. Reveal mints a new one (rotating the old).
    const reveal = String((request.query as { reveal?: unknown } | undefined)?.reveal ?? '') === '1';
    let token: string | null = null;
    if (reveal) {
      token = rotateAgentToken(db, agent_id);
      if (!token) return reply.code(404).send({ error: 'not_found', message: 'Agent not found' });
    }
    const grants = listAgentGrants(db, agent_id);
    const podUrl = process.env['COFFEE_POD_URL'] || `http://${env.host}:${env.port}`;
    const collections = grants.map(g => g.collection_id);

    return {
      connection: {
        actor_id: agent.id,
        agent_name: agent.name,
        client_id: typeof agent.metadata?.client_id === 'string' ? agent.metadata.client_id : null,
        pod_url: podUrl,
        token,
        has_token: hasAgentToken(db, agent_id),
        grants: collections,
        access_mode: agent.access_mode,
        scopes: agent.scopes ?? [],
        capabilities: agent.access_mode === 'none'
          ? []
          : agent.access_mode === 'capture_only'
            ? ['observe']
            : ['recall', 'read', 'explain', 'observe'],
        harness: (() => {
          const profileMetadata = readHarnessProfileMetadata(agent.metadata);
          if (!profileMetadata) return null;
          const adapter = getHarnessAdapter(profileMetadata.harness_id);
          return adapter ? { ...profileMetadata, name: adapter.name, profile_label: adapter.profile_label } : null;
        })(),
      },
    };
  });

  /**
   * POST /pod/registry/agents/:agent_id/rotate-token
   *
   * Mints a new bearer token; old one dies immediately. Owner-only.
   */
  app.post<{ Params: { agent_id: string } }>('/pod/registry/agents/:agent_id/rotate-token', {
    schema: { summary: 'Rotate the per-agent bearer token.' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { agent_id } = request.params;
    const token = rotateAgentToken(db, agent_id);
    if (!token) return reply.code(404).send({ error: 'not_found', message: 'Agent not found' });
    return { token };
  });
}
