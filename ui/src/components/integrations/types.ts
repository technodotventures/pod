/** Shared types between the connection wizard and its preview cards. */

export interface ObservationPreview {
  source: 'google_calendar' | 'google_drive' | 'gitlab';
  scope: string;
  type: 'message' | 'file';
  source_id: string;
  content: Record<string, unknown>;
  identity_hooks: { emails: string[]; file_ids: string[] };
  metadata: Record<string, unknown>;
}

export interface PreviewResponse {
  samples: ObservationPreview[];
  counters?: { fetched: number; kept: number; dropped: number };
  message?: string;
  error?: string;
}

/* Calendar config */

export interface CalendarSource {
  id: string;
  name: string;
  primary?: boolean;
  color?: string;
  access_role?: string;
  enabled: boolean;
  scope_override: string | null;
}

export interface CalendarFilters {
  time_range: 'last_30d_future' | 'last_90d_future' | 'future_only' | 'all';
  event_types: Array<'meeting' | 'solo' | 'all_day' | 'recurring'>;
  min_attendees: number;
  exclude_declined: boolean;
  exclude_private: boolean;
  exclude_free: boolean;
  exclude_keywords: string[];
}

export interface CalendarCapture {
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

/* Drive config */

export interface DriveSource {
  folder_id: string;
  folder_path: string;
  scope_override: string | null;
}

export interface DriveFileFilters {
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

/* Shared cadence + routing */

export interface Cadence {
  mode: 'webhook' | 'poll_5m' | 'poll_hour' | 'manual';
  fallback_poll_seconds: number;
  /** Drive only — backfill window on first sync */
  backfill?: 'all' | 'last_30d' | 'last_90d' | 'none';
}

export interface ScopeRouting {
  mode: 'auto_detect' | 'all_self' | 'all_project' | 'per_source';
  project_scope?: string | null;
  rules: unknown[];
}

/* Defaults — mirror the backend defaults in connection-pipeline.ts */

export const DEFAULT_CALENDAR_FILTERS: CalendarFilters = {
  time_range: 'last_30d_future',
  event_types: ['meeting', 'recurring'],
  min_attendees: 2,
  exclude_declined: true,
  exclude_private: true,
  exclude_free: false,
  exclude_keywords: [],
};

export const DEFAULT_CALENDAR_CAPTURE: CalendarCapture = {
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

export const DEFAULT_CADENCE_CALENDAR: Cadence = {
  mode: 'poll_5m',
  fallback_poll_seconds: 300,
};

export const DEFAULT_CADENCE_DRIVE: Cadence = {
  mode: 'poll_hour',
  fallback_poll_seconds: 3600,
  backfill: 'last_30d',
};

export const DEFAULT_SCOPE_ROUTING: ScopeRouting = {
  mode: 'auto_detect',
  project_scope: null,
  rules: [],
};

/* GitHub config */

export interface GitHubFilters {
  repos: 'all' | 'selected';
  selected_repos: string[];
  event_types: Array<'push' | 'pull_request' | 'issues' | 'release' | 'review' | 'discussion'>;
  exclude_bots: boolean;
  exclude_draft_prs: boolean;
}

export const DEFAULT_GITHUB_FILTERS: GitHubFilters = {
  repos: 'all',
  selected_repos: [],
  event_types: ['push', 'pull_request', 'issues', 'release', 'review'],
  exclude_bots: true,
  exclude_draft_prs: false,
};

export const DEFAULT_CADENCE_GITHUB: Cadence = {
  mode: 'webhook',
  fallback_poll_seconds: 300,
};

/* Slack config */

export interface SlackFilters {
  channels: 'all_public' | 'selected';
  selected_channels: string[];
  capture: Array<'messages' | 'threads' | 'reactions' | 'files' | 'pins'>;
  exclude_bots: boolean;
  min_message_length: number;
  exclude_channels: string[];
}

export const DEFAULT_SLACK_FILTERS: SlackFilters = {
  channels: 'all_public',
  selected_channels: [],
  capture: ['messages', 'threads'],
  exclude_bots: true,
  min_message_length: 10,
  exclude_channels: [],
};

export const DEFAULT_CADENCE_SLACK: Cadence = {
  mode: 'webhook',
  fallback_poll_seconds: 300,
};

/* Gmail config */

export interface GmailFilters {
  labels: 'inbox' | 'all' | 'selected';
  selected_labels: string[];
  capture: Array<'subject' | 'body' | 'attachments' | 'metadata'>;
  exclude_promotions: boolean;
  exclude_social: boolean;
  max_age_days: number;
}

export const DEFAULT_GMAIL_FILTERS: GmailFilters = {
  labels: 'inbox',
  selected_labels: [],
  capture: ['subject', 'body', 'metadata'],
  exclude_promotions: true,
  exclude_social: true,
  max_age_days: 30,
};

export const DEFAULT_CADENCE_GMAIL: Cadence = {
  mode: 'poll_5m',
  fallback_poll_seconds: 300,
};

/* Gmail signal priority config */

export interface GmailSignalConfig {
  /** Auto uses the built-in classifier; custom lets the user add overrides. */
  mode: 'auto' | 'custom';
  /** Senders that should always be classified as high signal (e.g. boss, partner). */
  vip_senders: string[];
  /** Senders that should always be classified as low signal (e.g. newsletters). */
  mute_senders: string[];
  /** Subject keyword patterns to auto-low (case-insensitive, plain text). */
  mute_keywords: string[];
  /** Score thresholds for tier assignment. high >= high_threshold, low < low_threshold. */
  tier_thresholds: { high: number; low: number };
  /** Whether to skip core.observe() for low-tier items (saves LLM tokens). */
  skip_observe_low: boolean;
}

export const DEFAULT_GMAIL_SIGNAL_CONFIG: GmailSignalConfig = {
  mode: 'auto',
  vip_senders: [],
  mute_senders: [],
  mute_keywords: [],
  tier_thresholds: { high: 60, low: 30 },
  skip_observe_low: true,
};

/* GitLab config */

export interface GitLabFilters {
  projects: 'all' | 'selected';
  selected_projects: string[];
  event_types: Array<'push' | 'merge_request' | 'issue' | 'pipeline' | 'release' | 'note'>;
  exclude_bots: boolean;
  exclude_draft_mrs: boolean;
  include_ci_jobs: boolean;
}

export const DEFAULT_GITLAB_FILTERS: GitLabFilters = {
  projects: 'all',
  selected_projects: [],
  event_types: ['push', 'merge_request', 'issue', 'pipeline', 'release'],
  exclude_bots: true,
  exclude_draft_mrs: false,
  include_ci_jobs: false,
};

export const DEFAULT_CADENCE_GITLAB: Cadence = {
  mode: 'webhook',
  fallback_poll_seconds: 300,
};

/* Notion config */

export interface NotionFilters {
  workspaces: 'all' | 'selected';
  selected_pages: string[];
  content_types: Array<'page' | 'database' | 'block'>;
  ingestion_depth: 'full' | 'summaries' | 'titles_only';
  include_comments: boolean;
}

export const DEFAULT_NOTION_FILTERS: NotionFilters = {
  workspaces: 'all',
  selected_pages: [],
  content_types: ['page', 'database'],
  ingestion_depth: 'summaries',
  include_comments: false,
};

export const DEFAULT_CADENCE_NOTION: Cadence = {
  mode: 'poll_hour',
  fallback_poll_seconds: 3600,
  backfill: 'last_30d',
};

/* Linear config */

export interface LinearFilters {
  teams: 'all' | 'selected';
  selected_teams: string[];
  issue_states: Array<'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled'>;
  include_comments: boolean;
  include_attachments: boolean;
  projects: 'all' | 'active_only';
}

export const DEFAULT_LINEAR_FILTERS: LinearFilters = {
  teams: 'all',
  selected_teams: [],
  issue_states: ['todo', 'in_progress', 'done'],
  include_comments: true,
  include_attachments: false,
  projects: 'active_only',
};

export const DEFAULT_CADENCE_LINEAR: Cadence = {
  mode: 'webhook',
  fallback_poll_seconds: 600,
};
