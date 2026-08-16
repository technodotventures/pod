/**
 * Generic integrations endpoint for Pod.
 * Handles status, configure, and connect flows for all service integrations.
 * Each integration stores its config in /data/integrations/<service>.json
 */
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { requireOwnerAuth } from '../security/auth.js';
import {
  deleteIntegrationConfig, readIntegrationConfig, writeIntegrationConfig,
  callMcpTool, listMcpTools,
  McpClientError, McpToolExecutionError, McpToolNotFoundError,
  getMcpProvider,
  TokenRefreshError,
  DockerRuntimeError,
  recordMcpCall, type CallerKind, type ErrorKind,
  checkConnectionGrant,
  // Integration registry (from @smartware/connectors)
  type IntegrationDef,
  listIntegrations,
  getIntegration,
  registerIntegration,
  integrationPublicStatus,
} from '@smartware/connectors';
import {
  isAIProviderId,
  reassignPreferredAIProvider,
  requestProviderText,
  resolveConfiguredAIProvider,
  setPreferredAIProvider,
} from '../services/ai-provider.js';
import { getDb } from '../pod/db.js';
import {
  deleteEmailPassword,
  storeEmailPassword,
} from '../services/macos-keychain.js';
import { testICloudMailConnection, type ICloudMailConfig } from '../services/icloud-email-source.js';

/* ── Register Pod-specific integrations into the shared registry ── */
registerIntegration({
  id: 'local-folders', name: 'Import documents', authType: 'local',
  availability: 'ready',
  testingNote: 'Ready for files, local folders, Obsidian vaults, and extracted Notion exports. Other archive importers are labelled individually in Pod.',
  products: ['Files', 'Obsidian', 'Notion', 'Evernote', 'Apple Notes', 'ChatGPT', 'Claude'],
});
registerIntegration({
  id: 'icloud-mail', name: 'iCloud Mail', authType: 'api_key',
  availability: 'ready',
  testingNote: 'Private email sync through encrypted IMAP with the password stored in macOS Keychain.',
  fields: [
    { key: 'account_email', label: 'iCloud email', placeholder: 'you@icloud.com' },
    { key: 'username', label: 'IMAP username', placeholder: 'Usually your iCloud email' },
  ],
});
registerIntegration({
  id: 'openai', name: 'OpenAI', authType: 'api_key',
  availability: 'ready',
  testingNote: 'Ready for Ask Pod and reflection after you save an API key.',
  fields: [
    { key: 'api_key', label: 'API Key', placeholder: 'sk-...', secret: true },
    { key: 'org_id', label: 'Organization ID (optional)', placeholder: 'org-...' },
  ],
  testUrl: 'https://api.openai.com/v1/models',
  testHeaders: (c) => ({ Authorization: `Bearer ${c.api_key}` }),
});
registerIntegration({
  id: 'anthropic', name: 'Anthropic', authType: 'api_key',
  availability: 'ready',
  testingNote: 'Ready for Ask Pod and reflection after you save an API key.',
  fields: [
    { key: 'api_key', label: 'API Key', placeholder: 'sk-ant-...', secret: true },
  ],
  testUrl: 'https://api.anthropic.com/v1/messages',
  testHeaders: (c) => ({ 'x-api-key': c.api_key, 'anthropic-version': '2023-06-01' }),
});
registerIntegration({
  id: 'openrouter', name: 'OpenRouter', authType: 'api_key',
  availability: 'ready',
  testingNote: 'Unified API for 200+ models. Connect to use as an LLM provider for reflection and Ask Pod.',
  fields: [
    { key: 'api_key', label: 'API Key', placeholder: 'sk-or-...', secret: true },
    { key: 'model', label: 'Model', placeholder: 'anthropic/claude-sonnet-4' },
  ],
  testUrl: 'https://openrouter.ai/api/v1/models',
  testHeaders: (c) => ({ Authorization: `Bearer ${c.api_key}` }),
});
registerIntegration({
  id: 'ollama', name: 'Ollama', authType: 'api_key',
  availability: 'ready',
  testingNote: 'Local model endpoint. Connect to use local models for reflection and extraction.',
  fields: [
    { key: 'base_url', label: 'Endpoint URL', placeholder: 'http://localhost:11434' },
  ],
});

