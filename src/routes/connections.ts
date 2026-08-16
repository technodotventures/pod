import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { requireOwnerAuth } from '../security/auth.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { getDb, listSkills } from '../pod/db.js';
import {
  createConnectionGrant,
  listConnectionGrants,
  revokeConnectionGrant,
  listMcpProviders,
  listMcpCalls,
  approveGrantRequest,
  createGrantRequest,
  denyGrantRequest,
  listGrantRequests,
} from '@smartware/connectors';

export async function registerConnectionRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);

  app.get('/pod/grants', {
    schema: { summary: 'List Smartware grants with linked skill metadata' },
  }, async (request, reply) => {
    // Grant listings expose every paired actor and its capabilities. Lock to
    // owner so a single paired client can't enumerate sibling clients.
    if (!await requireOwnerAuth(request, reply, env)) return;
    const core = await getSmartwareCore(env);
    const config = core.getConfig();
    const grants = (config.grants ?? []) as unknown as Array<{
      id: string;
      actor_id: string;
      actor_type: string;
      scopes: string[];
      capabilities: string[];
      status: string;
      created_at: string;
    }>;
    const skills = listSkills(db, {});

    const enriched = grants.map(g => {
      const skill = skills.find(s => s.grant_id === g.id);
      return {
        ...g,
        skill_name: skill?.name ?? null,
        skill_id: skill?.id ?? null,
        description: skill?.description ?? null,
        trust_score: skill?.trust_score ?? null,
        trust_level: skill?.trust_level ?? null,
      };
    });

    return { grants: enriched };
  });

  /**
   * GET /pod/connection-grants
   * List per-actor grants that authorize MCP tool calls against integrations.
   * Owner-only.
   */
  app.get<{ Querystring: { actor_id?: string; service_id?: string } }>('/pod/connection-grants', {
    schema: { summary: 'List connection grants (actor × integration tool patterns)' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const rows = listConnectionGrants(db, {
      actor_id: request.query.actor_id,
      service_id: request.query.service_id,
    });
    return { grants: rows };
  });

  /**
   * POST /pod/connection-grants
   * Create a connection grant. Body: { actor_id, service_id, tool_pattern?, expires_at?, note? }.
   * service_id must be a registered MCP provider.
   */
  app.post<{
    Body: { actor_id: string; service_id: string; tool_pattern?: string; expires_at?: number | null; note?: string };
  }>('/pod/connection-grants', {
    schema: { summary: 'Create a connection grant' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const body = request.body;
    if (!body?.actor_id || !body?.service_id) {
      return reply.code(400).send({ error: 'invalid_input', message: 'actor_id and service_id are required' });
    }
    const provider = listMcpProviders().find(p => p.id === body.service_id);
    if (!provider) {
      return reply.code(400).send({ error: 'unknown_service', message: `${body.service_id} is not a registered MCP provider` });
    }
    const row = createConnectionGrant(db, {
      actor_id: body.actor_id,
      service_id: body.service_id,
      tool_pattern: body.tool_pattern,
      expires_at: body.expires_at ?? null,
      created_by: 'owner',
      note: body.note,
    });
    return { grant: row };
  });

  /**
   * DELETE /pod/connection-grants/:id
   * Revoke a connection grant. Idempotent.
   */
  app.delete<{ Params: { id: string } }>('/pod/connection-grants/:id', {
    schema: { summary: 'Revoke a connection grant' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const row = revokeConnectionGrant(db, request.params.id);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return { grant: row };
  });

  /**
   * GET /pod/connection-grants/audit
   * Owner-only view of every MCP tool call (success, error, denial).
   */
  app.get<{ Querystring: { actor_id?: string; service_id?: string; status?: 'ok' | 'error'; limit?: string; since?: string } }>(
    '/pod/connection-grants/audit',
    { schema: { summary: 'Audit log of MCP tool calls' } },
    async (request, reply) => {
      if (!await requireOwnerAuth(request, reply, env)) return;
      const calls = listMcpCalls(db, {
        actor_id: request.query.actor_id,
        service_id: request.query.service_id,
        status: request.query.status,
        since: request.query.since,
        limit: request.query.limit ? Number(request.query.limit) : undefined,
      });
      return { calls };
    },
  );

  /**
   * POST /pod/connection-grants/requests
   * Any authenticated caller can request a grant for an actor they speak for.
   * Owner can request on behalf of any actor; client tokens can only request for themselves.
   */
  app.post<{
    Body: { actor_id?: string; service_id: string; tool_pattern?: string; reason?: string; requested_expires_at?: number | null };
  }>('/pod/connection-grants/requests', {
    schema: { summary: 'Request a connection grant (creates a pending request)' },
  }, async (request, reply) => {
    const body = request.body;
    if (!body?.service_id) return reply.code(400).send({ error: 'invalid_input', message: 'service_id is required' });
    if (!listMcpProviders().some(p => p.id === body.service_id)) {
      return reply.code(400).send({ error: 'unknown_service', message: `${body.service_id} is not a registered MCP provider` });
    }
    // Client tokens can only request for themselves — preventing one agent
    // from front-running a grant request on another agent's behalf.
    // Owner tokens may name any actor (used by the UI to seed requests).
    const auth = request.coffeePodAuth;
    const actorId = auth?.kind === 'client'
      ? auth.client.actor_id
      : (body.actor_id ?? 'person-local');

    const row = createGrantRequest(db, {
      actor_id: actorId,
      service_id: body.service_id,
      tool_pattern: body.tool_pattern,
      reason: body.reason,
      requested_expires_at: body.requested_expires_at,
    });
    return { request: row };
  });

  /**
   * GET /pod/connection-grants/requests
   * Owner-only list of grant requests, defaulting to pending.
   */
  app.get<{ Querystring: { status?: 'pending' | 'approved' | 'denied'; actor_id?: string } }>(
    '/pod/connection-grants/requests',
    { schema: { summary: 'List grant requests' } },
    async (request, reply) => {
      if (!await requireOwnerAuth(request, reply, env)) return;
      const rows = listGrantRequests(db, {
        status: request.query.status ?? 'pending',
        actor_id: request.query.actor_id,
      });
      return { requests: rows };
    },
  );

  /**
   * POST /pod/connection-grants/requests/:id/approve
   * Owner approves a pending request — creates the actual connection_grant.
   * Body may override tool_pattern, expires_at, note.
   */
  app.post<{
    Params: { id: string };
    Body: { tool_pattern?: string; expires_at?: number | null; note?: string };
  }>('/pod/connection-grants/requests/:id/approve', {
    schema: { summary: 'Approve a pending grant request' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const result = approveGrantRequest(db, request.params.id, 'owner', request.body ?? {});
    if (!result) return reply.code(404).send({ error: 'not_found_or_not_pending' });
    return result;
  });

  /**
   * POST /pod/connection-grants/requests/:id/deny
   * Owner denies a pending request.
   */
  app.post<{ Params: { id: string } }>('/pod/connection-grants/requests/:id/deny', {
    schema: { summary: 'Deny a pending grant request' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const row = denyGrantRequest(db, request.params.id, 'owner');
    if (!row) return reply.code(404).send({ error: 'not_found_or_not_pending' });
    return { request: row };
  });
}
