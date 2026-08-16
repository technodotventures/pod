// HTTP transport for Pod's own MCP server.
//
// Wraps the existing `createCoffeePodMcpServer()` factory (which only knew
// how to speak stdio) with `StreamableHTTPServerTransport` so external agents
// (Hermes, Claude Code over network, etc.) can reach it via:
//
//   POST  /mcp     ← JSON-RPC over Streamable HTTP
//   GET   /mcp     ← SSE notifications stream
//   DELETE /mcp    ← session teardown
//
// Auth model:
//   - Pod's onRequest hook already validates `Authorization: Bearer ...`
//     before reaching this handler. Agent bearer tokens resolve to
//     `request.coffeePodAuth = { kind: 'agent', actor_id, ... }`.
//   - Owner API tokens still work (`kind: 'owner'`).
//   - Anything else gets 401 at the global hook.
//
// Stateless mode is used (sessionIdGenerator: undefined) — each JSON-RPC
// request gets a fresh server+transport pair. Trades long-lived subscriptions
// for simplicity; Pod's tool surface today is request/response so we don't
// lose anything practical. Migrate to stateful when we add server-pushed
// notifications.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createCoffeePodMcpServer } from '../mcp-server.js';
import { loadCoffeePodMcpEnv } from '../mcp/pod-api.js';
import type { CoffeePodEnv } from '../config/env.js';

async function handleMcp(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Hand the raw response over to the transport — Fastify must not try to
  // write its own response on top.
  reply.hijack();

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const authorization = request.headers.authorization;
  const requestToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : undefined;
  const baseEnv = loadCoffeePodMcpEnv();
  const server = createCoffeePodMcpServer({
    // Forward the credential that authenticated this MCP connection. Without
    // this, the in-process HTTP bridge would silently use the Pod owner token
    // for its internal API calls and erase the boundary around agent tokens.
    env: requestToken ? { ...baseEnv, apiToken: requestToken } : baseEnv,
    actorId: request.coffeePodAuth?.kind === 'agent' ? request.coffeePodAuth.actor_id : undefined,
  });

  // Close transport when the underlying socket goes away so we don't leak.
  reply.raw.on('close', () => {
    void transport.close().catch(() => { /* already closed */ });
    void server.close().catch(() => { /* already closed */ });
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  } catch (err) {
    request.log.error({ err }, 'mcp-http: handleRequest failed');
    if (!reply.raw.headersSent) {
      reply.raw.statusCode = 500;
      reply.raw.setHeader('content-type', 'application/json');
      reply.raw.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null }));
    }
  }
}

export async function registerMcpHttpRoutes(app: FastifyInstance, _env: CoffeePodEnv): Promise<void> {
  // All three HTTP verbs of the Streamable HTTP transport spec.
  app.post('/mcp', { schema: { hide: true } }, handleMcp);
  app.get('/mcp', { schema: { hide: true } }, handleMcp);
  app.delete('/mcp', { schema: { hide: true } }, handleMcp);
}
