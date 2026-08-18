import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { chmod, mkdir } from 'node:fs/promises';

import type { CoffeePodEnv } from './config/env.js';
import { getDb } from './pod/db.js';
import { reconcilePodIdentity } from './pod/pod-identity.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerPodRoutes } from './routes/pod.js';
import { registerCoffeeRoutes } from './routes/coffee.js';
import { registerLibraryRoutes } from './routes/library.js';
import { registerContextRoutes } from './routes/context.js';
import { registerUiRoutes } from './routes/ui.js';
import { registerEventRoutes } from './routes/events.js';
import { registerGoogleDriveRoutes } from './routes/google-drive.js';
import { registerUploadRoutes } from './routes/upload.js';
import { registerInlineFileRoutes } from './routes/inline-files.js';
import { registerFolderImportRoutes } from './routes/folder-import.js';
import { registerVaultReadRoutes } from './routes/vault-read.js';
import { registerJournalRoutes } from './routes/journal.js';
import { registerSkillRoutes } from './routes/skills.js';
import { registerPluginRoutes } from './routes/plugins.js';
import { registerConnectionRoutes } from './routes/connections.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerWorkspaceRoutes } from './routes/workspaces.js';
import { registerIntegrationRoutes } from './routes/integrations.js';
import { registerIntegrationSourceRoutes } from './routes/integration-sources.js';
import { registerIntegrationPreviewRoutes } from './routes/integration-preview.js';
import { registerPinRoutes } from './routes/pin.js';
import { registerMcpConnectorRoutes } from './routes/mcp-connectors.js';
import { registerSyncRoutes } from './routes/sync.js';
import { registerWatchRoutes } from './routes/watch.js';
import { registerAgentRoutes } from './routes/agents.js';
import { registerPodExportRoutes } from './routes/pod-export.js';
import { registerWikiRoutes } from './routes/wiki.js';
import { registerAgentRegistryRoutes } from './routes/agents-registry.js';
import { registerMcpHttpRoutes } from './routes/mcp-http.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerHistoryRoutes } from './routes/history.js';
import { registerTelemetryRoutes } from './routes/telemetry.js';
import { registerDiagnosticRoutes } from './routes/diagnostics.js';
import { registerCodexProviderRoutes } from './routes/codex-provider.js';
import { registerOptionalApiTokenAuth } from './security/auth.js';
import { registerHostGuard } from './security/host-guard.js';
import { registerDiagnosticErrorCapture } from './services/diagnostics.js';
import { applyPendingRestore } from './services/pod-export.js';
import { startDreamScheduler } from './services/dream-cycle.js';
import { startReflectionScheduler } from './services/reflection-cycle.js';
import { shutdownMcpClients } from '@technodotventures/smartware-connectors';
import { codexAppServer } from './services/codex-app-server.js';

export async function buildApp(env: CoffeePodEnv, logger: boolean = true) {
  await mkdir(env.dataDir, { recursive: true, mode: 0o700 });
  await chmod(env.dataDir, 0o700);

  // A restore is staged by the running Pod and applied only on the next start,
  // before SQLite or Smartware can open a handle into the data directory.
  await applyPendingRestore(env.dataDir);
  // A restored directory may have originated on a more permissive filesystem.
  await chmod(env.dataDir, 0o700);

  const app = Fastify({
    // Raise from Fastify's 1 MiB default so large docs (pasted content,
    // imported PDFs, etc.) aren't silently truncated on save.
    bodyLimit: 10 * 1024 * 1024, // 10 MiB
    logger: logger
      ? {
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers["x-coffee-pod-token"]',
              'req.headers.cookie',
            ],
            censor: '[redacted]',
          },
        }
      : false,
  });

  registerDiagnosticErrorCapture(app, env);

  // Initialize SQLite — creates pod.db and runs migrations
  const db = getDb(env);
  // The data directory owns its Pod identity. This must happen after a staged
  // restore is applied and before Smartware profiles or workspace scopes open.
  reconcilePodIdentity(db, env);
  app.decorate('db', db);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Pod API',
        version: '0.1.0',
        description: 'User-owned memory companion API powered by Smartware.',
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  await registerHostGuard(app, env);
  await registerOptionalApiTokenAuth(app, env);
  await registerWorkspaceRoutes(app, env);

  await registerPinRoutes(app, env);
  await registerHealthRoutes(app);
  await registerUploadRoutes(app, env);
  await registerInlineFileRoutes(app, env);
  await registerFolderImportRoutes(app, env);
  await registerLibraryRoutes(app, env);
  await registerContextRoutes(app, env);
  await registerJournalRoutes(app, env);
  await registerVaultReadRoutes(app, env);
  await registerEventRoutes(app, env);
  await registerGoogleDriveRoutes(app, env);
  await registerSkillRoutes(app, env);
  await registerPluginRoutes(app, env);
  await registerConnectionRoutes(app, env);
  await registerIntegrationRoutes(app, env);
  await registerIntegrationSourceRoutes(app, env);
  await registerIntegrationPreviewRoutes(app, env);
  await registerMcpConnectorRoutes(app, env);
  await registerSettingsRoutes(app, env);
  await registerSyncRoutes(app, env);
  await registerWatchRoutes(app, env);
  await registerAgentRoutes(app, env);
  await registerPodRoutes(app, env);
  await registerPodExportRoutes(app, env);
  await registerWikiRoutes(app, env);
  await registerAgentRegistryRoutes(app, env);
  await registerMcpHttpRoutes(app, env);
  await registerWebhookRoutes(app, env);
  await registerHistoryRoutes(app, env);
  await registerTelemetryRoutes(app, env);
  await registerDiagnosticRoutes(app, env);
  await registerCodexProviderRoutes(app, env);
  await registerCoffeeRoutes(app, env);
  await registerUiRoutes(app);

  const stopDreamScheduler = startDreamScheduler(app, env);
  const stopReflectionScheduler = startReflectionScheduler(app, env);

  app.addHook('onClose', async () => {
    stopDreamScheduler();
    stopReflectionScheduler();
    await shutdownMcpClients(env);
    codexAppServer.close();
  });

  return app;
}
