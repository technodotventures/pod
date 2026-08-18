/**
 * `/pod/sync` — Pull recent changes from connected integrations (Google
 * Drive, Calendar) and create observe events + objects in the Pod.
 *
 * Pipeline is shared with the dry-run preview endpoint via
 * `services/connection-pipeline.ts`; this route just wires it up to
 * `core.observe()` and the Pod object store.
 */

import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { getDb, insertEventIfFresh, upsertCollection, upsertObject } from '../pod/db.js';
import { ensureAppDataSpace } from '../pod/data-spaces.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { readIntegrationConfig, writeIntegrationConfig } from '@technodotventures/smartware-connectors';
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
  type ScopeProfile,
} from '../services/connection-pipeline.js';
import {
  listGoogleCalendarEvents,
  listDriveFilesInFolder,
  fetchDriveFileText,
} from '../services/google-api.js';
import { createGmailEmailSource } from '../services/gmail-email-source.js';
import { createICloudEmailSource, type ICloudMailConfig } from '../services/icloud-email-source.js';
import { syncEmailSource, type EmailIngestionConfig } from '../services/email-ingestion.js';
import { listSlackChannels, listSlackMessages, listSlackThreadReplies } from '../services/slack-api.js';
import {
  compileConversationProjection,
  conversationMessageContent,
  slackTimestampToIso,
} from '../services/conversation-memory.js';
import { listGitHubNotifications } from '../services/github-api.js';
import { searchNotionPages, getNotionPageBlocks, extractNotionTitle, blocksToText } from '../services/notion-api.js';
import { listLinearIssues } from '../services/linear-api.js';
import {
  classifySignal,
  tierContent,
  type ClassifiableItem,
  type SignalTier,
} from '../services/signal-classifier.js';
import { resolveReflectionModelUse } from '../services/memory-settings.js';
import { syncArtifactMemory } from '../services/artifact-memory.js';

/* ── Config readers ── */

interface CalendarConfig {
  refresh_token?: string;
  access_token?: string;
  last_sync_at?: string;
  calendars?: CalendarSourceConfig[];
  filters?: Partial<CalendarFilters>;
  capture_fields?: Partial<CalendarCaptureFields>;
  scope_routing?: ScopeRouting;
  [key: string]: unknown;
}

interface DriveConfig {
  refresh_token?: string;
  access_token?: string;
  last_sync_at?: string;
  sources?: DriveSourceConfig[];
  file_filters?: Partial<DriveFileFilters>;
  content_handling?: Partial<DriveContentHandling>;
  scope_routing?: ScopeRouting;
  [key: string]: unknown;
}

function mergeCalendarConfig(raw: CalendarConfig) {
  return {
    calendars: raw.calendars ?? [{ id: 'primary', name: 'Primary calendar', enabled: true, scope_override: null }],
    filters: { ...DEFAULT_CALENDAR_FILTERS, ...(raw.filters ?? {}) },
    capture: { ...DEFAULT_CALENDAR_CAPTURE, ...(raw.capture_fields ?? {}) },
    routing: { ...DEFAULT_SCOPE_ROUTING, ...(raw.scope_routing ?? {}) },
  };
}

function mergeDriveConfig(raw: DriveConfig) {
  return {
    sources: raw.sources ?? [],
    fileFilters: { ...DEFAULT_DRIVE_FILE_FILTERS, ...(raw.file_filters ?? {}) },
    handling: { ...DEFAULT_DRIVE_CONTENT_HANDLING, ...(raw.content_handling ?? {}) },
    routing: { ...DEFAULT_SCOPE_ROUTING, ...(raw.scope_routing ?? {}) },
  };
}

/* ── Google Drive sync ── */

