import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { CoffeePodEnv } from '../config/env.js';
import { type ClientTokenSummary, verifyClientToken } from './client-tokens.js';
import { validateSession } from './sessions.js';
import { hasPinConfiguredSync, isReadOnly, resolveTrustMode } from './trust-mode.js';
import { getAgentByToken, getDb } from '../pod/db.js';

export type CoffeePodAuthContext =
  | { kind: 'owner' }
  | { kind: 'session' }
  | { kind: 'client'; client: ClientTokenSummary }
  | { kind: 'agent'; actor_id: string; agent_name: string };

declare module 'fastify' {
  interface FastifyRequest {
    coffeePodAuth?: CoffeePodAuthContext;
  }
}

const publicPrefixes = [
  '/health',
  '/docs',
  // Inline editor file storage: names are sha256 hashes (64 hex chars + ext),
  // not enumerable. <img src> can't send a bearer token. Anyone who has the
  // URL got it from an authenticated render path. NOTE: no trailing slash —
  // isPublicRoute() appends `/` when testing startsWith().
  '/pod/files/inline',
];
const publicPaths = [
  '/',
  '/app',
  '/documentation/json',
  '/documentation/yaml',
  '/integrations',
  '/integrations/google-drive/callback',
  '/pod/pin/status',
  '/pod/pin/verify',
  '/pod/session/status',
  '/pod/session/lock',
  '/pod/sync',
  '/pod/sync/status',
];

// Match OAuth callback endpoints for any service — external IdPs POST/GET to
// these without our token. The catch-all `/integrations/*` prefix was a
// defense-in-depth weakness because it also exempted /configure (writes
// OAuth secrets) and /tools/:tool/call (executes tools) from the global
// auth hook. Those routes do their own check, but the allowlist sent the
// wrong signal.
const OAUTH_CALLBACK_RE = /^\/integrations\/[^/]+\/callback$/;

function isPublicRoute(path: string): boolean {
  return publicPaths.includes(path)
    || path.startsWith('/assets/')
    || path.startsWith('/brand/')
    || path.startsWith('/fonts/')
    || OAUTH_CALLBACK_RE.test(path)
    || publicPrefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

function tokenFromRequest(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }

  const podToken = request.headers['x-coffee-pod-token'];
  return Array.isArray(podToken) ? podToken[0] : podToken;
}

/**
 * Check if a PIN file exists on disk. Lightweight stat-level check.
 */
async function hasPinConfigured(env: CoffeePodEnv): Promise<boolean> {
  try {
    await readFile(join(env.dataDir, 'pin.json'), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export async function registerOptionalApiTokenAuth(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.routeOptions.url ?? request.url;
    const isPublic = isPublicRoute(path);
    const trustMode = resolveTrustMode(env);
    const token = tokenFromRequest(request);

    // 1. API token auth (for MCP clients, external tools)
    if (env.apiToken && token === env.apiToken) {
      request.coffeePodAuth = { kind: 'owner' };
      return;
    }

    // 2. Client token auth (for connected Coffee clients)
    if (token) {
      const client = await verifyClientToken(env, token);
      if (client) {
        request.coffeePodAuth = { kind: 'client', client };
        return;
      }
    }

    // 3. Session token auth (from PIN verify)
    if (token) {
      const session = validateSession(token);
      if (session) {
        request.coffeePodAuth = { kind: 'session' };
        return;
      }
    }

    // 4. Per-agent bearer token (cpod_agent_*). Resolves the token to the
    // agents.id and treats the request as that actor for actor-scoped routes.
    // Owner-only routes still reject this kind via requireOwnerAuth.
    if (token && token.startsWith('cpod_agent_')) {
      try {
        const agent = getAgentByToken(getDb(env), token);
        if (agent) {
          if (agent.status !== 'active' && agent.status !== 'live') {
            await reply.code(403).send({
              error: 'agent_disabled',
              message: `Agent "${agent.name}" is ${agent.status} and cannot access this Pod.`,
            });
            return;
          }
          request.coffeePodAuth = { kind: 'agent', actor_id: agent.id, agent_name: agent.name };
          return;
        }
      } catch (e) {
        request.log.warn({ err: e }, 'agent-token auth check failed');
      }
      await reply.code(401).send({
        error: 'invalid_agent_token',
        message: 'This agent token is invalid or has been revoked.',
      });
      return;
    }

    // Re-check the PIN per request so enabling it closes an already-cached
    // open-mode window immediately. Explicit open mode never bypasses a PIN.
    // Credential checks intentionally happen first: a supplied agent token
    // must retain its bounded identity even on a locally open Pod.
    if (trustMode === 'open' && !hasPinConfiguredSync(env)) {
      request.coffeePodAuth = { kind: 'owner' };
      return;
    }

    // Public routes always pass through
    if (isPublic) return;

    // 'local-trust' mode: GETs and other read-only methods pass through without
    // auth so casual exploration works, but writes still require a credential.
    // requireOwnerAuth / requireActorAuth on write routes still gate them.
    if (trustMode === 'local-trust' && isReadOnly(request.method)) return;

    // If an API token is configured, require it for non-public routes
    if (env.apiToken) {
      await reply.code(401).send({
        error: 'unauthorized',
        message: 'Pod API token required',
      });
      return;
    }

    // If a PIN is configured, require a session for non-public routes
    const pinExists = await hasPinConfigured(env);
    if (pinExists) {
      await reply.code(401).send({
        error: 'session_required',
        message: 'PIN session required. Verify your PIN to continue.',
      });
      return;
    }

    // No auth configured — open access
  });
}

export async function requireOwnerAuth(request: FastifyRequest, reply: FastifyReply, env: CoffeePodEnv): Promise<boolean> {
  if (!env.apiToken) {
    // No API token — session auth or open access
    const auth = request.coffeePodAuth;
    if (auth?.kind === 'session') return true;
    // If no auth at all, it's open access (no PIN set)
    if (!auth) return true;
  }
  if (request.coffeePodAuth?.kind === 'owner') return true;
  if (request.coffeePodAuth?.kind === 'session') return true;

  await reply.code(403).send({
    error: 'forbidden',
    message: 'Owner token required for this Pod operation',
  });
  return false;
}

export async function requireActorAuth(request: FastifyRequest, reply: FastifyReply, env: CoffeePodEnv, actorId: string): Promise<boolean> {
  if (!env.apiToken) {
    const auth = request.coffeePodAuth;
    if (auth?.kind === 'session') return true;
    if (!auth) return true;
  }
  const auth = request.coffeePodAuth;
  if (auth?.kind === 'owner') return true;
  if (auth?.kind === 'session') return true;
  if (auth?.kind === 'client' && auth.client.actor_id === actorId) return true;
  // Agent-bearer auth: the resolved agent.id must match the actor the route
  // is being called for. This prevents Hermes' token from impersonating a
  // different agent via the actor_id body field.
  if (auth?.kind === 'agent' && auth.actor_id === actorId) return true;

  await reply.code(403).send({
    error: 'forbidden',
    message: 'Token is not allowed to act as the requested actor',
  });
  return false;
}
