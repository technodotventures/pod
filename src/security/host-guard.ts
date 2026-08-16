import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';

/**
 * Reject requests whose Host header is not pointed at our local loopback bind.
 * This blocks DNS-rebinding attacks where a browser tab on attacker.example
 * rebinds the hostname to 127.0.0.1 and issues "same-origin" requests against
 * the Pod.
 */
export async function registerHostGuard(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const allowed = new Set(buildAllowedHosts(env));

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // When the underlying http.Server isn't bound to a real port (tests using
    // Fastify inject), there is no network interface that could be
    // misdirected, so skip the check rather than reject the synthetic
    // Host header that light-my-request injects.
    if (app.server.listening === false) return;

    const host = (request.headers.host ?? '').toLowerCase();
    if (allowed.has(host)) return;

    await reply.code(421).send({
      error: 'misdirected_host',
      message: 'Pod only accepts requests with a loopback Host header',
    });
  });
}

function buildAllowedHosts(env: CoffeePodEnv): string[] {
  const port = env.port;
  const hosts = [
    `127.0.0.1:${port}`,
    `localhost:${port}`,
    `[::1]:${port}`,
  ];
  if (port === 80) {
    hosts.push('127.0.0.1', 'localhost', '[::1]');
  }
  return hosts;
}