async function syncGoogleDrive(
  env: CoffeePodEnv,
  log: FastifyInstance['log'],
): Promise<{ count: number; files: string[] }> {
  const rawConfig = (await readIntegrationConfig(env, 'google-drive')) as DriveConfig;
  if (!rawConfig.refresh_token && !rawConfig.access_token) {
    return { count: 0, files: [] };
  }
  const { sources, fileFilters, handling, routing } = mergeDriveConfig(rawConfig);
  if (sources.length === 0) {
    // drive.file scope: no picker-selected folders means nothing to sync.
    return { count: 0, files: [] };
  }

  const lastSync = rawConfig.last_sync_at;
  const sinceQuery = lastSync ? `modifiedTime > '${lastSync}'` : undefined;

  const db = getDb(env);
  const core = await getSmartwareCore(env);
  const profile = getPodProfile(core, env);
  const appSpace = ensureAppDataSpace(core, env, 'google-drive');
  const profileScopes: ScopeProfile = profile.scopes;
  const actorId = 'sync:google-drive';
  core.ensureTrustedClientGrant(actorId, 'agent', [appSpace.scope]);

  upsertCollection(db, {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Files synced from Google Drive.',
    metadata: { app: 'google-drive' },
  });

  const synced: string[] = [];
  for (const source of sources) {
    let files;
    try {
      files = await listDriveFilesInFolder(env, {
        folderId: source.folder_id,
        extraQuery: sinceQuery,
        pageSize: 50,
      });
    } catch (err) {
      log.warn({ err, folder_id: source.folder_id }, 'google drive sync: list files failed');
      continue;
    }
    if (files.length === 0) continue;

    const allowed = applyDriveFilters(files, fileFilters);
    for (const file of allowed) {
      try {
        const text = handling.ingestion_depth === 'metadata' ? undefined : await fetchDriveFileText(env, file);

        // TODO(scope-migration): scope is bound to the source folder at
        // ingest. If the folder later belongs to a different scope, future
        // files will still land here without a backfill.
        const scope = resolveScope({
          routing,
          profile: profileScopes,
          source_override: source.scope_override,
          fallback_scope: appSpace.scope,
        });

        const observation = buildDriveObservation(file, text, handling, scope);

        const object = upsertObject(db, {
          id: observation.source_id,
          collection_id: 'google-drive',
          kind: 'google_drive.file',
          title: file.name,
          content: observation.content,
          source: { app: 'google-drive', external_id: file.id, url: file.webViewLink },
          metadata: { mime_type: file.mimeType, size: file.size, has_text: Boolean(text) },
        });

        await syncArtifactMemory({
          db,
          core,
          object,
          actor: { type: 'agent', id: actorId, display_name: 'Google Drive Sync' },
          type: observation.type,
          scope: observation.scope,
          content: { format: 'application/json', body: observation.content },
          visibility: 'scope',
          sensitive: false,
          app: 'google-drive',
          legacy_sources: [{ app: 'google-drive', source_id: observation.source_id }],
        });

        synced.push(file.name);
      } catch (err) {
        log.warn({ err, fileId: file.id }, 'google drive sync: observe failed');
      }
    }
  }

  if (synced.length > 0) {
    // Skip the event if an identical-content sync was logged in the last 24h
    // (sync runs every few minutes — re-emitting the same "Synced X files"
    // card every time pollutes the Activity feed).
    insertEventIfFresh(db, {
      type: 'google_drive_sync',
      process: 'observe',
      actor_id: actorId,
      scope: appSpace.id,
      title: `Synced ${synced.length} file${synced.length !== 1 ? 's' : ''} from Google Drive`,
      detail: synced.slice(0, 5).join(', ') + (synced.length > 5 ? ` +${synced.length - 5} more` : ''),
      content: { files: synced },
    });

    void core.compile({
      actor: { type: 'agent', id: actorId, display_name: 'Google Drive Sync' },
      scope: appSpace.scope,
      use_llm: resolveReflectionModelUse(db),
    }).catch((err) => log.warn({ err }, 'google drive sync: background compile failed'));
  }

  await writeIntegrationConfig(env, 'google-drive', {
    ...(await readIntegrationConfig(env, 'google-drive')),
    last_sync_at: new Date().toISOString(),
  });

  return { count: synced.length, files: synced };
}

/* ── Google Calendar sync ── */

