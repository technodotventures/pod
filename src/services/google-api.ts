/**
 * Thin Google API helpers shared by sync, preview, and source-discovery
 * routes. Centralizes OAuth refresh and the typed fetch wrapper that the
 * previous in-route helpers (sync.ts, google-drive.ts) duplicated.
 */

import type { CoffeePodEnv } from '../config/env.js';
import { readIntegrationConfig, writeIntegrationConfig } from '@technodotventures/smartware-connectors';
import type { CalendarRawEvent, DriveRawFile } from './connection-pipeline.js';

interface TokenConfig {
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  [key: string]: unknown;
}

/** Ensure a valid access token, refreshing if needed. */
export async function ensureAccessToken(env: CoffeePodEnv, serviceId: string): Promise<string> {
  const config = (await readIntegrationConfig(env, serviceId)) as TokenConfig;
  if (!config.client_id) config.client_id = process.env.GOOGLE_CLIENT_ID;
  if (!config.client_secret) config.client_secret = process.env.GOOGLE_CLIENT_SECRET;

  if (config.access_token && config.expires_at && config.expires_at > Date.now() + 60_000) {
    return config.access_token;
  }
  if (!config.refresh_token) throw new Error(`${serviceId} is not connected (no refresh token)`);
  if (!config.client_id || !config.client_secret) throw new Error(`${serviceId} OAuth credentials missing`);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: config.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error_description === 'string'
      ? data.error_description
      : `Token refresh failed for ${serviceId}: ${res.status}`);
  }
  config.access_token = String(data.access_token);
  config.expires_at = Date.now() + ((typeof data.expires_in === 'number' ? data.expires_in : 3600) * 1000);
  await writeIntegrationConfig(env, serviceId, config as Record<string, unknown>);
  return config.access_token;
}

export async function googleFetch<T>(env: CoffeePodEnv, serviceId: string, url: string): Promise<T> {
  const token = await ensureAccessToken(env, serviceId);
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const parsed = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(parsed.error?.message ?? `Google API ${serviceId} failed: ${res.status}`);
  return parsed;
}

/* ── Calendar helpers ── */

export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
  backgroundColor?: string;
}

export async function listGoogleCalendars(env: CoffeePodEnv): Promise<GoogleCalendarListEntry[]> {
  const result = await googleFetch<{ items: GoogleCalendarListEntry[] }>(
    env,
    'google-calendar',
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&fields=items(id,summary,primary,selected,accessRole,backgroundColor)',
  );
  return result.items ?? [];
}

export interface ListCalendarEventsOptions {
  calendarId: string;
  timeMin?: string;
  timeMax?: string;
  updatedMin?: string;
  maxResults?: number;
}

export async function listGoogleCalendarEvents(
  env: CoffeePodEnv,
  options: ListCalendarEventsOptions,
): Promise<CalendarRawEvent[]> {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(options.maxResults ?? 50),
  });
  if (options.timeMin) params.set('timeMin', options.timeMin);
  if (options.timeMax) params.set('timeMax', options.timeMax);
  if (options.updatedMin) params.set('updatedMin', options.updatedMin);

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(options.calendarId)}/events?${params}`;
  const result = await googleFetch<{ items: CalendarRawEvent[] }>(env, 'google-calendar', url);
  // Stamp calendarId onto each event so downstream scope routing can use it.
  return (result.items ?? []).map(e => ({ ...e, calendarId: options.calendarId }));
}

/* ── Drive helpers ── */

const DRIVE_FILE_FIELDS = 'id,name,mimeType,modifiedTime,webViewLink,size,owners(emailAddress,displayName),permissions(emailAddress,type,role),parents,labelInfo';

export interface ListDriveFilesOptions {
  /** When provided, restrict listing to files whose parents include this folder. */
  folderId?: string;
  /** Free-form additional Drive query expression to AND with parents+trashed. */
  extraQuery?: string;
  pageSize?: number;
}

export async function listDriveFilesInFolder(
  env: CoffeePodEnv,
  options: ListDriveFilesOptions,
): Promise<DriveRawFile[]> {
  const qParts = ['trashed = false'];
  if (options.folderId) qParts.push(`'${options.folderId.replace(/'/g, "\\'")}' in parents`);
  if (options.extraQuery) qParts.push(options.extraQuery);

  const params = new URLSearchParams({
    pageSize: String(options.pageSize ?? 20),
    fields: `files(${DRIVE_FILE_FIELDS})`,
    orderBy: 'modifiedTime desc',
    q: qParts.join(' and '),
  });
  const result = await googleFetch<{ files: DriveRawFile[] }>(
    env,
    'google-drive',
    `https://www.googleapis.com/drive/v3/files?${params}`,
  );
  return result.files ?? [];
}

