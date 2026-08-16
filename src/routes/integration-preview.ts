/**
 * `POST /integrations/:service/preview` — dry-run the ingestion pipeline.
 *
 * Fetches a small batch of live data from the connected source, runs it
 * through the same filter / capture / scope-routing pipeline as
 * `/pod/sync`, and returns the observation-shaped JSON without ever
 * calling `core.observe()`. The wizard preview step renders these into
 * cards so the user sees exactly what would land in their Pod.
 */

import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { requireOwnerAuth } from '../security/auth.js';
import { readIntegrationConfig } from '@smartware/connectors';
import { ensureAppDataSpace } from '../pod/data-spaces.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import {
  applyCalendarFilters,
  applyDriveFilters,
  buildCalendarObservation,
  buildDriveObservation,
  resolveScope,
  DEFAULT_CALENDAR_FILTERS,
  DEFAULT_CALENDAR_CAPTURE,
  DEFAULT_DRIVE_FILE_FILTERS,
  DEFAULT_DRIVE_CONTENT_HANDLING,
  DEFAULT_SCOPE_ROUTING,
  type CalendarFilters,
  type CalendarCaptureFields,
  type CalendarSourceConfig,
  type DriveFileFilters,
  type DriveContentHandling,
  type DriveSourceConfig,
  type ScopeRouting,
  type ObservationPreview,
  type ScopeProfile,
} from '../services/connection-pipeline.js';
import {
  listGoogleCalendarEvents,
  listDriveFilesInFolder,
  fetchDriveFileText,
} from '../services/google-api.js';

const PREVIEW_LIMIT_CALENDAR = 10;
const PREVIEW_LIMIT_DRIVE = 10;

interface CalendarOverrides {
  calendars?: CalendarSourceConfig[];
  filters?: Partial<CalendarFilters>;
  capture_fields?: Partial<CalendarCaptureFields>;
  scope_routing?: ScopeRouting;
}

interface DriveOverrides {
  sources?: DriveSourceConfig[];
  file_filters?: Partial<DriveFileFilters>;
  content_handling?: Partial<DriveContentHandling>;
  scope_routing?: ScopeRouting;
}

