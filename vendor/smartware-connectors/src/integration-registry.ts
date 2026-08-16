/**
 * Integration registry — metadata for all known service integrations.
 *
 * Each entry defines the auth flow (OAuth, API key, local, builtin),
 * the OAuth endpoints/scopes, configuration fields, and availability.
 * Apps can extend the registry at runtime via `registerIntegration()`.
 */

export type AuthType = 'oauth' | 'api_key' | 'local' | 'builtin';
export type IntegrationAvailability = 'ready' | 'config_only' | 'coming_soon';

export interface IntegrationField {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
}

export interface IntegrationOAuth {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Extra params for the authorize URL (e.g. `access_type: 'offline'`) */
  extraParams?: Record<string, string>;
  /** Use the OAuth PKCE extension for providers that require a code verifier. */
  pkce?: boolean;
  /** Encoding expected by the provider's token endpoint. Defaults to form. */
  tokenRequestFormat?: 'form' | 'json';
  /** How OAuth client credentials are sent to the token endpoint. Defaults to body. */
  tokenClientAuth?: 'body' | 'basic';
}

export interface IntegrationDef {
  id: string;
  name: string;
  authType: AuthType;
  availability: IntegrationAvailability;
  testingNote?: string;
  /** User-facing products grouped behind this integration family. */
  products?: string[];
  /** Fields required for api_key type */
  fields?: IntegrationField[];
  /** OAuth endpoints (for oauth type) */
  oauth?: IntegrationOAuth;
  /** Validation URL to test the connection */
  testUrl?: string | ((config: Record<string, string>) => string | undefined);
  /** HTTP method used by the validation request. Defaults to GET. */
  testMethod?: 'GET' | 'POST';
  /** Test endpoint headers builder */
  testHeaders?: (config: Record<string, string>) => Record<string, string>;
  /** Optional validation request body builder. */
  testBody?: (config: Record<string, string>) => string;
}

/* ── Default registry: OAuth + local + builtin integrations ── */

