import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { requireActorAuth, requireOwnerAuth } from '../security/auth.js';
import {
  callExternalMcpReadOnlyTool,
  deleteExternalMcpServer,
  listExternalMcpServers,
  listExternalMcpTools,
  searchExternalMcpContext,
  upsertExternalMcpServer,
} from '@smartware/connectors';

export async function registerMcpConnectorRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  app.get('/pod/mcp/servers', {
    schema: { summary: 'List configured external MCP servers' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    return { servers: await listExternalMcpServers(env) };
  });

  app.post('/pod/mcp/servers', {
    schema: { summary: 'Create or update an external MCP server config' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    try {
      return { server: await upsertExternalMcpServer(env, request.body as Record<string, unknown>) };
    } catch (error) {
      return reply.code(400).send({ error: 'invalid_mcp_server', message: (error as Error).message });
    }
  });

  app.delete('/pod/mcp/servers/:server_id', {
    schema: { summary: 'Delete an external MCP server config' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const params = request.params as { server_id: string };
    const deleted = await deleteExternalMcpServer(env, params.server_id);
    if (!deleted) return reply.code(404).send({ error: 'not_found', message: 'MCP server not found' });
    return { deleted: true };
  });

  app.get('/pod/mcp/servers/:server_id/tools', {
    schema: { summary: 'List tools exposed by an external MCP server' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const params = request.params as { server_id: string };
    try {
      return await listExternalMcpTools(env, params.server_id);
    } catch (error) {
      return reply.code(400).send({ error: 'mcp_list_tools_failed', message: (error as Error).message });
    }
  });

  app.post('/pod/mcp/servers/:server_id/tools/:tool_name/call', {
    schema: { summary: 'Call an allowlisted read-only external MCP tool' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const params = request.params as { server_id: string; tool_name: string };
    const body = request.body as { arguments?: Record<string, unknown> };
    try {
      return {
        result: await callExternalMcpReadOnlyTool(env, params.server_id, params.tool_name, body.arguments ?? {}),
      };
    } catch (error) {
      return reply.code(400).send({ error: 'mcp_tool_call_failed', message: (error as Error).message });
    }
  });

  app.post('/pod/mcp/context', {
    schema: { summary: 'Search enabled read-only external MCP context sources' },
  }, async (request, reply) => {
    const body = request.body as { actor_id: string; query: string; limit?: number };
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    return {
      context: await searchExternalMcpContext(env, body.query, { limit: body.limit }),
    };
  });
}
