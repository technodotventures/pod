/**
 * Pure filter + capture + scope-routing pipeline shared by:
 *  - POST /integrations/:service/preview (dry-run, no Layer 0 writes)
 *  - /pod/sync (real ingestion)
 *
 * No I/O here — pass in fetched events/files and config, get back
 * Smartware observation-shaped objects (or null when filtered out).
 */

import {
  normalizeEmail,
  normalizeEmailList,
  normalizeFileId,
  extractAttachedDriveFileIds,
} from './identity-hooks.js';

/* ── Calendar shapes ── */

export interface CalendarFilters {
  time_range: 'last_30d_future' | 'last_90d_future' | 'future_only' | 'all';
  event_types: Array<'meeting' | 'solo' | 'all_day' | 'recurring'>;
  min_attendees: number;
  exclude_declined: boolean;
  exclude_private: boolean;
  exclude_free: boolean;
  exclude_keywords: string[];
}

export interface CalendarCaptureFields {
  title: boolean;
  time: boolean;
  attendees: boolean;
  description: boolean;
  meeting_link: boolean;
  attached_files: boolean;
  location: boolean;
  recurrence: boolean;
  organizer: boolean;
  response_status: boolean;
  conference_data: boolean;
}

export interface CalendarSourceConfig {
  id: string;
  name: string;
  enabled: boolean;
  scope_override: string | null;
}

export type ScopeRoutingMode = 'auto_detect' | 'all_self' | 'all_project' | 'per_source';

export interface ScopeRouting {
  mode: ScopeRoutingMode;
  /** project scope id used when mode === 'all_project' */
  project_scope?: string | null;
  /** ignored for now — per-source overrides are stored on the source itself */
  rules: unknown[];
}

export interface CalendarRawEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  organizer?: { email?: string; displayName?: string };
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string; self?: boolean; resource?: boolean }>;
  htmlLink?: string;
  status?: string;
  updated?: string;
  transparency?: 'opaque' | 'transparent';
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  recurrence?: string[];
  recurringEventId?: string;
  hangoutLink?: string;
  conferenceData?: unknown;
  attachments?: Array<{ fileId?: string; fileUrl?: string; title?: string; mimeType?: string }>;
  calendarId?: string;
}

/* ── Drive shapes ── */

export interface DriveFileFilters {
  /** Accepted short types: doc, sheet, slide, pdf, text, markdown */
  types: string[];
  include_binaries: boolean;
  max_size_mb: number;
  skip_confidential: boolean;
  exclude_patterns: string[];
}

export interface DriveContentHandling {
  ingestion_depth: 'full' | 'summaries' | 'metadata';
  chunk_size: 'paragraph' | 'section' | 'page' | 'whole_doc';
  include_comments: boolean;
  include_revisions: boolean;
  include_suggestions: boolean;
  reingest_on_edit: boolean;
}

export interface DriveSourceConfig {
  folder_id: string;
  folder_path: string;
  scope_override: string | null;
}

export interface DriveRawFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
  owners?: Array<{ emailAddress?: string; displayName?: string }>;
  permissions?: Array<{ emailAddress?: string; type?: string; role?: string }>;
  labelInfo?: { labels?: Array<{ id?: string; fields?: Record<string, unknown> }> };
  parents?: string[];
}

/* ── Observation shape (matches smartware core.observe input.content.body) ── */

export interface ObservationPreview {
  source: 'google_calendar' | 'google_drive';
  scope: string;
  type: 'message' | 'file';
  source_id: string;
  content: Record<string, unknown>;
  /** stable identity hooks exposed at the top level for cross-source linkage */
  identity_hooks: {
    emails: string[];
    file_ids: string[];
  };
  metadata: Record<string, unknown>;
}

/* ── Scope profiles passed in from caller ── */

export interface ScopeProfile {
  personal: string;
  workspace: string;
}

/* ════════════════════════════════════════════════════════════
   Calendar pipeline
   ════════════════════════════════════════════════════════════ */

