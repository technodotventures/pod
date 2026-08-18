/**
 * Source-discovery endpoints used by the Calendar + Drive connection wizards.
 *
 *  GET  /integrations/google-calendar/calendars        list user's calendars
 *  POST /integrations/google-drive/sources             persist picker-selected folders
 *  GET  /integrations/google-drive/sources             return persisted folders
 */

import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { requireOwnerAuth } from '../security/auth.js';
import { readIntegrationConfig, writeIntegrationConfig } from '@technodotventures/smartware-connectors';
import { listGoogleCalendars, getDriveFile, ensureAccessToken } from '../services/google-api.js';
import type { DriveSourceConfig } from '../services/connection-pipeline.js';

/** Keys the connection wizard is allowed to persist into the integration
 *  config. Anything outside this allow-list is dropped — we don't want
 *  the UI overwriting OAuth tokens or scope state. */
const WIZARD_KEYS = new Set([
  'calendars',
  'filters',
  'capture_fields',
  'sources',
  'file_filters',
  'content_handling',
  'cadence',
  'scope_routing',
]);

interface CalendarPersisted {
  id: string;
  name: string;
  enabled: boolean;
  scope_override: string | null;
}

export async function registerIntegrationSourceRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  /**
   * GET /integrations/google-calendar/calendars
   * Returns the list of calendars from the user's Google account, with
   * persisted enabled / scope_override merged in.
   */
  app.get('/integrations/google-calendar/calendars', {
    schema: { summary: 'List Google calendars available to the connected account' },
  }, async (_request, reply) => {
    try {
      const fetched = await listGoogleCalendars(env);
      const stored = await readIntegrationConfig(env, 'google-calendar');
      const storedList = (stored.calendars as CalendarPersisted[] | undefined) ?? [];
      const storedById = new Map(storedList.map(c => [c.id, c]));

      const calendars = fetched.map(c => {
        const existing = storedById.get(c.id);
        return {
          id: c.id,
          name: c.summary,
          primary: Boolean(c.primary),
          access_role: c.accessRole,
          color: c.backgroundColor,
          enabled: existing?.enabled ?? Boolean(c.primary),
          scope_override: existing?.scope_override ?? null,
        };
      });
      return { calendars };
    } catch (error) {
      return reply.code(502).send({ error: 'google_api_error', message: (error as Error).message });
    }
  });

  /**
   * GET /integrations/google-drive/sources
   * Returns the persisted picker-selected folders.
   */
  app.get('/integrations/google-drive/sources', {
    schema: { summary: 'List Google Drive folders previously chosen via the picker' },
  }, async () => {
    const config = await readIntegrationConfig(env, 'google-drive');
    const sources = (config.sources as DriveSourceConfig[] | undefined) ?? [];
    return { sources };
  });

  /**
   * POST /integrations/google-drive/sources
   * Persists picker-selected folders. Verifies each via files.get so we
   * never store a folder the user can't actually access under
   * `drive.file` scope.
   */
  app.post<{ Body: { folders: Array<{ folder_id: string; folder_path?: string; scope_override?: string | null }> } }>(
    '/integrations/google-drive/sources',
    { schema: { summary: 'Persist picker-selected Drive folders' } },
    async (request, reply) => {
      if (!await requireOwnerAuth(request, reply, env)) return;
      const incoming = request.body?.folders ?? [];

      const verified: DriveSourceConfig[] = [];
      const failures: Array<{ folder_id: string; reason: string }> = [];
      for (const folder of incoming) {
        if (!folder.folder_id) continue;
        try {
          const meta = await getDriveFile(env, folder.folder_id);
          if (meta.mimeType !== 'application/vnd.google-apps.folder') {
            failures.push({ folder_id: folder.folder_id, reason: 'not a folder' });
            continue;
          }
          verified.push({
            folder_id: folder.folder_id,
            folder_path: folder.folder_path ?? `/${meta.name}`,
            scope_override: folder.scope_override ?? null,
          });
        } catch (error) {
          failures.push({ folder_id: folder.folder_id, reason: (error as Error).message });
        }
      }

      const existing = await readIntegrationConfig(env, 'google-drive');
      await writeIntegrationConfig(env, 'google-drive', { ...existing, sources: verified });
      return { sources: verified, failures };
    },
  );

  /**
   * POST /integrations/:service/wizard-config
   * Persist wizard-managed config keys (filters, capture, cadence, etc).
   * Allow-list enforced so the UI can't overwrite tokens or scope state.
   */
  app.post<{
    Params: { service: string };
    Body: Record<string, unknown>;
  }>('/integrations/:service/wizard-config', {
    schema: { summary: 'Persist connection-wizard config (filters, capture, cadence, sources)' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    if (request.params.service !== 'google-calendar' && request.params.service !== 'google-drive') {
      return reply.code(400).send({ error: 'unsupported_service' });
    }
    const incoming = request.body ?? {};
    const merged = { ...(await readIntegrationConfig(env, request.params.service)) };
    for (const [key, value] of Object.entries(incoming)) {
      if (WIZARD_KEYS.has(key)) merged[key] = value;
    }
    await writeIntegrationConfig(env, request.params.service, merged);
    return { ok: true };
  });

  /**
   * GET /integrations/google-drive/picker-token
   * Returns a short-lived access token the Google Picker JS client
   * needs to render the folder selector. Owner-only — never exposed to
   * client tokens. The token is the same OAuth token already on disk,
   * refreshed if expired.
   */
  app.get('/integrations/google-drive/picker-token', {
    schema: { summary: 'Mint a Picker-scoped OAuth access token for the UI' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    try {
      const access_token = await ensureAccessToken(env, 'google-drive');
      return { access_token };
    } catch (error) {
      return reply.code(400).send({ error: 'token_unavailable', message: (error as Error).message });
    }
  });
}