/**
 * Pod extends the base integrationPublicStatus with AI-specific fields.
 */
function publicStatus(def: IntegrationDef, config: Record<string, unknown>): Record<string, unknown> {
  if (def.id === 'icloud-mail') {
    return {
      status: config['credential_stored'] === true && typeof config['account_email'] === 'string'
        ? 'active'
        : 'disconnected',
      connected_at: config['connected_at'],
      account_email: config['account_email'],
      credential_store: config['credential_stored'] === true ? 'macos_keychain' : undefined,
    };
  }
  const base = integrationPublicStatus(def, config);
  // Layer on AI provider metadata for api_key integrations
  if (def.authType === 'api_key' && isAIProviderId(def.id)) {
    return {
      ...base,
      is_ai_provider: true,
      ai_default: config['selected_for_ai'] === true || undefined,
    };
  }
  return base;
}

function hasConnectionTest(def: IntegrationDef): boolean {
  return Boolean(def.testUrl || def.id === 'icloud-mail' || def.id === 'ollama' || isAIProviderId(def.id));
}

async function emailPublicStatus(env: CoffeePodEnv): Promise<Record<string, unknown>> {
  const google = await readIntegrationConfig(env, 'gmail');
  const icloud = await readIntegrationConfig(env, 'icloud-mail');
  const googleStatus = publicStatus(getIntegration('gmail')!, google);
  const icloudStatus = publicStatus(getIntegration('icloud-mail')!, icloud);
  const googleActive = googleStatus['status'] === 'active';
  const icloudActive = icloudStatus['status'] === 'active';
  return {
    ...googleStatus,
    status: googleActive || icloudActive
      ? 'active'
      : googleStatus['status'] === 'configured' ? 'configured' : 'disconnected',
    connected_at: [googleStatus['connected_at'], icloudStatus['connected_at']]
      .filter((value): value is string => typeof value === 'string')
      .sort()
      .at(-1),
    email_providers: {
      google: { status: googleStatus['status'], connected_at: googleStatus['connected_at'] },
      icloud: {
        status: icloudStatus['status'],
        connected_at: icloudStatus['connected_at'],
        account_email: icloudStatus['account_email'],
      },
    },
  };
}

/* ── Route registration ── */