export function applyCalendarFilters(
  events: CalendarRawEvent[],
  filters: CalendarFilters,
): CalendarRawEvent[] {
  const cutoff = computeTimeCutoff(filters.time_range);
  const keywordsLower = filters.exclude_keywords
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length > 0);

  return events.filter(evt => {
    if (evt.status === 'cancelled') return false;

    // Time range
    const startIso = evt.start?.dateTime ?? evt.start?.date;
    if (cutoff && startIso) {
      const startMs = Date.parse(startIso);
      if (Number.isFinite(startMs) && startMs < cutoff) return false;
    }

    // Event type classification
    const isAllDay = Boolean(evt.start?.date && !evt.start?.dateTime);
    const realAttendees = (evt.attendees ?? []).filter(a => !a.resource);
    const hasAttendees = realAttendees.length >= 2;
    const isMeeting = hasAttendees;
    const isRecurring = Boolean(evt.recurrence?.length || evt.recurringEventId);
    const isSolo = !hasAttendees && !isAllDay;

    const accepted = (
      (isMeeting && filters.event_types.includes('meeting'))
      || (isSolo && filters.event_types.includes('solo'))
      || (isAllDay && filters.event_types.includes('all_day'))
      || (isRecurring && filters.event_types.includes('recurring'))
    );
    if (!accepted) return false;

    // Minimum attendees
    if (realAttendees.length < Math.max(1, filters.min_attendees)) {
      // Solo time blocks bypass min_attendees when 'solo' is explicitly checked
      if (!(isSolo && filters.event_types.includes('solo'))) return false;
    }

    // Decline filter
    if (filters.exclude_declined) {
      const self = realAttendees.find(a => a.self);
      if (self?.responseStatus === 'declined') return false;
    }

    // Private events
    if (filters.exclude_private && evt.visibility === 'private') return false;

    // Free / transparent events
    if (filters.exclude_free && evt.transparency === 'transparent') return false;

    // Keyword exclusion (title)
    if (keywordsLower.length > 0) {
      const title = (evt.summary ?? '').toLowerCase();
      if (keywordsLower.some(k => title.includes(k))) return false;
    }

    return true;
  });
}

export function buildCalendarObservation(
  event: CalendarRawEvent,
  capture: CalendarCaptureFields,
  scope: string,
): ObservationPreview {
  const startTime = event.start?.dateTime ?? event.start?.date ?? '';
  const endTime = event.end?.dateTime ?? event.end?.date ?? '';
  const attendeeEmails = normalizeEmailList(event.attendees);
  const fileIds = capture.attached_files ? extractAttachedDriveFileIds(event) : [];

  const content: Record<string, unknown> = {
    type: 'calendar_event',
    event_id: event.id,
  };

  // Title + time are always captured (per brief).
  content.title = event.summary ?? 'Untitled event';
  content.start = startTime;
  content.end = endTime;

  if (capture.attendees) {
    content.attendees = (event.attendees ?? []).map(a => ({
      email: normalizeEmail(a.email),
      display_name: a.displayName,
      response: a.responseStatus,
    }));
  }
  if (capture.description && event.description) content.description = event.description;
  if (capture.meeting_link && event.hangoutLink) content.meeting_link = event.hangoutLink;
  if (capture.attached_files && event.attachments) {
    content.attached_files = event.attachments.map(a => ({
      file_id: normalizeFileId(a.fileId),
      title: a.title,
      mime_type: a.mimeType,
      url: a.fileUrl,
    }));
  }
  if (capture.location && event.location) content.location = event.location;
  if (capture.recurrence && event.recurrence) content.recurrence = event.recurrence;
  if (capture.organizer && event.organizer) {
    content.organizer = {
      email: normalizeEmail(event.organizer.email),
      display_name: event.organizer.displayName,
    };
  }
  if (capture.response_status) {
    const self = (event.attendees ?? []).find(a => a.self);
    if (self) content.response_status = self.responseStatus;
  }
  if (capture.conference_data && event.conferenceData) content.conference_data = event.conferenceData;

  return {
    source: 'google_calendar',
    scope,
    type: 'message',
    source_id: `google-calendar:${event.id}`,
    content,
    identity_hooks: {
      emails: attendeeEmails,
      file_ids: fileIds,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      occurred_at: startTime,
      actor: 'google_calendar_integration',
      calendar_id: event.calendarId,
      tags: ['calendar', ...(event.recurrence ? ['recurring'] : []), ...(attendeeEmails.length >= 2 ? ['meeting'] : [])],
    },
  };
}

