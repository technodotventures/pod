import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeSmartwareCore } from '../smartware/core.js';

const OWNER = { authorization: 'Bearer owner-token' };

const BETA_INTEGRATION_IDS = [
  'microsoft-365', 'dropbox', 'box', 'asana', 'clickup', 'monday',
  'perplexity', 'canva', 'airtable', 'miro', 'atlassian', 'hubspot',
  'salesforce', 'attio', 'clay',
] as const;

const OAUTH_IDS = new Set([
  'microsoft-365', 'dropbox', 'box', 'canva', 'miro', 'atlassian', 'salesforce',
]);

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'beta-integrations-test',
    podName: 'Beta Integrations Test Pod',
    apiToken: 'owner-token',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('all advertised beta integrations have an actionable connection contract', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-beta-integrations-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const listed = await app.inject({ method: 'GET', url: '/integrations' });
    assert.equal(listed.statusCode, 200);
    const integrations = listed.json().integrations as Array<{
      id: string;
      auth_type: string;
      availability: string;
      status: string;
      testing_note?: string;
      test_available: boolean;
      fields: Array<{ key: string; secret?: boolean }>;
    }>;
    const byId = new Map(integrations.map(integration => [integration.id, integration]));

    for (const id of BETA_INTEGRATION_IDS) {
      const integration = byId.get(id);
      assert.ok(integration, `${id} should be advertised`);
      assert.equal(integration.availability, 'ready', `${id} should be in the beta catalog`);
      assert.match(integration.testing_note ?? '', /^Beta /, `${id} should describe its beta connection`);
      assert.ok(integration.fields.length > 0, `${id} should expose connection fields`);
      assert.equal(integration.auth_type, OAUTH_IDS.has(id) ? 'oauth' : 'api_key');
    }

    for (const id of BETA_INTEGRATION_IDS.filter(id => !OAUTH_IDS.has(id))) {
      const configured = await app.inject({
        method: 'POST',
        url: `/integrations/${id}/configure`,
        headers: OWNER,
        payload: { api_key: `test-${id}-token` },
      });
      assert.equal(configured.statusCode, 200, `${id} should accept its token: ${configured.body}`);
      assert.equal(configured.json().status, 'active');
    }

    const disconnected = await app.inject({
      method: 'DELETE',
      url: '/integrations/clay',
      headers: OWNER,
    });
    assert.equal(disconnected.statusCode, 200);
    const clayStatus = await app.inject({ method: 'GET', url: '/integrations/clay/status', headers: OWNER });
    assert.equal(clayStatus.json().status, 'disconnected');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('beta OAuth integrations generate usable authorization requests', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-beta-oauth-'));
  const app = await buildApp(testEnv(dataDir), false);

  const expectedHosts: Record<string, string> = {
    'microsoft-365': 'login.microsoftonline.com',
    dropbox: 'www.dropbox.com',
    box: 'account.box.com',
    canva: 'www.canva.com',
    miro: 'miro.com',
    atlassian: 'auth.atlassian.com',
    salesforce: 'login.salesforce.com',
  };

  try {
    for (const id of OAUTH_IDS) {
      const configured = await app.inject({
        method: 'POST',
        url: `/integrations/${id}/configure`,
        headers: OWNER,
        payload: { client_id: `${id}-client`, client_secret: `${id}-secret` },
      });
      assert.equal(configured.statusCode, 200, `${id} OAuth credentials should be configurable`);
      assert.equal(configured.json().status, 'configured');

      const auth = await app.inject({
        method: 'GET',
        url: `/integrations/${id}/auth-url?actor_id=person-local`,
        headers: OWNER,
      });
      assert.equal(auth.statusCode, 200, `${id} should produce an authorization URL: ${auth.body}`);
      const url = new URL(auth.json().url);
      assert.equal(url.host, expectedHosts[id]);
      assert.equal(url.searchParams.get('client_id'), `${id}-client`);
      assert.ok(url.searchParams.get('state'));
      assert.equal(url.searchParams.get('redirect_uri'), `http://127.0.0.1:0/integrations/${id}/callback`);
      if (id === 'canva') {
        assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
        assert.ok(url.searchParams.get('code_challenge'));
      }
      if (id === 'atlassian') {
        assert.equal(url.searchParams.get('audience'), 'api.atlassian.com');
        assert.equal(url.searchParams.get('prompt'), 'consent');
      }
    }
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('PKCE, JSON token exchange, and provider-specific test URLs survive OAuth callbacks', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-beta-oauth-callback-'));
  const app = await buildApp(testEnv(dataDir), false);
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/services/oauth2/token')) {
      return new Response(JSON.stringify({
        access_token: 'salesforce-access',
        refresh_token: 'salesforce-refresh',
        instance_url: 'https://example.my.salesforce.com',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.endsWith('/oauth/token')) {
      return new Response(JSON.stringify({ access_token: 'atlassian-access', refresh_token: 'atlassian-refresh' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.endsWith('/rest/v1/oauth/token')) {
      return new Response(JSON.stringify({ access_token: 'canva-access', refresh_token: 'canva-refresh' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ id: 'connected-user' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  async function connect(service: 'canva' | 'atlassian' | 'salesforce'): Promise<void> {
    await app.inject({
      method: 'POST',
      url: `/integrations/${service}/configure`,
      headers: OWNER,
      payload: { client_id: `${service}-client`, client_secret: `${service}-secret` },
    });
    const auth = await app.inject({
      method: 'GET',
      url: `/integrations/${service}/auth-url?actor_id=person-local`,
      headers: OWNER,
    });
    const state = new URL(auth.json().url).searchParams.get('state');
    assert.ok(state);
    const callback = await app.inject({
      method: 'GET',
      url: `/integrations/${service}/callback?code=test-code&state=${encodeURIComponent(state)}`,
    });
    assert.equal(callback.statusCode, 200, `${service} callback should succeed: ${callback.body}`);
  }

  try {
    await connect('canva');
    const canvaCall = calls.find(call => call.url.endsWith('/rest/v1/oauth/token'));
    assert.ok(canvaCall);
    assert.match(String((canvaCall.init?.headers as Record<string, string>).Authorization), /^Basic /);
    const canvaBody = new URLSearchParams(String(canvaCall.init?.body));
    assert.ok(canvaBody.get('code_verifier'));

    await connect('atlassian');
    const atlassianCall = calls.find(call => call.url === 'https://auth.atlassian.com/oauth/token');
    assert.ok(atlassianCall);
    assert.equal((atlassianCall.init?.headers as Record<string, string>)['content-type'], 'application/json');
    assert.equal(JSON.parse(String(atlassianCall.init?.body)).client_id, 'atlassian-client');

    await connect('salesforce');
    const tested = await app.inject({
      method: 'POST',
      url: '/integrations/salesforce/test',
      headers: OWNER,
      payload: {},
    });
    assert.equal(tested.statusCode, 200);
    assert.equal(tested.json().ok, true);
    assert.ok(calls.some(call => call.url === 'https://example.my.salesforce.com/services/oauth2/userinfo'));
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
    await closeSmartwareCore();
  }
});