export async function getDriveFile(env: CoffeePodEnv, fileId: string): Promise<DriveRawFile> {
  const params = new URLSearchParams({ fields: DRIVE_FILE_FIELDS });
  return googleFetch<DriveRawFile>(
    env,
    'google-drive',
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params}`,
  );
}

/** Fetch plain text content for Docs/Slides/text files. Returns undefined
 *  when the file mime type has no clean text extraction path. */
export async function fetchDriveFileText(env: CoffeePodEnv, file: DriveRawFile): Promise<string | undefined> {
  const token = await ensureAccessToken(env, 'google-drive');
  let url: string | null = null;
  if (file.mimeType === 'application/vnd.google-apps.document' || file.mimeType === 'application/vnd.google-apps.presentation') {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=text/plain`;
  } else if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;
  }
  if (!url) return undefined;
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) return undefined;
  return response.text();
}

/* ── Gmail helpers ── */

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    mimeType: string;
    body?: { data?: string; size?: number };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string; size?: number };
      parts?: GmailMessage['payload']['parts'];
    }>;
  };
}

export interface GmailThread {
  id: string;
  messages?: GmailMessage[];
}

export interface GmailListOptions {
  query?: string;
  maxResults?: number;
  labelIds?: string[];
  after?: string;
}

export async function listGmailMessages(
  env: CoffeePodEnv,
  options: GmailListOptions = {},
): Promise<GmailMessage[]> {
  const params = new URLSearchParams({
    maxResults: String(options.maxResults ?? 20),
  });
  const qParts: string[] = [];
  if (options.query) qParts.push(options.query);
  if (options.after) qParts.push(`after:${options.after}`);
  if (options.labelIds?.length) params.set('labelIds', options.labelIds.join(','));
  if (qParts.length > 0) params.set('q', qParts.join(' '));

  const list = await googleFetch<{ messages?: Array<{ id: string }> }>(
    env, 'gmail',
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
  );
  if (!list.messages?.length) return [];

  const messages: GmailMessage[] = [];
  for (const { id } of list.messages.slice(0, options.maxResults ?? 20)) {
    const msg = await googleFetch<GmailMessage>(
      env, 'gmail',
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    );
    messages.push(msg);
  }
  return messages;
}

export async function getGmailThread(env: CoffeePodEnv, threadId: string): Promise<GmailMessage[]> {
  const thread = await googleFetch<GmailThread>(
    env,
    'gmail',
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`,
  );
  return thread.messages ?? [];
}

export interface GmailExtracted {
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  body: string;
  messageId: string;
  inReplyTo: string;
  references: string[];
  /** Raw headers as a lowercase-key map — used by signal classifier. */
  rawHeaders: Record<string, string>;
}

export function extractGmailText(msg: GmailMessage): GmailExtracted {
  const header = (name: string) => msg.payload.headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
  const subject = header('Subject');
  const from = header('From');
  const to = header('To');
  const cc = header('Cc');
  const date = header('Date');
  const messageId = header('Message-ID');
  const inReplyTo = header('In-Reply-To');
  const references = header('References').match(/<[^>]+>/g) ?? [];

  // Build a lowercase-key map of all headers for signal classification.
  const rawHeaders: Record<string, string> = {};
  for (const h of msg.payload.headers) {
    rawHeaders[h.name.toLowerCase()] = h.value;
  }

  let body = '';
  const decodeBase64 = (data: string) => {
    try { return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'); }
    catch { return ''; }
  };

  const findBodyPart = (
    parts: GmailMessage['payload']['parts'] | undefined,
    mimeType: 'text/plain' | 'text/html',
  ): string | null => {
    for (const part of parts ?? []) {
      if (part.mimeType === mimeType && part.body?.data) return decodeBase64(part.body.data);
      const nested = findBodyPart(part.parts, mimeType);
      if (nested) return nested;
    }
    return null;
  };

  if (msg.payload.body?.data) {
    body = decodeBase64(msg.payload.body.data);
  } else if (msg.payload.parts) {
    body = findBodyPart(msg.payload.parts, 'text/plain')
      ?? (findBodyPart(msg.payload.parts, 'text/html')?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '');
  }

  return { subject, from, to, cc, date, body, messageId, inReplyTo, references, rawHeaders };
}
