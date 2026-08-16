// /pod/export and /pod/import routes (PR-13 / F6).
//
// Operator-facing primitives. Owner-token gated.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { getDb } from '../pod/db.js';
import { exportPodData, importPodData } from '../services/pod-export.js';
import { requireOwnerAuth } from '../security/auth.js';

export async function registerPodExportRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  app.post('/pod/export', {
    schema: {
      summary: 'Export Pod canonical surfaces as a tarball.',
      body: {
        type: 'object',
        properties: {
          output_dir: { type: 'string' },
          filename: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const body = (request.body ?? {}) as { output_dir?: string; filename?: string };
    const outDir = body.output_dir ?? path.join(env.dataDir, 'exports');
    const fileName = body.filename ?? `pod-${new Date().toISOString().replace(/[:.]/g, '-')}.tar.gz`;
    if (!fileName.endsWith('.tar.gz') || path.basename(fileName) !== fileName || fileName.includes('\0')) {
      return reply.code(400).send({
        error: { code: 'invalid_payload', message: 'filename must be a simple .tar.gz filename.' },
      });
    }
    await mkdir(outDir, { recursive: true });
    const outputPath = path.join(outDir, fileName);
    try {
      const result = await exportPodData(env.dataDir, outputPath, {}, getDb(env));
      return {
        ...result,
        warning: result.contains_connector_credentials
          ? 'This backup contains private memory and connector credentials. Store and share it securely.'
          : 'This backup contains private memory. Store and share it securely.',
      };
    } catch (err) {
      return reply.code(500).send({
        error: { code: 'export_failed', message: (err as Error).message },
      });
    }
  });

  app.post('/pod/import', {
    schema: {
      summary: 'Validate and stage a Pod restore for the next restart.',
      body: {
        type: 'object',
        properties: {
          input_path: { type: 'string' },
          confirm: { type: 'boolean' },
        },
        required: ['input_path', 'confirm'],
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const body = request.body as { input_path: string; confirm: boolean };
    if (!body.confirm) {
      return reply.code(400).send({
        error: { code: 'invalid_payload', message: 'Restore is destructive; confirm: true required.' },
      });
    }
    try {
      const result = await importPodData(body.input_path, env.dataDir);
      return {
        ...result,
        note: 'Restore validated and staged. Restart the Pod to apply it before migrations and recovery run.',
      };
    } catch (err) {
      return reply.code(500).send({
        error: { code: 'import_failed', message: (err as Error).message },
      });
    }
  });
}