export async function registerIntegrationRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {

  /**
   * GET /integrations
   * Returns all integrations with their current status.
   */
  app.get('/integrations', {
    schema: { summary: 'List all integrations with status' },
  }, async () => {
    const advertised = listIntegrations().filter(def => def.id !== 'coffee' && def.id !== 'icloud-mail');
    const results = await Promise.all(advertised.map(async (def) => {
      const config = await readIntegrationConfig(env, def.id);
      return {
        id: def.id,
        name: def.name,
        auth_type: def.authType,
        availability: def.availability,
        testing_note: def.testingNote,
        test_available: hasConnectionTest(def),
        products: def.products ?? [],
        fields: (def.fields ?? []).map(f => ({ key: f.key, label: f.label, placeholder: f.placeholder, secret: f.secret })),
        ...(def.id === 'gmail' ? await emailPublicStatus(env) : publicStatus(def, config)),
      };
    }));
    return { integrations: results };
  });

  /**
   * GET /integrations/:service/status
   * Returns status for a specific integration.
   */
  app.get<{ Params: { service: string } }>('/integrations/:service/status', {
    schema: { summary: 'Get integration status' },
  }, async (request, reply) => {
    const def = getIntegration(request.params.service);
    if (!def) return reply.code(404).send({ error: 'not_found' });
    const config = await readIntegrationConfig(env, def.id);
    return {
      id: def.id,
      name: def.name,
      auth_type: def.authType,
      availability: def.availability,
      testing_note: def.testingNote,
      test_available: hasConnectionTest(def),
      products: def.products ?? [],
      ...(def.id === 'gmail' ? await emailPublicStatus(env) : publicStatus(def, config)),
    };
  });

  /**
   * POST /integrations/:service/configure
   * Save credentials (API key, OAuth client ID/secret, endpoint URL).
   */
  app.post<{ Params: { service: string }; Body: Record<string, unknown> }>('/integrations/:service/configure', {
    schema: { summary: 'Configure integration credentials' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;

    const def = getIntegration(request.params.service);
    if (!def) return reply.code(404).send({ error: 'not_found' });
    if (def.authType === 'builtin' || def.authType === 'local') {
      return reply.code(400).send({ error: 'not_configurable' });
    }

    const existing = await readIntegrationConfig(env, def.id);
    const body = request.body as Record<string, unknown>;

    if (def.id === 'icloud-mail') {
      const previousEmail = typeof existing['account_email'] === 'string'
        ? existing['account_email'].trim().toLowerCase()
        : '';
      const accountEmail = typeof body['account_email'] === 'string'
        ? body['account_email'].trim().toLowerCase()
        : previousEmail;
      const username = typeof body['username'] === 'string' && body['username'].trim()
        ? body['username'].trim()
        : typeof existing['username'] === 'string' && existing['username'].trim()
          ? existing['username'].trim()
          : accountEmail;
      const password = typeof body['app_password'] === 'string' ? body['app_password'] : '';
      const canReuseStoredPassword = existing['credential_stored'] === true && accountEmail === previousEmail;
      if (!accountEmail.includes('@') || (!password.trim() && !canReuseStoredPassword)) {
        return reply.code(400).send({
          error: 'invalid_credentials',
          message: 'Enter your iCloud email and an app-specific password.',
        });
      }
      if (password.trim()) {
        try {
          // Validate first with the supplied password. This preserves a working
          // Keychain entry if a replacement credential is mistyped.
          const candidate: ICloudMailConfig = { account_email: accountEmail, username };
          await testICloudMailConnection(candidate, async () => password);
          await storeEmailPassword(accountEmail, password);
          if (previousEmail && previousEmail !== accountEmail) {
            await deleteEmailPassword(previousEmail).catch(() => undefined);
          }
        } catch (error) {
          return reply.code(400).send({
            error: 'connection_failed',
            message: error instanceof Error ? error.message : 'Could not connect to iCloud Mail.',
          });
        }
      } else {
        const candidate: ICloudMailConfig = { account_email: accountEmail, username };
        try {
          await testICloudMailConnection(candidate);
        } catch (error) {
          return reply.code(400).send({
            error: 'connection_failed',
            message: error instanceof Error ? error.message : 'Could not connect to iCloud Mail.',
          });
        }
      }
      existing['account_email'] = accountEmail;
      existing['username'] = username;
      existing['provider'] = 'icloud';
      existing['credential_stored'] = true;
      existing['credential_store'] = 'macos_keychain';
      existing['connected_at'] = new Date().toISOString();
    }

    // Merge fields from body into config
    for (const field of (def.fields ?? [])) {
      if (body[field.key] !== undefined) {
        existing[field.key] = body[field.key];
      }
    }
    // Connection wizards own these bounded, non-secret policy blocks. The
    // previous generic route silently discarded them, making UI choices no-op.
    for (const key of ['filters', 'cadence', 'scope_routing', 'signal_config'] as const) {
      const value = body[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) existing[key] = value;
    }

    existing.configured_at = new Date().toISOString();
    await writeIntegrationConfig(env, def.id, existing);
    if (isAIProviderId(def.id) && typeof existing.api_key === 'string' && existing.api_key.trim().length > 0) {
      await setPreferredAIProvider(env, def.id);
      existing.selected_for_ai = true;
    }
    return { ok: true, ...(def.id === 'gmail' ? await emailPublicStatus(env) : publicStatus(def, existing)) };
  });

  /**
   * POST /integrations/:service/make-primary
   * Set an AI provider as the primary for Ask Pod / reflection.
   */
  app.post<{ Params: { service: string } }>('/integrations/:service/make-primary', {
    schema: { summary: 'Set AI provider as primary' },
  }, async (request, reply) => {
    const def = getIntegration(request.params.service);
    if (!def) return reply.code(404).send({ error: 'not_found' });
    if (!isAIProviderId(def.id)) return reply.code(400).send({ error: 'not_an_ai_provider' });
    await setPreferredAIProvider(env, def.id);
    return { ok: true };
  });

  /**
   * POST /integrations/:service/test
   * Test the connection by hitting the test URL.
   */
  app.post<{ Params: { service: string } }>('/integrations/:service/test', {
    schema: { summary: 'Test integration connection' },
  }, async (request, reply) => {
    const def = getIntegration(request.params.service);
    if (!def) return reply.code(404).send({ error: 'not_found' });

    const config = await readIntegrationConfig(env, def.id) as Record<string, string>;

    if (def.id === 'icloud-mail') {
      try {
        await testICloudMailConnection(config as unknown as ICloudMailConfig);
        return { ok: true, status: 200 };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'Could not connect to iCloud Mail.' };
      }
    }

    if (isAIProviderId(def.id)) {
      const provider = await resolveConfiguredAIProvider(env, def.id, 'fast');
      if (!provider) return { ok: false, message: 'Save an API key first' };
      try {
        await requestProviderText(provider, {
          system: 'Reply with OK.',
          prompt: 'Return only the text OK.',
          maxTokens: 16,
        });
        return { ok: true, status: 200 };
      } catch (error) {
        return { ok: false, message: (error as Error).message };
      }
    }

    // Handle Ollama special case
    let testUrl = typeof def.testUrl === 'function' ? def.testUrl(config) : def.testUrl;
    if (def.id === 'ollama') {
      const base = config.base_url || 'http://localhost:11434';
      testUrl = `${base.replace(/\/$/, '')}/api/tags`;
    }

    if (!testUrl) return reply.code(400).send({ error: 'no_test_available' });

    try {
      const headers = def.testHeaders ? def.testHeaders(config) : {};
      const res = await fetch(testUrl, {
        method: def.testMethod ?? 'GET',
        headers,
        body: def.testBody?.(config),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        return { ok: true, status: res.status };
      }
      return { ok: false, status: res.status, message: `HTTP ${res.status}` };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  });

  /**
   * GET /integrations/:service/auth-url
   * Generate OAuth authorization URL for OAuth services.
   */
  app.get<{ Params: { service: string }; Querystring: { actor_id?: string } }>('/integrations/:service/auth-url', {
    schema: { summary: 'Get OAuth authorization URL' },
  }, async (request, reply) => {
    const def = getIntegration(request.params.service);
    if (!def || def.authType !== 'oauth' || !def.oauth) {
      return reply.code(400).send({ error: 'not_oauth' });
    }

    const config = await readIntegrationConfig(env, def.id);
    // Fall back to env vars ONLY for Google services (shared Google OAuth credentials)
    const isGoogleService = ['google-drive', 'google-calendar', 'gmail'].includes(def.id);
    if (!config.client_id) {
      const envKey = `${def.id.replace(/-/g, '_').toUpperCase()}_CLIENT_ID`;
      config.client_id = process.env[envKey] ?? (isGoogleService ? process.env['GOOGLE_CLIENT_ID'] : undefined);
    }
    if (!config.client_secret) {
      const envKey = `${def.id.replace(/-/g, '_').toUpperCase()}_CLIENT_SECRET`;
      config.client_secret = process.env[envKey] ?? (isGoogleService ? process.env['GOOGLE_CLIENT_SECRET'] : undefined);
    }
    if (!config.client_id || !config.client_secret) {
      return reply.code(400).send({ error: 'not_configured', message: 'Set client_id and client_secret first via /integrations/:service/configure' });
    }

    const state = crypto.randomBytes(24).toString('base64url');
    config.state = state;
    config.state_actor_id = request.query.actor_id ?? 'person-local';

    let codeChallenge: string | undefined;
    if (def.oauth.pkce) {
      const codeVerifier = crypto.randomBytes(48).toString('base64url');
      codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
      config.code_verifier = codeVerifier;
    }
    await writeIntegrationConfig(env, def.id, config);

    const redirectUri = `http://127.0.0.1:${env.port}/integrations/${def.id}/callback`;

    // GitLab self-hosted: if the user configured a custom gitlab_url,
    // rewrite the authorize URL to point to their instance.
    let authorizeUrl = def.oauth.authorizeUrl;
    if (def.id === 'gitlab' && typeof config.gitlab_url === 'string' && config.gitlab_url.trim()) {
      const base = config.gitlab_url.replace(/\/+$/, '');
      authorizeUrl = `${base}/oauth/authorize`;
    }

    const params = new URLSearchParams({
      client_id: config.client_id as string,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      ...(def.oauth.extraParams ?? {}),
    });
    if (def.oauth.scopes.length > 0) params.set('scope', def.oauth.scopes.join(' '));
    if (codeChallenge) {
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', 'S256');
    }

    return { url: `${authorizeUrl}?${params.toString()}` };
  });

  /**
   * GET /integrations/:service/callback
   * OAuth callback handler — exchanges code for tokens.
   */
  app.get<{ Params: { service: string }; Querystring: { code?: string; state?: string; error?: string } }>('/integrations/:service/callback', {
    schema: { summary: 'OAuth callback' },
  }, async (request, reply) => {
    const def = getIntegration(request.params.service);
    if (!def || def.authType !== 'oauth' || !def.oauth) {
      return reply.code(400).send({ error: 'not_oauth' });
    }

    if (request.query.error) {
      return reply.type('text/html').send(`<html><body><h2>Authorization failed</h2><p>${request.query.error}</p><script>window.close()</script></body></html>`);
    }

    const config = await readIntegrationConfig(env, def.id);
    const isGoogleSvc = ['google-drive', 'google-calendar', 'gmail'].includes(def.id);
    if (!config.client_id) {
      const envKey = `${def.id.replace(/-/g, '_').toUpperCase()}_CLIENT_ID`;
      config.client_id = process.env[envKey] ?? (isGoogleSvc ? process.env['GOOGLE_CLIENT_ID'] : undefined);
    }
    if (!config.client_secret) {
      const envKey = `${def.id.replace(/-/g, '_').toUpperCase()}_CLIENT_SECRET`;
      config.client_secret = process.env[envKey] ?? (isGoogleSvc ? process.env['GOOGLE_CLIENT_SECRET'] : undefined);
    }
    if (!request.query.code || request.query.state !== config.state) {
      return reply.code(400).send({ error: 'invalid_state' });
    }

    // Exchange code for tokens
    const redirectUri = `http://127.0.0.1:${env.port}/integrations/${def.id}/callback`;
    const tokenBody: Record<string, string> = {
      code: request.query.code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    };
    if (def.oauth.tokenClientAuth !== 'basic') {
      tokenBody.client_id = config.client_id as string;
      tokenBody.client_secret = config.client_secret as string;
    }
    if (def.oauth.pkce && typeof config.code_verifier === 'string') {
      tokenBody.code_verifier = config.code_verifier;
    }

    // GitLab self-hosted: rewrite token URL to the configured instance
    let tokenUrl = def.oauth.tokenUrl;
    if (def.id === 'gitlab' && typeof config.gitlab_url === 'string' && config.gitlab_url.trim()) {
      const base = (config.gitlab_url as string).replace(/\/+$/, '');
      tokenUrl = `${base}/oauth/token`;
    }

    try {
      const tokenHeaders: Record<string, string> = {
        'content-type': def.oauth.tokenRequestFormat === 'json'
          ? 'application/json'
          : 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      };
      if (def.oauth.tokenClientAuth === 'basic') {
        const credentials = Buffer.from(`${config.client_id}:${config.client_secret}`).toString('base64');
        tokenHeaders.Authorization = `Basic ${credentials}`;
      }
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: tokenHeaders,
        body: def.oauth.tokenRequestFormat === 'json'
          ? JSON.stringify(tokenBody)
          : new URLSearchParams(tokenBody),
      });
      const tokenData = await tokenRes.json() as Record<string, unknown>;

      if (!tokenRes.ok || tokenData.error) {
        return reply.type('text/html').send(`<html><body><h2>Token exchange failed</h2><p>${tokenData.error_description ?? tokenData.error ?? 'Unknown error'}</p><script>window.close()</script></body></html>`);
      }

      config.access_token = tokenData.access_token;
      if (tokenData.refresh_token) config.refresh_token = tokenData.refresh_token;
      if (tokenData.expires_in) config.expires_at = Date.now() + (tokenData.expires_in as number) * 1000;
      if (typeof tokenData.scope === 'string') config.granted_scope = tokenData.scope;
      if (typeof tokenData.instance_url === 'string') config.instance_url = tokenData.instance_url;
      config.connected_at = new Date().toISOString();
      delete config.state;
      delete config.state_actor_id;
      delete config.code_verifier;

      await writeIntegrationConfig(env, def.id, config);

      return reply.type('text/html').send(`<html><body><h2>${def.name} connected!</h2><p>You can close this window and return to Pod.</p><script>window.close()</script></body></html>`);
    } catch (error) {
      app.log.error({ error, service: def.id }, 'OAuth token exchange failed');
      return reply.type('text/html').send(`<html><body><h2>Connection failed</h2><p>${(error as Error).message}</p><script>window.close()</script></body></html>`);
    }
  });

  /**
   * DELETE /integrations/:service
   * Disconnect an integration (remove stored tokens/keys).
   */
  app.delete<{ Params: { service: string } }>('/integrations/:service', {
    schema: { summary: 'Disconnect integration' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;

    const def = getIntegration(request.params.service);
    if (!def) return reply.code(404).send({ error: 'not_found' });

    if (def.id === 'icloud-mail') {
      const config = await readIntegrationConfig(env, def.id);
      if (typeof config['account_email'] === 'string') {
        await deleteEmailPassword(config['account_email']).catch(() => undefined);
      }
    }
    await deleteIntegrationConfig(env, def.id);
    if (isAIProviderId(def.id)) {
      await reassignPreferredAIProvider(env);
    }

    return { ok: true, status: 'disconnected' };
  });

  /**
   * GET /integrations/:service/tools
   * List MCP tools exposed by the Klavis server for this integration.
   * Owner can see all tools. Clients see only tools their grants cover.
   */
  app.get<{ Params: { service: string } }>('/integrations/:service/tools', {
    schema: { summary: 'List MCP tools available for an integration' },
  }, async (request, reply) => {
    const def = getIntegration(request.params.service);
    if (!def) return reply.code(404).send({ error: 'not_found' });
    if (!getMcpProvider(def.id)) {
      return reply.code(400).send({ error: 'mcp_not_supported', message: `${def.id} has no Klavis MCP server wired in registry` });
    }
    // Klavis google-drive-mcp-server requires drive.readonly to support
    // its search/list/retrieve tools. Under our drive.file scope it will
    // fail at runtime — gate it here so the wizard doesn't surface tools
    // the user can't actually call.
    if (def.id === 'google-drive') {
      return reply.code(400).send({
        error: 'mcp_unsupported_under_drive_file',
        message: 'Klavis Drive MCP tools require drive.readonly; Pod uses drive.file (picker-only). Switch scope to re-enable.',
      });
    }

    try {
      const tools = await listMcpTools(env, def.id);
      return { service: def.id, tools };
    } catch (error) {
      return reply.code(mcpErrorStatus(error)).send({ error: 'mcp_error', message: (error as Error).message });
    }
  });

  /**
   * POST /integrations/:service/tools/:tool/call
   * Invoke a Klavis MCP tool. Owner can call any tool; clients need a connection_grant.
   * Every call (including denials) is recorded in mcp_tool_calls.
   */
  app.post<{ Params: { service: string; tool: string }; Body: { arguments?: Record<string, unknown> } }>(
    '/integrations/:service/tools/:tool/call',
    { schema: { summary: 'Invoke an MCP tool on an integration' } },
    async (request, reply) => {
      const db = getDb(env);
      const auth = request.coffeePodAuth;
      const callerKind: CallerKind = !auth ? 'unauthenticated' : auth.kind === 'owner' ? 'owner' : auth.kind === 'client' ? 'client' : 'owner';
      const callerActorId = auth?.kind === 'client' ? auth.client.actor_id : 'owner';
      const args = (request.body && typeof request.body === 'object' ? request.body.arguments : undefined) ?? {};
      const recordOutcome = (status: 'ok' | 'error', errorKind: ErrorKind | null, duration: number, grantId: string | null) => {
        try {
          recordMcpCall(db, {
            actor_id: callerActorId, service_id: request.params.service, tool_name: request.params.tool,
            args, status, error_kind: errorKind, duration_ms: duration, grant_id: grantId, caller_kind: callerKind,
          });
        } catch {/* audit failures must not break the response */}
      };

      const def = getIntegration(request.params.service);
      if (!def) return reply.code(404).send({ error: 'not_found' });
      if (!getMcpProvider(def.id)) {
        recordOutcome('error', 'unsupported', 0, null);
        return reply.code(400).send({ error: 'mcp_not_supported', message: `${def.id} has no Klavis MCP server wired in registry` });
      }
      if (def.id === 'google-drive') {
        recordOutcome('error', 'unsupported', 0, null);
        return reply.code(400).send({
          error: 'mcp_unsupported_under_drive_file',
          message: 'Klavis Drive MCP tools require drive.readonly; Pod uses drive.file. Switch scope to re-enable.',
        });
      }

      // Permission gate: owner has full access (bypass); client tokens need a matching connection_grant.
      let grantId: string | null = null;
      if (auth?.kind === 'client') {
        const grant = checkConnectionGrant(db, auth.client.actor_id, def.id, request.params.tool);
        if (!grant) {
          recordOutcome('error', 'grant_denied', 0, null);
          return reply.code(403).send({
            error: 'no_connection_grant',
            message: `Actor ${auth.client.actor_id} has no active grant for ${def.id}/${request.params.tool}`,
          });
        }
        grantId = grant.id;
      }

      const start = Date.now();
      try {
        const result = await callMcpTool(env, def.id, request.params.tool, args);
        recordOutcome('ok', null, Date.now() - start, grantId);
        return { service: def.id, tool: request.params.tool, result };
      } catch (error) {
        const status = mcpErrorStatus(error);
        const errorKind = mcpErrorKind(error);
        const errorCode = mcpErrorCode(error);
        recordOutcome('error', errorKind, Date.now() - start, grantId);
        return reply.code(status).send({ error: errorCode, message: (error as Error).message });
      }
    },
  );
}

function mcpErrorStatus(error: unknown): number {
  if (error instanceof TokenRefreshError) return 401;
  if (error instanceof DockerRuntimeError) return 503;
  if (error instanceof McpToolNotFoundError) return 404;
  if (error instanceof McpToolExecutionError) return 422;
  if (error instanceof McpClientError) return 400;
  return 500;
}

function mcpErrorKind(error: unknown): ErrorKind {
  if (error instanceof TokenRefreshError) return 'token_refresh';
  if (error instanceof DockerRuntimeError) return 'docker_runtime';
  if (error instanceof McpToolNotFoundError) return 'tool_not_found';
  if (error instanceof McpToolExecutionError) return 'tool_execution';
  if (error instanceof McpClientError) return 'mcp';
  return 'unknown';
}

function mcpErrorCode(error: unknown): string {
  if (error instanceof McpToolNotFoundError) return 'tool_not_found';
  if (error instanceof McpToolExecutionError) return 'tool_execution_error';
  return 'mcp_error';
}