const INTEGRATIONS: IntegrationDef[] = [
  // ── Builtin ──
  {
    id: 'coffee', name: 'Coffee', authType: 'builtin', availability: 'ready',
    testingNote: 'Ready for Coffee pairing, meeting sync, brief generation, and capture.',
  },

  // ── Local ──
  {
    id: 'local-folders', name: 'Import documents', authType: 'local', availability: 'ready',
    testingNote: 'Ready for files, local folders, Obsidian vaults, and extracted Notion exports. Other archive importers are labelled individually in Pod.',
    products: ['Files', 'Obsidian', 'Notion', 'Evernote', 'Apple Notes', 'ChatGPT', 'Claude'],
  },

  // ── OAuth services ──
  {
    id: 'google-drive', name: 'Google Drive', authType: 'oauth',
    availability: 'ready',
    testingNote: 'Ready for picker-based folder selection and folder-scoped import.',
    oauth: {
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      extraParams: { access_type: 'offline', prompt: 'consent' },
    },
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Google OAuth Client ID' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Google OAuth Client Secret', secret: true },
      { key: 'picker_api_key', label: 'Picker API Key', placeholder: 'Google Cloud API Key (Picker)' },
      { key: 'picker_app_id', label: 'Picker App ID', placeholder: 'GCP project number' },
    ],
  },
  {
    id: 'google-calendar', name: 'Google Calendar', authType: 'oauth',
    availability: 'ready',
    testingNote: 'Connect to import events, meeting context, and scheduling data.',
    oauth: {
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      extraParams: { access_type: 'offline', prompt: 'consent' },
    },
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Google OAuth Client ID' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Google OAuth Client Secret', secret: true },
    ],
  },
  {
    id: 'gmail', name: 'Email', authType: 'oauth',
    availability: 'ready',
    testingNote: 'Google and iCloud accounts with thread-aware, signal-based memory.',
    oauth: {
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      extraParams: { access_type: 'offline', prompt: 'consent' },
    },
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Google OAuth Client ID' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Google OAuth Client Secret', secret: true },
    ],
  },
  {
    id: 'github', name: 'GitHub', authType: 'oauth',
    availability: 'ready',
    testingNote: 'Repos, issues, pull requests, and release notes. Connect to sync activity with signal-based priority filtering.',
    oauth: {
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scopes: ['repo', 'read:org'],
    },
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'GitHub OAuth App Client ID' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'GitHub OAuth App Client Secret', secret: true },
    ],
    testUrl: 'https://api.github.com/user',
    testHeaders: (c) => ({ Authorization: `Bearer ${c.access_token}`, Accept: 'application/vnd.github+json' }),
  },
  {
    id: 'slack', name: 'Slack', authType: 'oauth',
    availability: 'ready',
    testingNote: 'Team channels and message context. Connect to sync conversations with signal-based priority filtering.',
    oauth: {
      authorizeUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      scopes: ['channels:read', 'channels:history', 'users:read'],
    },
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Slack App Client ID' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Slack App Client Secret', secret: true },
    ],
  },
  {
    id: 'notion', name: 'Notion', authType: 'oauth',
    availability: 'ready',
    testingNote: 'Pages, databases, and workspace notes. Connect to import and sync Notion content.',
    oauth: {
      authorizeUrl: 'https://api.notion.com/v1/oauth/authorize',
      tokenUrl: 'https://api.notion.com/v1/oauth/token',
      scopes: [],
      tokenRequestFormat: 'json',
      tokenClientAuth: 'basic',
    },
    fields: [
      { key: 'client_id', label: 'Integration ID', placeholder: 'Notion Integration Client ID' },
      { key: 'client_secret', label: 'Integration Secret', placeholder: 'Notion Integration Secret', secret: true },
    ],
  },
  {
    id: 'linear', name: 'Linear', authType: 'oauth',
    availability: 'ready',
    testingNote: 'Issues, roadmaps, and engineering status. Connect to sync project tracking data.',
    oauth: {
      authorizeUrl: 'https://linear.app/oauth/authorize',
      tokenUrl: 'https://api.linear.app/oauth/token',
      scopes: ['read'],
    },
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Linear OAuth Client ID' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Linear OAuth Client Secret', secret: true },
    ],
  },
  {
    id: 'gitlab', name: 'GitLab', authType: 'oauth',
    availability: 'ready',
    testingNote: 'Projects, merge requests, issues, and pipelines. Connect to sync activity from GitLab.',
    oauth: {
      authorizeUrl: 'https://gitlab.com/oauth/authorize',
      tokenUrl: 'https://gitlab.com/oauth/token',
      scopes: ['read_api', 'read_user', 'read_repository'],
      extraParams: { grant_type: 'authorization_code' },
    },
    fields: [
      { key: 'client_id', label: 'Application ID', placeholder: 'GitLab OAuth Application ID' },
      { key: 'client_secret', label: 'Secret', placeholder: 'GitLab OAuth Application Secret', secret: true },
      { key: 'gitlab_url', label: 'GitLab URL (self-hosted)', placeholder: 'https://gitlab.com' },
    ],
    testUrl: 'https://gitlab.com/api/v4/user',
    testHeaders: (c) => ({ Authorization: `Bearer ${c.access_token}` }),
  },

  // ── Beta source families ──
  // These share the generic configure/connect/test/disconnect contract. Some
  // use OAuth while providers with first-party personal tokens use api_key.
  {
    id: 'microsoft-365', name: 'Microsoft 365', authType: 'oauth', availability: 'ready',
    testingNote: 'Beta connection through Microsoft Graph for mail, calendar, files, sites, and team conversations.',
    products: ['Outlook', 'OneDrive', 'SharePoint', 'Teams'],
    oauth: {
      authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scopes: ['offline_access', 'User.Read', 'Mail.Read', 'Calendars.Read', 'Files.Read.All', 'Sites.Read.All', 'ChannelMessage.Read.All'],
      extraParams: { prompt: 'select_account' },
    },
    fields: [
      { key: 'client_id', label: 'Application (client) ID', placeholder: 'Microsoft Entra application ID' },
      { key: 'client_secret', label: 'Client secret', placeholder: 'Microsoft Entra client secret', secret: true },
    ],
    testUrl: 'https://graph.microsoft.com/v1.0/me',
    testHeaders: (c) => ({ Authorization: `Bearer ${c.access_token}` }),
  },
  {
    id: 'dropbox', name: 'Dropbox', authType: 'oauth', availability: 'ready',
    testingNote: 'Beta connection for document and folder access.',
    oauth: {
      authorizeUrl: 'https://www.dropbox.com/oauth2/authorize',
      tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
      scopes: ['account_info.read', 'files.metadata.read', 'files.content.read', 'sharing.read'],
      extraParams: { token_access_type: 'offline' },
    },
    fields: [
      { key: 'client_id', label: 'App key', placeholder: 'Dropbox app key' },
      { key: 'client_secret', label: 'App secret', placeholder: 'Dropbox app secret', secret: true },
    ],
    testUrl: 'https://api.dropboxapi.com/2/users/get_current_account',
    testMethod: 'POST',
    testHeaders: (c) => ({ Authorization: `Bearer ${c.access_token}`, 'content-type': 'application/json' }),
    testBody: () => 'null',
  },
  {
    id: 'box', name: 'Box', authType: 'oauth', availability: 'ready',
    testingNote: 'Beta connection for enterprise files and content.',
    oauth: {
      authorizeUrl: 'https://account.box.com/api/oauth2/authorize',
      tokenUrl: 'https://api.box.com/oauth2/token',
      scopes: [],
    },
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Box OAuth client ID' },
      { key: 'client_secret', label: 'Client secret', placeholder: 'Box OAuth client secret', secret: true },
    ],
    testUrl: 'https://api.box.com/2.0/users/me',
    testHeaders: (c) => ({ Authorization: `Bearer ${c.access_token}` }),
  },
  {
    id: 'asana', name: 'Asana', authType: 'api_key', availability: 'ready',
    testingNote: 'Beta personal-token connection for projects, tasks, comments, and status.',
    fields: [
      { key: 'api_key', label: 'Personal access token', placeholder: 'Asana personal access token', secret: true },
    ],
    testUrl: 'https://app.asana.com/api/1.0/users/me',
    testHeaders: (c) => ({ Authorization: `Bearer ${c.api_key}` }),
  },
  {
    id: 'clickup', name: 'ClickUp', authType: 'api_key', availability: 'ready',
    testingNote: 'Beta personal-token connection for tasks, docs, projects, and comments.',
    fields: [
      { key: 'api_key', label: 'Personal API token', placeholder: 'ClickUp personal API token', secret: true },
    ],
    testUrl: 'https://api.clickup.com/api/v2/user',
    testHeaders: (c) => ({ Authorization: c.api_key }),
  },
  {
    id: 'monday', name: 'monday.com', authType: 'api_key', availability: 'ready',
    testingNote: 'Beta API-token connection for boards, items, updates, and workdocs.',
    fields: [
      { key: 'api_key', label: 'API token', placeholder: 'monday.com API token', secret: true },
    ],
    testUrl: 'https://api.monday.com/v2',
    testMethod: 'POST',
    testHeaders: (c) => ({ Authorization: c.api_key, 'content-type': 'application/json' }),
    testBody: () => JSON.stringify({ query: 'query { me { id name } }' }),
  },
  {
    id: 'perplexity', name: 'Perplexity', authType: 'api_key', availability: 'ready',
    testingNote: 'Beta API connection for research workflows and generated answers.',
    fields: [
      { key: 'api_key', label: 'API key', placeholder: 'pplx-...', secret: true },
    ],
    testUrl: 'https://api.perplexity.ai/models',
    testHeaders: (c) => ({ Authorization: `Bearer ${c.api_key}` }),
  },
  {
    id: 'canva', name: 'Canva', authType: 'oauth', availability: 'ready',
    testingNote: 'Beta OAuth connection for designs, documents, and presentations.',
    oauth: {
      authorizeUrl: 'https://www.canva.com/api/oauth/authorize',
      tokenUrl: 'https://api.canva.com/rest/v1/oauth/token',
      scopes: ['profile:read', 'design:meta:read', 'design:content:read', 'folder:read', 'asset:read', 'comment:read'],
      pkce: true,
      tokenClientAuth: 'basic',
    },
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Canva integration client ID' },
      { key: 'client_secret', label: 'Client secret', placeholder: 'Canva integration client secret', secret: true },
    ],
    testUrl: 'https://api.canva.com/rest/v1/users/me/profile',
    testHeaders: (c) => ({ Authorization: `Bearer ${c.access_token}` }),
  },
  {
    id: 'airtable', name: 'Airtable', authType: 'api_key', availability: 'ready',
    testingNote: 'Beta personal-token connection for bases, tables, records, and comments.',
    fields: [
      { key: 'api_key', label: 'Personal access token', placeholder: 'pat...', secret: true },
    ],
    testUrl: 'https://api.airtable.com/v0/meta/whoami',
    testHeaders: (c) => ({ Authorization: `Bearer ${c.api_key}` }),
  },
  {
    id: 'miro', name: 'Miro', authType: 'oauth', availability: 'ready',
    testingNote: 'Beta OAuth connection for boards, cards, notes, and diagrams.',
    oauth: {
      authorizeUrl: 'https://miro.com/oauth/authorize',
      tokenUrl: 'https://api.miro.com/v1/oauth/token',
      scopes: ['boards:read', 'team:read'],
    },
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Miro app client ID' },
      { key: 'client_secret', label: 'Client secret', placeholder: 'Miro app client secret', secret: true },
    ],
    testUrl: 'https://api.miro.com/v2/boards?limit=1',
    testHeaders: (c) => ({ Authorization: `Bearer ${c.access_token}` }),
  },
  {
    id: 'atlassian', name: 'Atlassian', authType: 'oauth', availability: 'ready',
    testingNote: 'Beta shared Atlassian OAuth connection for work and knowledge context.',
    products: ['Jira', 'Confluence', 'Trello'],
    oauth: {
      authorizeUrl: 'https://auth.atlassian.com/authorize',
      tokenUrl: 'https://auth.atlassian.com/oauth/token',
      scopes: ['read:me', 'read:jira-work', 'read:confluence-content.all', 'read:confluence-space.summary', 'offline_access'],
      extraParams: { audience: 'api.atlassian.com', prompt: 'consent' },
      tokenRequestFormat: 'json',
    },
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'Atlassian OAuth client ID' },
      { key: 'client_secret', label: 'Client secret', placeholder: 'Atlassian OAuth client secret', secret: true },
    ],
    testUrl: 'https://api.atlassian.com/oauth/token/accessible-resources',
    testHeaders: (c) => ({ Authorization: `Bearer ${c.access_token}` }),
  },
  {
    id: 'hubspot', name: 'HubSpot', authType: 'api_key', availability: 'ready',
    testingNote: 'Beta private-app connection for contacts, companies, deals, and activity.',
    fields: [
      { key: 'api_key', label: 'Private app access token', placeholder: 'pat-...', secret: true },
    ],
    testUrl: 'https://api.hubapi.com/crm/v3/objects/contacts?limit=1&archived=false',
    testHeaders: (c) => ({ Authorization: `Bearer ${c.api_key}` }),
  },
  {
    id: 'salesforce', name: 'Salesforce', authType: 'oauth', availability: 'ready',
    testingNote: 'Beta OAuth connection for accounts, contacts, opportunities, and activity.',
    oauth: {
      authorizeUrl: 'https://login.salesforce.com/services/oauth2/authorize',
      tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
      scopes: ['api', 'refresh_token'],
    },
    fields: [
      { key: 'client_id', label: 'Consumer key', placeholder: 'Salesforce connected app consumer key' },
      { key: 'client_secret', label: 'Consumer secret', placeholder: 'Salesforce connected app consumer secret', secret: true },
    ],
    testUrl: (c) => c.instance_url ? `${c.instance_url.replace(/\/$/, '')}/services/oauth2/userinfo` : undefined,
    testHeaders: (c) => ({ Authorization: `Bearer ${c.access_token}` }),
  },
  {
    id: 'attio', name: 'Attio', authType: 'api_key', availability: 'ready',
    testingNote: 'Beta access-token connection for people, companies, lists, and notes.',
    fields: [
      { key: 'api_key', label: 'Access token', placeholder: 'Attio access token', secret: true },
    ],
    testUrl: 'https://api.attio.com/v2/self',
    testHeaders: (c) => ({ Authorization: `Bearer ${c.api_key}` }),
  },
  {
    id: 'clay', name: 'Clay', authType: 'api_key', availability: 'ready',
    testingNote: 'Beta API-key connection for enrichment and prospecting workflows.',
    fields: [
      { key: 'api_key', label: 'API key', placeholder: 'Clay API key', secret: true },
    ],
  },
];

