import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(dirname, '../../dist-ui');

export async function registerUiRoutes(app: FastifyInstance): Promise<void> {
  if (!fs.existsSync(path.join(uiRoot, 'index.html'))) return;

  await app.register(fastifyStatic, {
    root: path.join(uiRoot, 'assets'),
    prefix: '/assets/',
    wildcard: false,
  });

  if (fs.existsSync(path.join(uiRoot, 'brand'))) {
    await app.register(fastifyStatic, {
      root: path.join(uiRoot, 'brand'),
      prefix: '/brand/',
      wildcard: false,
      decorateReply: false,
    });
  }

  if (fs.existsSync(path.join(uiRoot, 'fonts'))) {
    await app.register(fastifyStatic, {
      root: path.join(uiRoot, 'fonts'),
      prefix: '/fonts/',
      wildcard: false,
      decorateReply: false,
    });
  }

  app.get('/', async (_request, reply) => {
    return reply.type('text/html').send(fs.readFileSync(path.join(uiRoot, 'index.html'), 'utf8'));
  });
  app.get('/app', async (_request, reply) => {
    return reply.type('text/html').send(fs.readFileSync(path.join(uiRoot, 'index.html'), 'utf8'));
  });
}
