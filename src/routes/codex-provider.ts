import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { codexAppServer } from '../services/codex-app-server.js';
import { writeIntegrationConfig } from '@smartware/connectors';

export async function registerCodexProviderRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  app.get('/providers/codex/status', async () => codexAppServer.status());

  app.post('/providers/codex/login', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const mode = body.mode === 'device' ? 'device' : body.mode === 'browser' ? 'browser' : null;
    if (!mode) return reply.code(400).send({ error: 'invalid_mode', message: 'Mode must be browser or device.' });
    try {
      return await codexAppServer.login(mode);
    } catch (error) {
      return reply.code(503).send({ error: 'codex_login_failed', message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get('/providers/codex/login/:loginId', async (request) => {
    const { loginId } = request.params as { loginId: string };
    const result = codexAppServer.loginStatus(loginId);
    if (result.state === 'connected') {
      await writeIntegrationConfig(env, 'codex', {
        authenticated: true,
        selected_for_ai: true,
        connected_at: new Date().toISOString(),
      });
    }
    return result;
  });

  app.post('/providers/codex/login/:loginId/cancel', async (request, reply) => {
    const { loginId } = request.params as { loginId: string };
    try {
      await codexAppServer.cancel(loginId);
      return { ok: true };
    } catch (error) {
      return reply.code(503).send({ error: 'codex_cancel_failed', message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/providers/codex/logout', async (_request, reply) => {
    try {
      await codexAppServer.logout();
      await writeIntegrationConfig(env, 'codex', { authenticated: false, selected_for_ai: false });
      return { ok: true };
    } catch (error) {
      return reply.code(503).send({ error: 'codex_logout_failed', message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/providers/codex/select', async (_request, reply) => {
    const status = await codexAppServer.status();
    if (!status.connected || status.auth_mode !== 'chatgpt') {
      return reply.code(409).send({ error: 'codex_not_connected', message: 'Connect Codex with ChatGPT first.' });
    }
    await writeIntegrationConfig(env, 'codex', {
      authenticated: true,
      selected_for_ai: true,
      connected_at: new Date().toISOString(),
    });
    return { ok: true };
  });
}