async function syncGoogleCalendar(
  env: CoffeePodEnv,
  log: FastifyInstance['log'],
): Promise<{ count: number; events: string[] }> {
  const rawConfig = (await readIntegrationConfig(env, 'google-calendar')) as CalendarConfig;
  if (!rawConfig.refresh_token && !rawConfig.access_token) {
    return { count: 0, events: [] };
  }
  const { calendars, filters, capture, routing } = mergeCalendarConfig(rawConfig);
  const enabled = calendars.filter(c => c.enabled);
  if (enabled.length === 0) return { count: 0, events: [] };

  const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const lastSync = rawConfig.last_sync_at;

  const db = getDb(env);
  const core = await getSmartwareCore(env);
  const profile = getPodProfile(core, env);
  const appSpace = ensureAppDataSpace(core, env, 'google-calendar');
  const profileScopes: ScopeProfile = profile.scopes;
  const actorId = 'sync:google-calendar';
  core.ensureTrustedClientGrant(actorId, 'agent', [appSpace.scope]);

  upsertCollection(db, {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Events synced from Google Calendar.',
    metadata: { app: 'google-calendar' },
  });

  const synced: string[] = [];
  for (const cal of enabled) {
    let events;
    try {
      events = await listGoogleCalendarEvents(env, {
        calendarId: cal.id,
        timeMin,
        timeMax,
        updatedMin: lastSync,
        maxResults: 50,
      });
    } catch (err) {
      log.warn({ err, calendarId: cal.id }, 'google calendar sync: list events failed');
      continue;
    }
    if (events.length === 0) continue;

    const passed = applyCalendarFilters(events, filters);
    for (const evt of passed) {
      const title = evt.summary ?? 'Untitled event';

      // TODO(scope-migration): scope is bound per-calendar at ingest. If
      // a user leaves a workspace, future events still inherit the old
      // scope_override without a backfill.
      const scope = resolveScope({
        routing,
        profile: profileScopes,
        source_override: cal.scope_override,
        fallback_scope: appSpace.scope,
      });

      try {
        const observation = buildCalendarObservation(evt, capture, scope);

        const object = upsertObject(db, {
          id: observation.source_id,
          collection_id: 'google-calendar',
          kind: 'calendar_event',
          title,
          content: observation.content,
          source: { app: 'google-calendar', external_id: evt.id, url: evt.htmlLink },
          metadata: {
            start: evt.start?.dateTime ?? evt.start?.date ?? '',
            end: evt.end?.dateTime ?? evt.end?.date ?? '',
            location: evt.location,
            attendee_count: evt.attendees?.length ?? 0,
            calendar_id: cal.id,
          },
        });

        await syncArtifactMemory({
          db,
          core,
          object,
          actor: { type: 'agent', id: actorId, display_name: 'Google Calendar Sync' },
          type: observation.type,
          scope: observation.scope,
          content: { format: 'application/json', body: observation.content },
          visibility: 'scope',
          sensitive: false,
          app: 'google-calendar',
          legacy_sources: [{ app: 'google-calendar', source_id: observation.source_id }],
        });

        synced.push(title);
      } catch (err) {
        log.warn({ err, eventId: evt.id }, 'google calendar sync: observe failed');
      }
    }
  }

  if (synced.length > 0) {
    insertEventIfFresh(db, {
      type: 'google_calendar_sync',
      process: 'observe',
      actor_id: actorId,
      scope: appSpace.id,
      title: `Synced ${synced.length} event${synced.length !== 1 ? 's' : ''} from Google Calendar`,
      detail: synced.slice(0, 5).join(', ') + (synced.length > 5 ? ` +${synced.length - 5} more` : ''),
      content: { events: synced },
    });

    void core.compile({
      actor: { type: 'agent', id: actorId, display_name: 'Google Calendar Sync' },
      scope: appSpace.scope,
      use_llm: resolveReflectionModelUse(db),
    }).catch((err) => log.warn({ err }, 'google calendar sync: background compile failed'));
  }

  await writeIntegrationConfig(env, 'google-calendar', {
    ...(await readIntegrationConfig(env, 'google-calendar')),
    last_sync_at: new Date().toISOString(),
  });

  return { count: synced.length, events: synced };
}

/* ── Email sync ── */

