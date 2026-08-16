// /pod/telemetry route (PR-20). Plan §7.

import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { requireOwnerAuth } from '../security/auth.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { aggregateTelemetry } from '../services/telemetry.js';

export async function registerTelemetryRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  app.get('/pod/telemetry', {
    schema: {
      summary: 'Aggregate rollout telemetry over the canonical operations log.',
      querystring: {
        type: 'object',
        properties: { since: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const core = await getSmartwareCore(env);
    const q = request.query as { since?: string };
    return aggregateTelemetry(core, q.since);
  });
}