/* ── Public API ── */

/** Get the full list of registered integrations. */
export function listIntegrations(): IntegrationDef[] {
  return [...INTEGRATIONS];
}

/** Look up an integration by id. */
export function getIntegration(id: string): IntegrationDef | undefined {
  return INTEGRATIONS.find(i => i.id === id);
}

/**
 * Register a custom integration at runtime. Apps can call this to add
 * their own providers (e.g. AI services, custom OAuth apps) beyond the
 * default set. If an integration with the same id already exists, it is
 * replaced.
 */
export function registerIntegration(def: IntegrationDef): void {
  const idx = INTEGRATIONS.findIndex(i => i.id === def.id);
  if (idx >= 0) INTEGRATIONS[idx] = def;
  else INTEGRATIONS.push(def);
}

/**
 * Compute public-facing connection status for an integration given its
 * stored config. Does NOT expose secrets — just status, timing, scope info.
 */
export function integrationPublicStatus(
  def: IntegrationDef,
  config: Record<string, unknown>,
): Record<string, unknown> {
  if (def.authType === 'builtin') return { status: 'active' };
  if (def.authType === 'local') return { status: 'active' };

  if (def.authType === 'oauth') {
    const connected = Boolean(config.refresh_token || config.access_token);
    const configured = Boolean(config.client_id && config.client_secret);
    const expectedScope = def.oauth?.scopes.join(' ');
    const grantedScope = typeof config.granted_scope === 'string' ? config.granted_scope : undefined;
    const scope_mismatch = connected && expectedScope && grantedScope ? grantedScope !== expectedScope : false;
    return {
      status: connected ? 'active' : configured ? 'configured' : 'disconnected',
      connected_at: config.connected_at,
      expected_scope: expectedScope,
      granted_scope: grantedScope,
      scope_mismatch: scope_mismatch || undefined,
    };
  }

  if (def.authType === 'api_key') {
    const hasKey = def.fields?.some(f => f.secret && config[f.key]);
    const hasAnyField = def.fields?.some(f => config[f.key]);
    return {
      status: hasKey || hasAnyField ? 'active' : 'disconnected',
    };
  }

  return { status: 'disconnected' };
}