async function syncGmail(
  env: CoffeePodEnv,
  log: FastifyInstance['log'],
): Promise<{ count: number; messages: string[]; classification: { high: number; medium: number; low: number } }> {
  const rawConfig = (await readIntegrationConfig(env, 'gmail')) as EmailIngestionConfig & {
    refresh_token?: string;
    access_token?: string;
    last_sync_at?: string;
  };
  if (!rawConfig.refresh_token && !rawConfig.access_token) {
    return { count: 0, messages: [], classification: { high: 0, medium: 0, low: 0 } };
  }
  const result = await syncEmailSource(env, log, createGmailEmailSource(env, rawConfig.filters), rawConfig);
  await writeIntegrationConfig(env, 'gmail', {
    ...(await readIntegrationConfig(env, 'gmail')),
    last_sync_at: new Date().toISOString(),
  });
  return result;
}

async function syncICloudMail(
  env: CoffeePodEnv,
  log: FastifyInstance['log'],
): Promise<{ count: number; messages: string[]; classification: { high: number; medium: number; low: number } }> {
  const rawConfig = (await readIntegrationConfig(env, 'icloud-mail')) as unknown as ICloudMailConfig & EmailIngestionConfig & {
    credential_stored?: boolean;
  };
  if (!rawConfig.account_email || rawConfig.credential_stored !== true) {
    return { count: 0, messages: [], classification: { high: 0, medium: 0, low: 0 } };
  }
  const result = await syncEmailSource(env, log, createICloudEmailSource(env, rawConfig), rawConfig);
  await writeIntegrationConfig(env, 'icloud-mail', {
    ...(await readIntegrationConfig(env, 'icloud-mail')),
    last_sync_at: new Date().toISOString(),
  });
  return result;
}

/* ── Slack sync ── */

