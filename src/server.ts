import { loadEnv } from './config/env.js';
import { closeSmartwareCore } from './smartware/core.js';
import { closeDb } from './pod/db.js';
import { buildApp } from './app.js';

const env = loadEnv();

const app = await buildApp(env);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await closeSmartwareCore();
    closeDb();
    await app.close();
    process.exit(0);
  });
}

await app.listen({ host: env.host, port: env.port });
