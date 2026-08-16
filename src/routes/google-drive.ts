/**
 * Google Drive integration routes.
 *
 * Pod is local-first / single-tenant, so we use `drive.readonly` and ship
 * a native in-app folder browser instead of the Google Picker. Trade-offs:
 *   - PRO: no Picker API key / GCP project number setup for the user
 *   - PRO: the app can list folders directly, so the wizard UX is simpler
 *   - CON: broader consent (read-all-Drive) vs. file-by-file picker grant
 * This trade-off matches the trust model: the user's own OAuth client,
 * their own machine, their own data.
 *
 * Routes here pre-empt the generic /integrations/:service/* endpoints in
 * integrations.ts because they also persist `granted_scope`, expose
 * Drive-specific status fields, and own the folder-listing endpoint.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { requireActorAuth, requireOwnerAuth } from '../security/auth.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { getDb, upsertCollection, upsertObject, createImport, updateImport, insertEvent } from '../pod/db.js';
import { ensureAppDataSpace } from '../pod/data-spaces.js';
import {
  applyDriveFilters,
  buildDriveObservation,
  resolveScope,
  DEFAULT_DRIVE_FILE_FILTERS,
  DEFAULT_DRIVE_CONTENT_HANDLING,
  DEFAULT_SCOPE_ROUTING,
  type DriveContentHandling,
  type DriveFileFilters,
  type DriveSourceConfig,
  type ScopeRouting,
  type ScopeProfile,
} from '../services/connection-pipeline.js';
import {
  listDriveFilesInFolder,
  fetchDriveFileText,
  getDriveFile,
} from '../services/google-api.js';
import { resolveReflectionModelUse } from '../services/memory-settings.js';
import { syncArtifactMemory } from '../services/artifact-memory.js';

// drive.readonly: required for the native folder browser to list folders
// without a per-user Picker API key. Users re-consent on next /auth-url visit
// if their existing token was issued under the older drive.file scope.
const driveScopes = ['https://www.googleapis.com/auth/drive.readonly'];

const MAX_DRIVE_IMPORT_BATCH = 50;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function callbackErrorPage(message: string): string {
  return `<!doctype html><html><head><title>Google Drive connection failed</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b0e;color:#fff;font:600 16px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{width:min(420px,calc(100vw - 40px));padding:28px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:#131318;box-shadow:0 16px 44px rgba(0,0,0,.42)}h1{margin:0 0 8px;font-size:22px}p{margin:0;color:rgba(255,255,255,.72)}</style>
</head><body><main><h1>Google Drive connection failed</h1><p>${escapeHtml(message)}</p></main></body></html>`;
}

interface GoogleDriveConfig {
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  state?: string;
  state_actor_id?: string;
  connected_at?: string;
  granted_scope?: string;
  picker_api_key?: string;
  picker_app_id?: string;
  sources?: DriveSourceConfig[];
  file_filters?: Partial<DriveFileFilters>;
  content_handling?: Partial<DriveContentHandling>;
  scope_routing?: ScopeRouting;
}

function configPath(env: CoffeePodEnv): string {
  return path.join(env.dataDir, 'integrations', 'google-drive.json');
}

async function readConfig(env: CoffeePodEnv): Promise<GoogleDriveConfig> {
  try {
    return JSON.parse(await fs.readFile(configPath(env), 'utf8')) as GoogleDriveConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

async function writeConfig(env: CoffeePodEnv, config: GoogleDriveConfig): Promise<void> {
  const file = configPath(env);
  const directory = path.dirname(file);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
  await fs.writeFile(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(file, 0o600);
}

function redirectUri(env: CoffeePodEnv): string {
  return `http://127.0.0.1:${env.port}/integrations/google-drive/callback`;
}

function publicConfig(config: GoogleDriveConfig, includeOwnerFields: boolean) {
  const expectedScope = driveScopes.join(' ');
  const grantedScope = config.granted_scope;
  // drive.readonly tokens predate this branch; warn so the wizard can
  // prompt for a reconnect (drive.file requires fresh consent).
  const scope_mismatch = Boolean(config.refresh_token && grantedScope && grantedScope !== expectedScope);
  const base = {
    configured: Boolean(config.client_id && config.client_secret),
    connected: Boolean(config.refresh_token),
    connected_at: config.connected_at,
    scopes: driveScopes,
    expected_scope: expectedScope,
    granted_scope: grantedScope,
    scope_mismatch: scope_mismatch || undefined,
    picker_ready: Boolean(config.picker_api_key && config.picker_app_id && config.client_id),
  };
  return includeOwnerFields
    ? { ...base, client_id: config.client_id, picker_api_key: config.picker_api_key, picker_app_id: config.picker_app_id }
    : base;
}

async function exchangeToken(env: CoffeePodEnv, params: Record<string, string>): Promise<Record<string, unknown>> {
  const config = await readConfig(env);
  if (!config.client_id) config.client_id = process.env.GOOGLE_CLIENT_ID;
  if (!config.client_secret) config.client_secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!config.client_id || !config.client_secret) {
    throw new Error('Google Drive is not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      redirect_uri: redirectUri(env),
      ...params,
    }),
  });
  const parsed = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof parsed.error_description === 'string' ? parsed.error_description : `Google token exchange failed: ${response.status}`);
  }
  return parsed;
}

export async function registerGoogleDriveRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);

  app.get('/integrations/google-drive/status', async (request) => {
    const isOwner = !env.apiToken || request.coffeePodAuth?.kind === 'owner';
    return { google_drive: publicConfig(await readConfig(env), isOwner) };
  });

  app.post('/integrations/google-drive/configure', {
    schema: {
      summary: 'Configure Google Drive OAuth + Picker credentials locally',
      body: {
        type: 'object',
        properties: {
          client_id: { type: 'string' },
          client_secret: { type: 'string' },
          picker_api_key: { type: 'string' },
          picker_app_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const body = request.body as {
      client_id?: string;
      client_secret?: string;
      picker_api_key?: string;
      picker_app_id?: string;
    };
    const previous = await readConfig(env);
    const config: GoogleDriveConfig = {
      ...previous,
      ...(body.client_id !== undefined ? { client_id: body.client_id.trim() } : {}),
      ...(body.client_secret !== undefined ? { client_secret: body.client_secret.trim() } : {}),
      ...(body.picker_api_key !== undefined ? { picker_api_key: body.picker_api_key.trim() } : {}),
      ...(body.picker_app_id !== undefined ? { picker_app_id: body.picker_app_id.trim() } : {}),
    };
    await writeConfig(env, config);
    return { google_drive: publicConfig(config, true) };
  });

  app.get('/integrations/google-drive/auth-url', async (request, reply) => {
    const query = request.query as { actor_id?: string };
    const actorId = query.actor_id ?? 'person-local';

    const config = await readConfig(env);
    if (!config.client_id) config.client_id = process.env.GOOGLE_CLIENT_ID;
    if (!config.client_secret) config.client_secret = process.env.GOOGLE_CLIENT_SECRET;
    if (!config.client_id || !config.client_secret) {
      return reply.code(400).send({ error: 'not_configured', message: 'Google Drive OAuth credentials are missing' });
    }
    const state = crypto.randomBytes(18).toString('base64url');
    await writeConfig(env, { ...config, state, state_actor_id: actorId });
    const params = new URLSearchParams({
      client_id: config.client_id,
      redirect_uri: redirectUri(env),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: driveScopes.join(' '),
      state,
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  });

  app.get('/integrations/google-drive/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    if (query.error) {
      return reply.code(400).type('text/html').send(callbackErrorPage(query.error));
    }
    const config = await readConfig(env);
    if (!query.code) {
      return reply.code(400).type('text/html').send(callbackErrorPage('Missing authorization code.'));
    }
    if (!config.state || !query.state || query.state !== config.state) {
      app.log.warn({ expected_state: config.state, received_state: query.state }, 'google drive oauth state mismatch — rejecting callback');
      await writeConfig(env, { ...config, state: undefined, state_actor_id: undefined });
      return reply.code(400).type('text/html').send(callbackErrorPage('OAuth state did not match. Start the Google Drive connection from Pod again.'));
    }
    const token = await exchangeToken(env, {
      grant_type: 'authorization_code',
      code: query.code,
    });
    const expiresIn = typeof token.expires_in === 'number' ? token.expires_in : 3600;
    await writeConfig(env, {
      ...config,
      refresh_token: String(token.refresh_token ?? config.refresh_token),
      access_token: String(token.access_token),
      expires_at: Date.now() + expiresIn * 1000,
      granted_scope: typeof token.scope === 'string' ? token.scope : driveScopes.join(' '),
      connected_at: new Date().toISOString(),
      state: undefined,
      state_actor_id: undefined,
    });
    return reply.type('text/html').send(`
      <!doctype html>
      <html>
        <head>
          <title>Google Drive connected</title>
          <style>
            body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b0b0e; color: #fff; font: 600 16px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
            main { width: min(420px, calc(100vw - 40px)); padding: 28px; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; background: #131318; box-shadow: 0 16px 44px rgba(0,0,0,.42); }
            h1 { margin: 0 0 8px; font-size: 24px; }
            p { margin: 0; color: rgba(255,255,255,.72); }
          </style>
        </head>
        <body>
          <main>
            <h1>Google Drive is connected</h1>
            <p>You can return to Pod and finish setting up your folders.</p>
          </main>
        </body>
      </html>
    `);
  });

  /**
   * POST /integrations/google-drive/import
   * Imports files from picker-selected source folders, honoring the
   * persisted file_filters / content_handling / scope_routing config.
   *
   * Body:
   *   actor_id?: person id
   *   file_ids?: explicit list of files to ingest (overrides folder listing)
   *   limit?:    cap on files when listing folders (default 10, max 50)
   */
  app.post('/integrations/google-drive/import', async (request, reply) => {
    const body = request.body as { actor_id?: string; file_ids?: string[]; limit?: number };
    const actorId = body.actor_id ?? 'person-local';
    if (!await requireActorAuth(request, reply, env, actorId)) return;

    const config = await readConfig(env);
    const sources: DriveSourceConfig[] = config.sources ?? [];
    const fileFilters: DriveFileFilters = { ...DEFAULT_DRIVE_FILE_FILTERS, ...(config.file_filters ?? {}) };
    const handling: DriveContentHandling = { ...DEFAULT_DRIVE_CONTENT_HANDLING, ...(config.content_handling ?? {}) };
    const routing: ScopeRouting = { ...DEFAULT_SCOPE_ROUTING, ...(config.scope_routing ?? {}) };

    const fallbackLimit = Math.max(1, Math.min(MAX_DRIVE_IMPORT_BATCH, body.limit ?? 10));

    // Explicit ids bypass folder listing — used by the wizard's "import
    // selected sample" flow. Under drive.file these ids must be ones the
    // user has previously granted (picker or ancestor folder).
    // Explicit selection also bypasses type/size/pattern filters: the
    // user is individually picking these files, and dropping them on
    // type would be surprising ("I selected this PDF, why is it gone?").
    const explicit = body.file_ids?.slice(0, MAX_DRIVE_IMPORT_BATCH) ?? [];
    let files;
    let passed;
    if (explicit.length > 0) {
      files = await Promise.all(explicit.map(id => getDriveFile(env, id)));
      passed = files;
    } else {
      if (sources.length === 0) {
        return reply.code(400).send({ error: 'no_sources', message: 'Pick folders in the Drive wizard first.' });
      }
      const batches = await Promise.all(sources.map(s => listDriveFilesInFolder(env, { folderId: s.folder_id, pageSize: fallbackLimit })));
      files = batches.flat().slice(0, fallbackLimit);
      passed = applyDriveFilters(files, fileFilters);
    }

    upsertCollection(db, {
      id: 'google-drive',
      name: 'Google Drive',
      description: 'Files imported from Google Drive.',
      metadata: { app: 'google-drive' },
    });

    const imp = createImport(db, { source: 'google-drive', file_count: passed.length, destination: 'google-drive' });
    updateImport(db, imp.id, { status: 'importing' });

    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const appSpace = ensureAppDataSpace(core, env, 'google-drive');
    const profileScopes: ScopeProfile = profile.scopes;
    const connectorActorId = 'google-drive:connector';
    core.ensureTrustedClientGrant(connectorActorId, 'agent', [appSpace.scope]);

    // Map each file back to its source folder so per-source scope
    // overrides apply. Match via parents; fall back to no override.
    const folderById = new Map(sources.map(s => [s.folder_id, s]));

    const imported: Array<{ object: unknown; observation: unknown }> = [];
    for (const file of passed) {
      const text = handling.ingestion_depth === 'metadata' ? undefined : await fetchDriveFileText(env, file);
      const sourceMatch = (file.parents ?? []).map(p => folderById.get(p)).find(Boolean);
      const scope = resolveScope({
        routing,
        profile: profileScopes,
        source_override: sourceMatch?.scope_override ?? null,
        fallback_scope: appSpace.scope,
      });

      const obs = buildDriveObservation(file, text, handling, scope);
      const object = upsertObject(db, {
        id: obs.source_id,
        collection_id: 'google-drive',
        kind: 'google_drive.file',
        title: file.name,
        content: obs.content,
        source: { app: 'google-drive', external_id: file.id, url: file.webViewLink },
        metadata: { mime_type: file.mimeType, size: file.size, has_text: Boolean(text) },
      });
      const observation = await syncArtifactMemory({
        db,
        core,
        object,
        actor: { type: 'agent', id: connectorActorId, display_name: 'Google Drive' },
        type: obs.type,
        scope: obs.scope,
        content: { format: 'application/json', body: obs.content },
        visibility: 'scope',
        sensitive: false,
        app: 'google-drive',
        legacy_sources: [{ app: 'google-drive', source_id: obs.source_id }],
      });
      imported.push({ object, observation });
    }

    void core.compile({
      actor: { type: 'agent', id: connectorActorId, display_name: 'Google Drive' },
      scope: appSpace.scope,
      use_llm: resolveReflectionModelUse(db),
    }).catch(error => {
      app.log.warn({ error }, 'google drive background extraction failed');
    });

    updateImport(db, imp.id, { status: 'completed', completed_at: new Date().toISOString() });
    insertEvent(db, {
      type: 'google_drive_import',
      process: 'import',
      actor_id: connectorActorId,
      scope: appSpace.id,
      title: `Imported ${imported.length} files from Google Drive`,
      content: { import_id: imp.id, count: imported.length },
    });

    return { import_id: imp.id, imported, count: imported.length };
  });

  /**
   * GET /integrations/google-drive/folders[?parent=<id>&pageSize=<n>]
   *
   * Native folder browser endpoint. Lists subfolders of `parent` (defaults
   * to the user's "My Drive" root) so the UI can drill down without using
   * the Google Picker. Requires drive.readonly scope.
   */
  app.get('/integrations/google-drive/folders', async (request, reply) => {
    if (!await requireActorAuth(request, reply, env, 'person-local')) return;
    const q = request.query as { parent?: string; pageSize?: string };
    const parent = q.parent?.trim() || 'root';
    const pageSize = Math.max(1, Math.min(200, Number(q.pageSize ?? 100)));
    try {
      const items = await listDriveFilesInFolder(env, {
        folderId: parent,
        extraQuery: "mimeType = 'application/vnd.google-apps.folder'",
        pageSize,
      });
      return {
        parent,
        folders: items.map(f => ({ id: f.id, name: f.name, parents: f.parents ?? [] })),
      };
    } catch (err) {
      return reply.code(502).send({
        error: 'drive_api_error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