async function syncSlack(
  env: CoffeePodEnv,
  log: FastifyInstance['log'],
): Promise<{ count: number; messages: string[]; classification: { high: number; medium: number; low: number } }> {
  const rawConfig = (await readIntegrationConfig(env, 'slack')) as { bot_token?: string; access_token?: string; last_sync_at?: string };
  if (!rawConfig.bot_token && !rawConfig.access_token) return { count: 0, messages: [], classification: { high: 0, medium: 0, low: 0 } };

  const db = getDb(env);
  const core = await getSmartwareCore(env);
  const appSpace = ensureAppDataSpace(core, env, 'slack');
  const actorId = 'sync:slack';
  core.ensureTrustedClientGrant(actorId, 'agent', [appSpace.scope]);

  upsertCollection(db, { id: 'slack', name: 'Slack', description: 'Messages synced from Slack.', metadata: { app: 'slack' } });

  const lastSync = rawConfig.last_sync_at;
  const oldest = lastSync ? String(new Date(lastSync).getTime() / 1000) : undefined;

  let channels;
  try { channels = await listSlackChannels(env); }
  catch (err) { log.warn({ err }, 'slack sync: list channels failed'); return { count: 0, messages: [], classification: { high: 0, medium: 0, low: 0 } }; }

  const synced: string[] = [];
  const tierCounts: Record<SignalTier, number> = { high: 0, medium: 0, low: 0 };

  for (const channel of channels.filter(c => c.is_member).slice(0, 10)) {
    let messages;
    try { messages = await listSlackMessages(env, channel.id, { oldest, limit: 10 }); }
    catch { continue; }

    const messageByTimestamp = new Map(messages.map(message => [message.ts, message]));
    for (const root of messages.filter(message => (message.reply_count ?? 0) > 0).slice(0, 5)) {
      try {
        const replies = await listSlackThreadReplies(env, channel.id, root.ts);
        for (const reply of replies) messageByTimestamp.set(reply.ts, reply);
      } catch (err) {
        log.warn({ err, channel: channel.id, thread: root.ts }, 'slack sync: thread replies failed');
      }
    }
    messages = [...messageByTimestamp.values()];

    for (const msg of messages) {
      if (!msg.text || msg.text.length < 10) continue;

      // ── Classify signal tier ──
      const classifiable: ClassifiableItem = {
        sender: msg.user ?? '',
        subject: `#${channel.name}`,
        body: msg.text,
        labels: channel.is_private ? ['dm'] : [],
        directlyAddressed: false, // TODO: detect @mentions once we have user's Slack ID
        source: 'slack',
        headers: msg.bot_id ? { bot_id: msg.bot_id } : {},
      };
      const classification = classifySignal(classifiable);
      tierCounts[classification.tier]++;

      const sourceId = `slack:${channel.id}:${msg.ts}`;
      const title = `#${channel.name}: ${msg.text.slice(0, 60)}`;
      const tieredText = tierContent(classification.tier, msg.text);
      const content = classification.tier === 'low'
        ? `[#${channel.name}] [low-signal message]`
        : `[#${channel.name}] ${tieredText}`;

      try {
        const object = upsertObject(db, {
          id: sourceId,
          collection_id: 'slack',
          kind: 'page',
          title,
          content: { text: content, channel: channel.name },
          source: { app: 'slack', external_id: msg.ts },
          origin: 'imported',
          tags: ['slack', channel.name],
          metadata: {
            signal_tier: classification.tier,
            signal_score: classification.score,
            signal_rules: classification.rules,
            conversation_id: `${channel.id}:${msg.thread_ts ?? msg.ts}`,
            thread_id: msg.thread_ts ?? null,
          },
        });
        if (classification.tier !== 'low') {
          const occurredAt = slackTimestampToIso(msg.ts);
          await syncArtifactMemory({
            db,
            core,
            object,
            actor: { type: 'agent', id: actorId, display_name: 'Slack Sync' },
            type: 'message',
            scope: appSpace.scope,
            content: {
              format: 'application/json',
              body: conversationMessageContent({
                source: 'slack',
                conversation_id: `${channel.id}:${msg.thread_ts ?? msg.ts}`,
                message_id: msg.ts,
                text: content,
                actor_id: msg.user ?? 'unknown:slack',
                channel_id: channel.id,
                channel_name: channel.name,
                ...(occurredAt ? { occurred_at: occurredAt } : {}),
                reactions_count: msg.reactions?.reduce((sum, reaction) => sum + reaction.count, 0) ?? 0,
              }),
            },
            visibility: 'scope',
            sensitive: false,
            app: 'slack',
            observed_at: occurredAt,
            legacy_sources: [{ app: 'slack', source_id: sourceId }],
          });
        }
        synced.push(title);
      } catch (err) { log.warn({ err }, 'slack sync: observe failed'); }
    }
  }

  if (synced.length > 0) {
    const tierSummary = `(${tierCounts.high}↑ ${tierCounts.medium}→ ${tierCounts.low}↓)`;
    insertEventIfFresh(db, { type: 'slack_sync', process: 'observe', actor_id: actorId, scope: appSpace.id, title: `Synced ${synced.length} message${synced.length !== 1 ? 's' : ''} from Slack ${tierSummary}`, detail: synced.slice(0, 5).join(', '), content: { messages: synced, classification: tierCounts } });
    if (tierCounts.high > 0) {
      void core.compile({ actor: { type: 'agent', id: actorId, display_name: 'Slack Sync' }, scope: appSpace.scope, use_llm: resolveReflectionModelUse(db) }).catch(err => log.warn({ err }, 'slack sync: compile failed'));
    }
    await compileConversationProjection(env, appSpace.scope).catch(err => log.warn({ err }, 'slack sync: conversation projection failed'));
  }

  await writeIntegrationConfig(env, 'slack', { ...rawConfig, last_sync_at: new Date().toISOString() });
  return { count: synced.length, messages: synced, classification: tierCounts };
}

/* ── GitHub sync ── */

