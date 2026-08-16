import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', {
    schema: {
      summary: 'Health check',
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            service: { type: 'string' },
          },
          required: ['ok', 'service'],
        },
      },
    },
  }, async () => ({ ok: true, service: 'coffee-pod' }));
}
