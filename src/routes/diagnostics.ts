import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { requireOwnerAuth } from '../security/auth.js';
import { generateDiagnosticReport } from '../services/diagnostics.js';

export async function registerDiagnosticRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  app.get('/pod/diagnostics', {
    schema: {
      summary: 'Preview a content-free support diagnostics report.',
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    reply.header('cache-control', 'no-store');
    try {
      return await generateDiagnosticReport(env);
    } catch {
      return reply.code(500).send({
        error: 'diagnostics_failed',
        message: 'The diagnostics report could not be generated safely.',
      });
    }
  });
}