async function syncGitHub(
  env: CoffeePodEnv,
  log: FastifyInstance['log'],
): Promise<{ count: number; items: string[]; classification: { high: number; medium: number; low: number } }> {
  const rawConfig = (await readIntegrationConfig(env, 'github')) as { access_token?: string; last_sync_at?: string };
  if (!rawConfig.access_token) return { count: 0, items: [], classification: { high: 0, medium: 0, low: 0 } };

  const db = getDb(env);
  const core = await getSmartwareCore(env);
  const appSpace = ensureAppDataSpace(core, env, 'github');
  const actorId = 'sync:github';
  core.ensureTrustedClientGrant(actorId, 'agent', [appSpace.scope]);

  upsertCollection(db, { id: 'github', name: 'GitHub', description: 'Activity synced from GitHub.', metadata: { app: 'github' } });

  let notifications;
  try { notifications = await listGitHubNotifications(env, rawConfig.last_sync_at); }
  catch (err) { log.warn({ err }, 'github sync: list notifications failed'); return { count: 0, items: [], classification: { high: 0, medium: 0, low: 0 } }; }

  const synced: string[] = [];
  const tierCounts: Record<SignalTier, number> = { high: 0, medium: 0, low: 0 };

  for (const notif of notifications.slice(0, 30)) {
    // ── Classify signal tier ──
    const classifiable: ClassifiableItem = {
      sender: notif.repository.full_name,
      subject: notif.subject.title,
      body: `${notif.subject.type}: ${notif.subject.title}\nRepo: ${notif.repository.full_name}\nReason: ${notif.reason}`,
      source: 'github',
      headers: { reason: notif.reason },
    };
    const classification = classifySignal(classifiable);
    tierCounts[classification.tier]++;

    const sourceId = `github:${notif.id}`;
    const title = `[${notif.repository.full_name}] ${notif.subject.title}`;
    const content = `${notif.subject.type}: ${notif.subject.title}\nRepo: ${notif.repository.full_name}\nReason: ${notif.reason}`;

    try {
      const object = upsertObject(db, {
        id: sourceId,
        collection_id: 'github',
        kind: 'page',
        title,
        content: { text: content, repo: notif.repository.full_name, type: notif.subject.type },
        source: { app: 'github', external_id: notif.id },
        origin: 'imported',
        tags: ['github', notif.subject.type.toLowerCase()],
        metadata: {
          reason: notif.reason,
          signal_tier: classification.tier,
          signal_score: classification.score,
          signal_rules: classification.rules,
        },
      });
      if (classification.tier !== 'low') {
        await syncArtifactMemory({
          db,
          core,
          object,
          actor: { type: 'agent', id: actorId, display_name: 'GitHub Sync' },
          type: 'message',
          scope: appSpace.scope,
          content: { format: 'text/plain', body: content },
          visibility: 'scope',
          sensitive: false,
          app: 'github',
          legacy_sources: [{ app: 'github', source_id: sourceId }],
        });
      }
      synced.push(title);
    } catch (err) { log.warn({ err }, 'github sync: observe failed'); }
  }

  if (synced.length > 0) {
    const tierSummary = `(${tierCounts.high}↑ ${tierCounts.medium}→ ${tierCounts.low}↓)`;
    insertEventIfFresh(db, { type: 'github_sync', process: 'observe', actor_id: actorId, scope: appSpace.id, title: `Synced ${synced.length} notification${synced.length !== 1 ? 's' : ''} from GitHub ${tierSummary}`, detail: synced.slice(0, 5).join(', '), content: { items: synced, classification: tierCounts } });
    if (tierCounts.high > 0) {
      void core.compile({ actor: { type: 'agent', id: actorId, display_name: 'GitHub Sync' }, scope: appSpace.scope, use_llm: resolveReflectionModelUse(db) }).catch(err => log.warn({ err }, 'github sync: compile failed'));
    }
  }

  await writeIntegrationConfig(env, 'github', { ...rawConfig, last_sync_at: new Date().toISOString() });
  return { count: synced.length, items: synced, classification: tierCounts };
}

/* ── Notion sync ── */

