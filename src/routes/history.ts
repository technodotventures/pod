// History view route (PR-19 / F5).
//
// Reads the canonical ops log at pod_data/operations/*.jsonl and surfaces
// filterable entries for the cockpit's History view.

import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { readAllOpLogEntries, type OpLogEntry, type OpType } from 'smartware';

interface HistoryFilters {
  actor_id?: string;
  op?: OpType;
  since?: string; // ISO 8601
  until?: string; // ISO 8601
  /** Substring match on JSON-stringified `details` to find artifact references. */
  artifact?: string;
  limit?: number;
}

export async function registerHistoryRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  app.get('/pod/history', {
    schema: {
      summary: 'Read the canonical operations log with filters.',
      querystring: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          op: { type: 'string' },
          since: { type: 'string' },
          until: { type: 'string' },
          artifact: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  }, async (request) => {
    const core = await getSmartwareCore(env);
    const q = request.query as HistoryFilters;
    const limit = q.limit ?? 200;
    const out: OpLogEntry[] = [];
    for (const entry of readAllOpLogEntries(core.opsDir)) {
      if (q.actor_id && entry.actor_id !== q.actor_id) continue;
      if (q.op && entry.op !== q.op) continue;
      if (q.since && entry.timestamp < q.since) continue;
      if (q.until && entry.timestamp > q.until) continue;
      if (q.artifact) {
        const haystack = JSON.stringify(entry.details ?? {});
        if (!haystack.includes(q.artifact)) continue;
      }
      out.push(entry);
    }
    // Return newest first; bounded by limit.
    out.reverse();
    return { entries: out.slice(0, limit), total_matched: out.length };
  });
}
