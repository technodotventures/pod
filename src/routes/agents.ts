import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { requireOwnerAuth } from '../security/auth.js';
import { getMcpHealth, prewarmProviders } from '@smartware/connectors';
import { detectInstalledAgents } from '../services/agent-detection.js';
import { applyAgentMcpConfig, parseRemoteMcpServerEntry } from '../services/agent-connection.js';

/** Allow-list of agent config directories we'll reveal. Keeps the route from being a generic file-opener. */
function isAllowedRevealPath(p: string): boolean {
  const home = os.homedir();
  const allowedRoots = [
    path.join(home, 'Library', 'Application Support'),
    path.join(home, '.config'),
    path.join(home, '.cursor'),
    path.join(home, '.continue'),
    path.join(home, '.claude'),
    path.join(home, '.zed'),
    path.join(home, '.hermes'),
    path.join(home, '.openclaw'),
    path.join(home, '.kimi-code'),
  ];
  const resolved = path.resolve(p);
  if (allowedRoots.some(root => resolved === root || resolved.startsWith(root + path.sep))) return true;
  const relative = path.relative(home, resolved);
  const firstSegment = relative.split(path.sep)[0] ?? '';
  return /^\.openclaw-[A-Za-z0-9_-]+$/.test(firstSegment) && !relative.startsWith(`..${path.sep}`);
}

export async function registerAgentRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  /**
   * GET /pod/mcp/health
   * Reports whether MCP backend is enabled, whether docker is reachable, and
   * which provider images/containers are present + running.
   */
  app.get('/pod/mcp/health', {
    schema: { summary: 'MCP backend (docker + Klavis images) health' },
  }, async () => {
    return getMcpHealth(env);
  });

  /**
   * POST /pod/mcp/warm
   * Pre-start MCP server containers so first tool calls don't pay cold-start
   * latency (~5-10s for docker run + python boot). Owner-only since it consumes
   * resources. Sequential to avoid overwhelming Docker.
   */
  app.post<{ Body?: { providers?: string[] } }>('/pod/mcp/warm', {
    schema: { summary: 'Pre-warm one or more Klavis MCP containers' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const ids = request.body?.providers;
    return prewarmProviders(env, Array.isArray(ids) && ids.length > 0 ? ids : undefined);
  });

  /**
   * GET /pod/agents/detect
   * Filesystem + PATH probe to detect which agent client apps are installed on the host.
   * Used by the Connections UI to badge cards as "Installed" / "Not installed".
   */
  app.get('/pod/agents/detect', {
    schema: { summary: 'Detect agent clients installed on this host' },
  }, async () => {
    return { agents: await detectInstalledAgents() };
  });

  /**
   * POST /pod/agents/apply-config
   * Install a bounded Pod HTTP MCP entry for a known local client.
   * Each strategy is allow-listed server-side; the caller cannot choose a
   * filesystem path or executable.
   */
  app.post<{ Body: { agent_id: string; profile_id?: string; server_entry: Record<string, unknown> } }>('/pod/agents/apply-config', {
    schema: { summary: 'Auto-merge Pod MCP entry into an agent config file' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { agent_id, profile_id, server_entry } = request.body ?? {} as { agent_id?: string; profile_id?: string; server_entry?: Record<string, unknown> };
    if (!agent_id || typeof agent_id !== 'string') {
      return reply.code(400).send({ error: 'invalid_input', message: 'agent_id is required' });
    }
    const parsedEntry = parseRemoteMcpServerEntry(server_entry);
    if (!parsedEntry) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: 'server_entry must be an HTTP MCP URL ending in /mcp with a bounded Coffee agent token.',
      });
    }

    try {
      return await applyAgentMcpConfig(agent_id, parsedEntry, { profileId: profile_id });
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === 'not_supported' || code === 'invalid_profile' || code === 'config_path_required') {
        return reply.code(400).send({ error: code, message: (error as Error).message });
      }
      if (code === 'malformed_existing_config') {
        return reply.code(409).send({ error: code, message: (error as Error).message });
      }
      request.log.warn({ error, agent_id }, 'agent MCP config apply failed');
      return reply.code(500).send({ error: 'apply_failed', message: (error as Error).message });
    }
  });

  /**
   * POST /pod/agents/reveal-config
   * Opens the OS file browser at a given config file's directory, selecting the file.
   * macOS only for now (uses `open -R`). Path is allow-listed.
   */
  app.post<{ Body: { path: string } }>('/pod/agents/reveal-config', {
    schema: { summary: 'Reveal an agent config file in the OS file browser' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const target = request.body?.path;
    if (!target || typeof target !== 'string') {
      return reply.code(400).send({ error: 'invalid_input', message: 'path is required' });
    }
    if (!isAllowedRevealPath(target)) {
      return reply.code(403).send({ error: 'path_not_allowed', message: 'Path is outside the allow-listed agent config roots' });
    }
    if (process.platform !== 'darwin') {
      return reply.code(501).send({ error: 'unsupported_platform', message: `reveal-config is currently macOS-only (platform: ${process.platform})` });
    }
    await new Promise<void>(resolve => {
      const child = spawn('open', ['-R', target], { stdio: 'ignore', detached: true });
      child.on('error', () => resolve());
      child.on('close', () => resolve());
      child.unref();
    });
    return { ok: true, revealed: target };
  });
}