async function syncNotion(
  env: CoffeePodEnv,
  log: FastifyInstance['log'],
): Promise<{ count: number; pages: string[] }> {
  const rawConfig = (await readIntegrationConfig(env, 'notion')) as { access_token?: string; last_sync_at?: string };
  if (!rawConfig.access_token) return { count: 0, pages: [] };

  const db = getDb(env);
  const core = await getSmartwareCore(env);
  const appSpace = ensureAppDataSpace(core, env, 'notion');
  const actorId = 'sync:notion';
  core.ensureTrustedClientGrant(actorId, 'agent', [appSpace.scope]);

  upsertCollection(db, { id: 'notion', name: 'Notion', description: 'Pages synced from Notion.', metadata: { app: 'notion' } });

  let pages;
  try { pages = await searchNotionPages(env); }
  catch (err) { log.warn({ err }, 'notion sync: search failed'); return { count: 0, pages: [] }; }

  const synced: string[] = [];
  for (const page of pages) {
    const title = extractNotionTitle(page);
    const sourceId = `notion:${page.id}`;

    let bodyText = '';
    try {
      const blocks = await getNotionPageBlocks(env, page.id);
      bodyText = blocksToText(blocks);
    } catch { bodyText = title; }

    if (!bodyText || bodyText.length < 10) continue;
    const content = `${title}\n\n${bodyText}`;

    try {
      const object = upsertObject(db, { id: sourceId, collection_id: 'notion', kind: 'page', title, content: { text: content }, source: { app: 'notion', external_id: page.id, url: page.url }, origin: 'imported', tags: ['notion'] });
      await syncArtifactMemory({
        db,
        core,
        object,
        actor: { type: 'agent', id: actorId, display_name: 'Notion Sync' },
        type: 'file',
        scope: appSpace.scope,
        content: { format: 'text/plain', body: content },
        visibility: 'scope',
        sensitive: false,
        app: 'notion',
        legacy_sources: [{ app: 'notion', source_id: sourceId }],
      });
      synced.push(title);
    } catch (err) { log.warn({ err }, 'notion sync: observe failed'); }
  }

  if (synced.length > 0) {
    insertEventIfFresh(db, { type: 'notion_sync', process: 'observe', actor_id: actorId, scope: appSpace.id, title: `Synced ${synced.length} page${synced.length !== 1 ? 's' : ''} from Notion`, detail: synced.slice(0, 5).join(', '), content: { pages: synced } });
    void core.compile({ actor: { type: 'agent', id: actorId, display_name: 'Notion Sync' }, scope: appSpace.scope, use_llm: resolveReflectionModelUse(db) }).catch(err => log.warn({ err }, 'notion sync: compile failed'));
  }

  await writeIntegrationConfig(env, 'notion', { ...rawConfig, last_sync_at: new Date().toISOString() });
  return { count: synced.length, pages: synced };
}

/* ── Linear sync ── */

async function syncLinear(
  env: CoffeePodEnv,
  log: FastifyInstance['log'],
): Promise<{ count: number; issues: string[] }> {
  const rawConfig = (await readIntegrationConfig(env, 'linear')) as { api_key?: string; access_token?: string; last_sync_at?: string };
  if (!rawConfig.api_key && !rawConfig.access_token) return { count: 0, issues: [] };

  const db = getDb(env);
  const core = await getSmartwareCore(env);
  const appSpace = ensureAppDataSpace(core, env, 'linear');
  const actorId = 'sync:linear';
  core.ensureTrustedClientGrant(actorId, 'agent', [appSpace.scope]);

  upsertCollection(db, { id: 'linear', name: 'Linear', description: 'Issues synced from Linear.', metadata: { app: 'linear' } });

  let issues;
  try { issues = await listLinearIssues(env, { updatedAfter: rawConfig.last_sync_at, limit: 30 }); }
  catch (err) { log.warn({ err }, 'linear sync: list issues failed'); return { count: 0, issues: [] }; }

  const synced: string[] = [];
  for (const issue of issues) {
    const sourceId = `linear:${issue.id}`;
    const title = `${issue.identifier}: ${issue.title}`;
    const content = `${title}\nStatus: ${issue.state.name}\nTeam: ${issue.team.name}${issue.assignee ? `\nAssignee: ${issue.assignee.name}` : ''}${issue.description ? `\n\n${issue.description}` : ''}`;

    try {
      const object = upsertObject(db, { id: sourceId, collection_id: 'linear', kind: 'page', title, content: { text: content, identifier: issue.identifier, status: issue.state.name, team: issue.team.name }, source: { app: 'linear', external_id: issue.id, url: issue.url }, origin: 'imported', tags: ['linear', issue.state.name.toLowerCase().replace(/\s+/g, '-')] });
      await syncArtifactMemory({
        db,
        core,
        object,
        actor: { type: 'agent', id: actorId, display_name: 'Linear Sync' },
        type: 'message',
        scope: appSpace.scope,
        content: { format: 'text/plain', body: content },
        visibility: 'scope',
        sensitive: false,
        app: 'linear',
        legacy_sources: [{ app: 'linear', source_id: sourceId }],
      });
      synced.push(title);
    } catch (err) { log.warn({ err }, 'linear sync: observe failed'); }
  }

  if (synced.length > 0) {
    insertEventIfFresh(db, { type: 'linear_sync', process: 'observe', actor_id: actorId, scope: appSpace.id, title: `Synced ${synced.length} issue${synced.length !== 1 ? 's' : ''} from Linear`, detail: synced.slice(0, 5).join(', '), content: { issues: synced } });
    void core.compile({ actor: { type: 'agent', id: actorId, display_name: 'Linear Sync' }, scope: appSpace.scope, use_llm: resolveReflectionModelUse(db) }).catch(err => log.warn({ err }, 'linear sync: compile failed'));
  }

  await writeIntegrationConfig(env, 'linear', { ...rawConfig, last_sync_at: new Date().toISOString() });
  return { count: synced.length, issues: synced };
}