/* ════════════════════════════════════════════════════════════
   Drive pipeline
   ════════════════════════════════════════════════════════════ */

const MIME_TO_SHORT_TYPE: Record<string, string> = {
  'application/vnd.google-apps.document': 'doc',
  'application/vnd.google-apps.spreadsheet': 'sheet',
  'application/vnd.google-apps.presentation': 'slide',
  'application/pdf': 'pdf',
  'text/plain': 'text',
  'text/markdown': 'markdown',
  'text/x-markdown': 'markdown',
};

const TEXT_MIME_PREFIX = 'text/';
const BINARY_MIME_PREFIXES = ['image/', 'video/', 'audio/', 'application/zip', 'application/x-tar', 'application/x-gzip'];

export function shortTypeForMime(mime: string): string {
  return MIME_TO_SHORT_TYPE[mime] ?? (mime.startsWith(TEXT_MIME_PREFIX) ? 'text' : 'other');
}

function isBinaryMime(mime: string): boolean {
  return BINARY_MIME_PREFIXES.some(p => mime.startsWith(p));
}

function patternToRegex(pattern: string): RegExp {
  // Convert glob-ish pattern to regex. Only `*` is supported as wildcard.
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

export function applyDriveFilters(
  files: DriveRawFile[],
  filters: DriveFileFilters,
): DriveRawFile[] {
  const typeSet = new Set(filters.types);
  const patterns = filters.exclude_patterns
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(patternToRegex);
  const maxBytes = filters.max_size_mb > 0 ? filters.max_size_mb * 1024 * 1024 : Number.POSITIVE_INFINITY;

  return files.filter(file => {
    const short = shortTypeForMime(file.mimeType);

    if (!filters.include_binaries && isBinaryMime(file.mimeType)) return false;

    // 'other' is allowed only when binaries are allowed AND short type isn't required
    if (short !== 'other' && !typeSet.has(short)) return false;
    if (short === 'other' && !filters.include_binaries) return false;

    const sizeBytes = file.size ? Number(file.size) : 0;
    if (Number.isFinite(sizeBytes) && sizeBytes > maxBytes) return false;

    if (filters.skip_confidential && hasConfidentialLabel(file)) return false;

    if (patterns.some(re => re.test(file.name))) return false;

    return true;
  });
}

function hasConfidentialLabel(file: DriveRawFile): boolean {
  // Google's labelInfo response shape is flexible; we look for any label
  // that mentions 'confidential' in its id (best-effort — full label
  // resolution requires a separate Drive Labels API call).
  const labels = file.labelInfo?.labels;
  if (!labels) return false;
  return labels.some(l => typeof l.id === 'string' && l.id.toLowerCase().includes('confidential'));
}

/** Deterministic summary: title + owner + modified + sharing + first ~500
 *  chars of extracted text. No LLM. REFLECT upgrades this asynchronously. */
function deterministicSummary(file: DriveRawFile, extractedText: string | undefined): string {
  const owner = file.owners?.[0]?.displayName ?? file.owners?.[0]?.emailAddress ?? 'unknown';
  const modified = file.modifiedTime ?? 'unknown';
  const sharedWith = (file.permissions ?? [])
    .map(p => p.emailAddress)
    .filter((e): e is string => Boolean(e))
    .slice(0, 5);
  const snippet = extractedText ? extractedText.slice(0, 500).replace(/\s+/g, ' ').trim() : '';
  const sharing = sharedWith.length > 0 ? `Shared with: ${sharedWith.join(', ')}. ` : '';
  return `${file.name} — owned by ${owner}, modified ${modified}. ${sharing}${snippet}`.trim();
}

export function buildDriveObservation(
  file: DriveRawFile,
  extractedText: string | undefined,
  handling: DriveContentHandling,
  scope: string,
): ObservationPreview {
  const ownerEmails = normalizeEmailList(file.owners?.map(o => ({ email: o.emailAddress })));
  const sharedEmails = normalizeEmailList(file.permissions?.map(p => ({ email: p.emailAddress })));
  const allEmails = Array.from(new Set([...ownerEmails, ...sharedEmails]));
  const fileId = normalizeFileId(file.id) ?? file.id;

  const content: Record<string, unknown> = {
    type: handling.ingestion_depth === 'metadata' ? 'document_metadata' : 'document',
    file_id: fileId,
    file_name: file.name,
    file_url: file.webViewLink,
    mime_type: file.mimeType,
    owner: ownerEmails[0] ?? null,
    last_modified: file.modifiedTime,
    shared_with: sharedEmails,
  };

  if (handling.ingestion_depth === 'full' && extractedText) {
    content.text = extractedText;
  } else if (handling.ingestion_depth === 'summaries') {
    content.summary = deterministicSummary(file, extractedText);
  }
  // metadata-only: nothing else added

  return {
    source: 'google_drive',
    scope,
    type: 'file',
    source_id: `google-drive:${fileId}`,
    content,
    identity_hooks: {
      emails: allEmails,
      file_ids: [fileId],
    },
    metadata: {
      timestamp: new Date().toISOString(),
      occurred_at: file.modifiedTime,
      actor: 'google_drive_integration',
      mime_type: file.mimeType,
      short_type: shortTypeForMime(file.mimeType),
      size_bytes: file.size,
      tags: ['document', shortTypeForMime(file.mimeType)],
    },
  };
}

/* ════════════════════════════════════════════════════════════
   Scope routing
   ════════════════════════════════════════════════════════════ */

export interface ResolveScopeInput {
  routing: ScopeRouting;
  profile: ScopeProfile;
  /** For calendar events: the source calendar id. For Drive files: the
   *  ancestor folder id whose source config was selected. */
  source_override: string | null;
  /** Default app-owned scope supplied by the integration adapter. */
  fallback_scope: string;
}

/**
 * Resolve the scope for a single observation.
 *
 * TODO(scope-migration): Scope is resolved per-observation at ingest time.
 * If a user later leaves a workspace, future events from the same source
 * will continue to land in the old scope. There is no mechanism today to
 * rebind a source to a new scope or to migrate already-ingested
 * observations. Tracked as a known limitation in the integration brief.
 */
export function resolveScope(input: ResolveScopeInput): string {
  if (input.source_override) return input.source_override;

  switch (input.routing.mode) {
    case 'all_self':
      return input.profile.personal;
    case 'all_project':
      return input.routing.project_scope ?? input.fallback_scope;
    case 'per_source':
      // per-source overrides should already be applied via source_override;
      // fall back to the default kind-specific scope
      return input.fallback_scope;
    case 'auto_detect':
    default:
      return input.fallback_scope;
  }
}

/* ════════════════════════════════════════════════════════════
   Defaults — used when wizard config is absent or partial
   ════════════════════════════════════════════════════════════ */

export const DEFAULT_CALENDAR_FILTERS: CalendarFilters = {
  time_range: 'last_30d_future',
  event_types: ['meeting', 'recurring'],
  min_attendees: 2,
  exclude_declined: true,
  exclude_private: true,
  exclude_free: false,
  exclude_keywords: [],
};

export const DEFAULT_CALENDAR_CAPTURE: CalendarCaptureFields = {
  title: true,
  time: true,
  attendees: true,
  description: true,
  meeting_link: true,
  attached_files: true,
  location: true,
  recurrence: true,
  organizer: true,
  response_status: true,
  conference_data: false,
};

export const DEFAULT_DRIVE_FILE_FILTERS: DriveFileFilters = {
  types: ['doc', 'sheet', 'slide'],
  include_binaries: false,
  max_size_mb: 10,
  skip_confidential: true,
  exclude_patterns: [],
};

export const DEFAULT_DRIVE_CONTENT_HANDLING: DriveContentHandling = {
  ingestion_depth: 'summaries',
  chunk_size: 'section',
  include_comments: true,
  include_revisions: false,
  include_suggestions: false,
  reingest_on_edit: true,
};

export const DEFAULT_SCOPE_ROUTING: ScopeRouting = {
  mode: 'auto_detect',
  project_scope: null,
  rules: [],
};

/* ── Helpers ── */

function computeTimeCutoff(range: CalendarFilters['time_range']): number | null {
  const now = Date.now();
  switch (range) {
    case 'last_30d_future':
      return now - 30 * 24 * 60 * 60 * 1000;
    case 'last_90d_future':
      return now - 90 * 24 * 60 * 60 * 1000;
    case 'future_only':
      return now;
    case 'all':
    default:
      return null;
  }
}