export async function registerIntegrationPreviewRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  /**
   * POST /integrations/google-calendar/preview
   * Body: optional overrides for any of `calendars`, `filters`,
   * `capture_fields`, `scope_routing`. When omitted, falls back to the
   * persisted config (or defaults).
   */
  app.post<{ Body: CalendarOverrides | undefined }>(
    '/integrations/google-calendar/preview',
    { schema: { summary: 'Dry-run preview of Calendar observations for current config' } },
    async (request, reply) => {
      if (!await requireOwnerAuth(request, reply, env)) return;
      const stored = await readIntegrationConfig(env, 'google-calendar');
      const overrides = request.body ?? {};

      const calendars: CalendarSourceConfig[] = overrides.calendars
        ?? (stored.calendars as CalendarSourceConfig[] | undefined)
        ?? [{ id: 'primary', name: 'Primary', enabled: true, scope_override: null }];
      const enabled = calendars.filter(c => c.enabled);
      if (enabled.length === 0) {
        return { samples: [], message: 'No calendars selected' };
      }
      const filters: CalendarFilters = { ...DEFAULT_CALENDAR_FILTERS, ...(stored.filters as Partial<CalendarFilters> | undefined ?? {}), ...(overrides.filters ?? {}) };
      const capture: CalendarCaptureFields = { ...DEFAULT_CALENDAR_CAPTURE, ...(stored.capture_fields as Partial<CalendarCaptureFields> | undefined ?? {}), ...(overrides.capture_fields ?? {}) };
      const routing: ScopeRouting = { ...DEFAULT_SCOPE_ROUTING, ...(stored.scope_routing as ScopeRouting | undefined ?? {}), ...(overrides.scope_routing ?? {}) };

      const core = await getSmartwareCore(env);
      const profile = getPodProfile(core, env);
      const appSpace = ensureAppDataSpace(core, env, 'google-calendar');
      const profileScopes: ScopeProfile = profile.scopes;
      const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const samples: ObservationPreview[] = [];
      const counters = { fetched: 0, kept: 0, dropped: 0 };
      try {
        for (const cal of enabled) {
          if (samples.length >= PREVIEW_LIMIT_CALENDAR) break;
          const events = await listGoogleCalendarEvents(env, { calendarId: cal.id, timeMin, timeMax, maxResults: 50 });
          counters.fetched += events.length;
          const kept = applyCalendarFilters(events, filters);
          counters.kept += kept.length;
          counters.dropped += events.length - kept.length;
          for (const evt of kept) {
            if (samples.length >= PREVIEW_LIMIT_CALENDAR) break;
            const scope = resolveScope({
              routing,
              profile: profileScopes,
              source_override: cal.scope_override,
              fallback_scope: appSpace.scope,
            });
            samples.push(buildCalendarObservation(evt, capture, scope));
          }
        }
      } catch (error) {
        return reply.code(502).send({ error: 'google_api_error', message: (error as Error).message, samples, counters });
      }
      return { samples, counters };
    },
  );

  /**
   * POST /integrations/google-drive/preview
   * Drive preview iterates the configured sources (picker-selected
   * folders), lists recent files in each, filters, and renders the
   * deterministic summary for the first few that pass.
   */
  app.post<{ Body: DriveOverrides | undefined }>(
    '/integrations/google-drive/preview',
    { schema: { summary: 'Dry-run preview of Drive observations for current config' } },
    async (request, reply) => {
      if (!await requireOwnerAuth(request, reply, env)) return;
      const stored = await readIntegrationConfig(env, 'google-drive');
      const overrides = request.body ?? {};

      const sources: DriveSourceConfig[] = overrides.sources
        ?? (stored.sources as DriveSourceConfig[] | undefined)
        ?? [];
      if (sources.length === 0) {
        return { samples: [], message: 'Pick folders in the previous step first', counters: { fetched: 0, kept: 0, dropped: 0 } };
      }
      const fileFilters: DriveFileFilters = { ...DEFAULT_DRIVE_FILE_FILTERS, ...(stored.file_filters as Partial<DriveFileFilters> | undefined ?? {}), ...(overrides.file_filters ?? {}) };
      const handling: DriveContentHandling = { ...DEFAULT_DRIVE_CONTENT_HANDLING, ...(stored.content_handling as Partial<DriveContentHandling> | undefined ?? {}), ...(overrides.content_handling ?? {}) };
      const routing: ScopeRouting = { ...DEFAULT_SCOPE_ROUTING, ...(stored.scope_routing as ScopeRouting | undefined ?? {}), ...(overrides.scope_routing ?? {}) };

      const core = await getSmartwareCore(env);
      const profile = getPodProfile(core, env);
      const appSpace = ensureAppDataSpace(core, env, 'google-drive');
      const profileScopes: ScopeProfile = profile.scopes;

      const samples: ObservationPreview[] = [];
      const counters = { fetched: 0, kept: 0, dropped: 0 };
      try {
        for (const source of sources) {
          if (samples.length >= PREVIEW_LIMIT_DRIVE) break;
          const files = await listDriveFilesInFolder(env, { folderId: source.folder_id, pageSize: 20 });
          counters.fetched += files.length;
          const kept = applyDriveFilters(files, fileFilters);
          counters.kept += kept.length;
          counters.dropped += files.length - kept.length;
          for (const file of kept) {
            if (samples.length >= PREVIEW_LIMIT_DRIVE) break;
            const text = handling.ingestion_depth === 'metadata' ? undefined : await fetchDriveFileText(env, file);
            const scope = resolveScope({
              routing,
              profile: profileScopes,
              source_override: source.scope_override,
              fallback_scope: appSpace.scope,
            });
            samples.push(buildDriveObservation(file, text, handling, scope));
          }
        }
      } catch (error) {
        return reply.code(502).send({ error: 'google_api_error', message: (error as Error).message, samples, counters });
      }
      return { samples, counters };
    },
  );
}