/* ── Route registration ── */

export async function registerSyncRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  app.post(
    '/pod/sync',
    {
      schema: {
        tags: ['sync'],
        summary: 'Sync recent changes from connected integrations',
        body: {
          type: 'object',
          properties: {
            services: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request) => {
      const body = (request.body ?? {}) as { services?: string[] };
      const filter = body.services ? new Set(body.services) : null;
      const results: Record<string, { count: number; items: string[]; error?: string; classification?: { high: number; medium: number; low: number } }> = {};

      if (!filter || filter.has('google-drive')) {
        try {
          const r = await syncGoogleDrive(env, app.log);
          results['google-drive'] = { count: r.count, items: r.files };
        } catch (err) {
          results['google-drive'] = { count: 0, items: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
      }
      if (!filter || filter.has('google-calendar')) {
        try {
          const r = await syncGoogleCalendar(env, app.log);
          results['google-calendar'] = { count: r.count, items: r.events };
        } catch (err) {
          results['google-calendar'] = { count: 0, items: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
      }

      if (!filter || filter.has('gmail') || filter.has('email')) {
        try {
          const r = await syncGmail(env, app.log);
          results['gmail'] = { count: r.count, items: r.messages, classification: r.classification };
        } catch (err) {
          results['gmail'] = { count: 0, items: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
      }

      if (!filter || filter.has('icloud-mail') || filter.has('email')) {
        try {
          const r = await syncICloudMail(env, app.log);
          results['icloud-mail'] = { count: r.count, items: r.messages, classification: r.classification };
        } catch (err) {
          results['icloud-mail'] = { count: 0, items: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
      }

      if (!filter || filter.has('slack')) {
        try {
          const r = await syncSlack(env, app.log);
          results['slack'] = { count: r.count, items: r.messages, classification: r.classification };
        } catch (err) {
          results['slack'] = { count: 0, items: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
      }

      if (!filter || filter.has('github')) {
        try {
          const r = await syncGitHub(env, app.log);
          results['github'] = { count: r.count, items: r.items, classification: r.classification };
        } catch (err) {
          results['github'] = { count: 0, items: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
      }

      if (!filter || filter.has('notion')) {
        try {
          const r = await syncNotion(env, app.log);
          results['notion'] = { count: r.count, items: r.pages };
        } catch (err) {
          results['notion'] = { count: 0, items: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
      }

      if (!filter || filter.has('linear')) {
        try {
          const r = await syncLinear(env, app.log);
          results['linear'] = { count: r.count, items: r.issues };
        } catch (err) {
          results['linear'] = { count: 0, items: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
      }

      const totalCount = Object.values(results).reduce((s, r) => s + r.count, 0);
      return { synced: totalCount, results };
    },
  );

  app.get(
    '/pod/sync/status',
    { schema: { tags: ['sync'], summary: 'Check sync status for each connected integration' } },
    async () => {
      const services: Array<{ id: string; connected: boolean; last_sync_at: string | null }> = [];
      for (const serviceId of ['google-drive', 'google-calendar', 'gmail', 'icloud-mail', 'slack', 'github', 'notion', 'linear']) {
        const config = (await readIntegrationConfig(env, serviceId)) as {
          refresh_token?: string;
          access_token?: string;
          credential_stored?: boolean;
          last_sync_at?: string;
        };
        services.push({
          id: serviceId,
          connected: Boolean(config.refresh_token || config.access_token || config.credential_stored),
          last_sync_at: config.last_sync_at ?? null,
        });
      }
      return { services };
    },
  );
}
