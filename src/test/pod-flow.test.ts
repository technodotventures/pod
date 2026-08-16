import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readLatestClaimVersion } from 'smartware';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeSmartwareCore, getSmartwareCore } from '../smartware/core.js';

let operationSequence = 100;
function operationId(): string {
  operationSequence += 1;
  return `op_${String(operationSequence).padStart(26, '0')}`;
}

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'founder-test',
    podName: 'Founder Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('Coffee uses its app-owned data space for the memory and approval loop', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-test-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const health = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().ok, true);

    const status = await app.inject({ method: 'GET', url: '/pod/status' });
    assert.equal(status.statusCode, 200);
    const statusBody = status.json();
    assert.equal(statusBody.pod.pod_id, 'founder-test');
    assert.equal(statusBody.pod.scopes.workspace, 'pod/founder-test/workspace');
    assert.deepEqual(Object.keys(statusBody.pod.scopes), ['personal', 'workspace']);

    const capabilities = await app.inject({ method: 'GET', url: '/pod/capabilities' });
    assert.equal(capabilities.statusCode, 200);
    assert.equal(capabilities.json().protocol.substrate, 'smartware');
    assert.equal(capabilities.json().human_review.external_actions_require_approval, true);
    assert.ok(capabilities.json().capabilities.library.includes('objects'));
    assert.ok(capabilities.json().capabilities.memory.includes('watch'));
    assert.ok(capabilities.json().capabilities.coffee.includes('sync_meetings'));

    const connect = await app.inject({
      method: 'POST',
      url: '/coffee/connect',
      payload: {
        client_id: 'coffee-desktop-test',
        client_name: 'Coffee Desktop Test',
        pod_url: 'http://127.0.0.1:8732',
      },
    });
    assert.equal(connect.statusCode, 200);
    const connectedClient = connect.json();
    assert.equal(connectedClient.status, 'connected');
    assert.equal(connectedClient.actor_id, 'coffee:coffee-desktop-test');
    assert.ok(connectedClient.client_token.startsWith('cpod_'));
    assert.ok(!connectedClient.token_prefix.includes(connectedClient.client_token.slice(10)));

    const observe = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: connectedClient.actor_id,
        operation_id: operationId(),
        scope_alias: 'app:coffee',
        type: 'decision',
        content: 'Pod is the user-owned memory companion for Coffee and third-party apps.',
        source_id: 'test-memory-1',
      },
    });
    assert.equal(observe.statusCode, 200);

    const collection = await app.inject({
      method: 'POST',
      url: '/pod/collections',
      payload: {
        actor_id: 'person-local',
        id: 'projects',
        name: 'Projects',
        description: 'Generic project objects from any connected app.',
      },
    });
    assert.equal(collection.statusCode, 200);
    assert.equal(collection.json().collection.id, 'projects');

    const object = await app.inject({
      method: 'POST',
      url: '/pod/objects',
      payload: {
        actor_id: 'person-local',
        id: 'project-coffee-pod',
        collection_id: 'projects',
        kind: 'project',
        title: 'Pod',
        content: {
          summary: 'A generic user-owned data and memory substrate.',
          status: 'prototype',
        },
        source: {
          app: 'coffee-pod',
          external_id: 'project-coffee-pod',
        },
      },
    });
    assert.equal(object.statusCode, 200);
    assert.equal(object.json().object.kind, 'project');

    const objects = await app.inject({ method: 'GET', url: '/pod/objects?collection_id=projects&query=substrate' });
    assert.equal(objects.statusCode, 200);
    assert.equal(objects.json().objects[0].id, 'project-coffee-pod');

    const appEvent = await app.inject({
      method: 'POST',
      url: '/pod/events',
      payload: {
        actor_id: 'person-local',
        source_app: 'openclaw',
        event_type: 'session.completed',
        object: {
          id: 'session-1',
          kind: 'openclaw.session',
          title: 'OpenClaw local task',
          content: {
            outcome: 'Implemented a local workflow and captured durable next steps.',
          },
        },
        text: 'OpenClaw completed the local task and identified a follow-up to test extraction automatically.',
        memory_policy: {
          extract: false,
        },
      },
    });
    assert.equal(appEvent.statusCode, 200);
    assert.equal(appEvent.json().event.extraction, 'skipped');
    assert.equal(appEvent.json().object.kind, 'openclaw.session');

    const syncMeetings = await app.inject({
      method: 'POST',
      url: '/coffee/sync/meetings',
      payload: {
        actor_id: connectedClient.actor_id,
        meetings: [
          {
            id: 'meeting-1',
            title: 'Founder Pod staging kickoff',
            start_at: '2026-05-08T10:00:00.000Z',
            attendees: [{ name: 'Stevie', email: 'stevie@example.com' }],
            notes: 'Discuss Pod as the memory companion for Coffee staging.',
            documents: [
              {
                id: 'doc-1',
                title: 'Pod integration plan',
                text: 'Coffee staging should call the Pod meeting sync, brief, and capture endpoints.',
              },
            ],
          },
        ],
      },
    });
    assert.equal(syncMeetings.statusCode, 200);
    assert.equal(syncMeetings.json().count, 1);

    const coffeeObjects = await app.inject({ method: 'GET', url: '/pod/objects?collection_id=coffee&kind=coffee.meeting&query=staging' });
    assert.equal(coffeeObjects.statusCode, 200);
    assert.equal(coffeeObjects.json().objects[0].id, 'coffee:meeting:meeting-1');

    const brief = await app.inject({
      method: 'POST',
      url: '/coffee/meetings/meeting-1/brief',
      payload: {
        actor_id: connectedClient.actor_id,
        query: 'Founder Pod staging kickoff Pod integration plan',
      },
    });
    assert.equal(brief.statusCode, 200);
    assert.ok(brief.json().brief.includes('Meeting brief for Coffee meeting meeting-1'));
    assert.ok(brief.json().sources.length > 0);

    const capture = await app.inject({
      method: 'POST',
      url: '/coffee/meetings/meeting-1/capture',
      payload: {
        actor_id: connectedClient.actor_id,
        notes: 'We decided to give the CTO a finished Pod runtime to plug into staging.',
        decisions: ['Pod exposes stable staging integration endpoints.'],
        tasks: ['Create staging Coffee API adapter.'],
        followups: [{ title: 'Send Pod integration package', to: 'cto@example.com' }],
      },
    });
    assert.equal(capture.statusCode, 200);
    assert.ok(capture.json().writes.length >= 4);

    const query = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: connectedClient.actor_id,
        scope_alias: 'app:coffee',
        query: 'memory companion',
        limit: 5,
      },
    });
    assert.equal(query.statusCode, 200);
    const queryBody = query.json();
    assert.ok(queryBody.observations.some((item: { snippet?: string }) => item.snippet?.includes('memory companion')));

    const propose = await app.inject({
      method: 'POST',
      url: '/pod/agent/action/propose',
      payload: {
        actor_id: connectedClient.actor_id,
        scope_alias: 'app:coffee',
        action_id: 'action-test-1',
        action_type: 'draft_email',
        title: 'Draft founder follow-up',
        description: 'Prepare the follow-up for human review.',
        external_system: 'email',
        payload: { to: 'founder@example.com' },
      },
    });
    assert.equal(propose.statusCode, 200);
    assert.equal(propose.json().review_required, true);

    const pending = await app.inject({ method: 'GET', url: '/pod/approvals?scope_alias=app%3Acoffee' });
    assert.equal(pending.statusCode, 200);
    assert.equal(pending.json().approvals[0].action_id, 'action-test-1');

    const approve = await app.inject({
      method: 'POST',
      url: '/pod/agent/action/approve',
      payload: {
        actor_id: statusBody.pod.owner_id,
        scope_alias: 'app:coffee',
        action_id: 'action-test-1',
        reason: 'Ready for the next execution phase.',
      },
    });
    assert.equal(approve.statusCode, 200);
    assert.equal(approve.json().status, 'approved');

    const emptyPending = await app.inject({ method: 'GET', url: '/pod/approvals?scope_alias=app%3Acoffee' });
    assert.equal(emptyPending.statusCode, 200);
    assert.equal(emptyPending.json().approvals.length, 0);

    const resolved = await app.inject({ method: 'GET', url: '/pod/approvals?scope_alias=app%3Acoffee&include_resolved=true' });
    assert.equal(resolved.statusCode, 200);
    assert.equal(resolved.json().approvals[0].status, 'approved');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('Pod can require an API token outside public routes', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-auth-test-'));
  const app = await buildApp({ ...testEnv(dataDir), apiToken: 'test-token' }, false);

  try {
    const health = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(health.statusCode, 200);

    const blocked = await app.inject({ method: 'GET', url: '/pod/capabilities' });
    assert.equal(blocked.statusCode, 401);
    assert.equal(blocked.json().error, 'unauthorized');

    const allowed = await app.inject({
      method: 'GET',
      url: '/pod/capabilities',
      headers: { authorization: 'Bearer test-token' },
    });
    assert.equal(allowed.statusCode, 200);
    assert.equal(allowed.json().auth.api_token_required, true);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('Pod issues a per-client token during authenticated pairing', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-client-token-test-'));
  const app = await buildApp({ ...testEnv(dataDir), apiToken: 'owner-token' }, false);

  try {
    const unauthenticatedConnect = await app.inject({
      method: 'POST',
      url: '/coffee/connect',
      payload: {
        client_id: 'coffee-desktop-secure-test',
        client_name: 'Coffee Desktop Secure Test',
        pod_url: 'http://127.0.0.1:8732',
      },
    });
    assert.equal(unauthenticatedConnect.statusCode, 401);

    const connect = await app.inject({
      method: 'POST',
      url: '/coffee/connect',
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        client_id: 'coffee-desktop-secure-test',
        client_name: 'Coffee Desktop Secure Test',
        pod_url: 'http://127.0.0.1:8732',
      },
    });
    assert.equal(connect.statusCode, 200);
    const clientToken = connect.json().client_token;
    assert.ok(clientToken.startsWith('cpod_'));

    const clientStatus = await app.inject({
      method: 'GET',
      url: '/pod/status',
      headers: { authorization: `Bearer ${clientToken}` },
    });
    assert.equal(clientStatus.statusCode, 200);
    assert.equal(clientStatus.json().pod.pod_id, 'founder-test');

    const clientCannotListClients = await app.inject({
      method: 'GET',
      url: '/coffee/clients',
      headers: { authorization: `Bearer ${clientToken}` },
    });
    assert.equal(clientCannotListClients.statusCode, 403);

    const actorMismatch = await app.inject({
      method: 'POST',
      url: '/coffee/sync/meetings',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        actor_id: 'coffee:some-other-client',
        meetings: [{ id: 'meeting-denied', title: 'Denied meeting' }],
      },
    });
    assert.equal(actorMismatch.statusCode, 403);

    const actorMatch = await app.inject({
      method: 'POST',
      url: '/coffee/sync/meetings',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        actor_id: connect.json().actor_id,
        meetings: [{ id: 'meeting-allowed', title: 'Allowed meeting' }],
      },
    });
    assert.equal(actorMatch.statusCode, 200);

    const clients = await app.inject({
      method: 'GET',
      url: '/coffee/clients',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(clients.statusCode, 200);
    assert.equal(clients.json().clients[0].client_id, 'coffee-desktop-secure-test');
    assert.equal(clients.json().clients[0].token_hash, undefined);

    const revoke = await app.inject({
      method: 'POST',
      url: '/coffee/clients/coffee-desktop-secure-test/revoke',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(revoke.statusCode, 200);
    assert.equal(revoke.json().status, 'revoked');

    const revokedStatus = await app.inject({
      method: 'GET',
      url: '/pod/status',
      headers: { authorization: `Bearer ${clientToken}` },
    });
    assert.equal(revokedStatus.statusCode, 401);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('Pod stores Google Drive OAuth configuration locally', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-google-drive-test-'));
  const app = await buildApp({ ...testEnv(dataDir), apiToken: 'owner-token' }, false);

  try {
    const initial = await app.inject({
      method: 'GET',
      url: '/integrations/google-drive/status',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(initial.statusCode, 200);
    assert.equal(initial.json().google_drive.configured, false);

    const configured = await app.inject({
      method: 'POST',
      url: '/integrations/google-drive/configure',
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        client_id: 'google-client-id.apps.googleusercontent.com',
        client_secret: 'google-client-secret',
      },
    });
    assert.equal(configured.statusCode, 200);
    assert.equal(configured.json().google_drive.configured, true);
    assert.equal(configured.json().google_drive.connected, false);

    const authUrl = await app.inject({
      method: 'GET',
      url: '/integrations/google-drive/auth-url?actor_id=person-local',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(authUrl.statusCode, 200);
    assert.ok(authUrl.json().url.includes('accounts.google.com'));
    // Migrated again: drive.file (Picker) → drive.readonly + native folder
    // browser. See src/routes/google-drive.ts header for rationale.
    assert.ok(authUrl.json().url.includes('drive.readonly'));
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('Pod Google Drive callback rejects state mismatch (CSRF defense)', async () => {
  // Regression test for CP-SEC-003: the callback used to log a warning and
  // continue when the OAuth state did not match — allowing any page to inject
  // an attacker-controlled authorization code and overwrite the user's stored
  // refresh token. The hardened callback now rejects mismatched state with
  // a 400 and refuses to call the token endpoint at all.
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-google-drive-state-test-'));
  const app = await buildApp({ ...testEnv(dataDir), apiToken: 'owner-token' }, false);

  let tokenEndpointCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    if (String(input).includes('oauth2.googleapis.com/token')) {
      tokenEndpointCalls += 1;
    }
    return new Response(JSON.stringify({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const configured = await app.inject({
      method: 'POST',
      url: '/integrations/google-drive/configure',
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        client_id: 'google-client-id.apps.googleusercontent.com',
        client_secret: 'google-client-secret',
      },
    });
    assert.equal(configured.statusCode, 200);

    const callback = await app.inject({
      method: 'GET',
      url: '/integrations/google-drive/callback?code=attacker-code&state=stale-browser-state',
    });
    assert.equal(callback.statusCode, 400);
    assert.ok(callback.body.includes('OAuth state did not match'));
    assert.equal(tokenEndpointCalls, 0, 'token endpoint must not be called on state mismatch');

    const status = await app.inject({
      method: 'GET',
      url: '/integrations/google-drive/status',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(status.json().google_drive.connected, false);
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
    await closeSmartwareCore();
  }
});

test('Pod imports explicitly selected Google Drive files through connector grant', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-google-drive-import-test-'));
  const app = await buildApp({ ...testEnv(dataDir), apiToken: 'owner-token' }, false);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/drive/v3/files/file-1?fields=')) {
      return new Response(JSON.stringify({
        id: 'file-1',
        name: 'Smartware Spec v2.pdf',
        mimeType: 'application/pdf',
        modifiedTime: '2026-05-08T00:00:00.000Z',
        webViewLink: 'https://drive.google.com/file/d/file-1/view',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected fetch ${url}`);
  }) as typeof fetch;

  try {
    const configured = await app.inject({
      method: 'POST',
      url: '/integrations/google-drive/configure',
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        client_id: 'google-client-id.apps.googleusercontent.com',
        client_secret: 'google-client-secret',
      },
    });
    assert.equal(configured.statusCode, 200);

    // Real flow: initiate auth-url first so the Pod has a state it expects
    // back. The hardened callback (CP-SEC-003) requires this match.
    const authUrl = await app.inject({
      method: 'GET',
      url: '/integrations/google-drive/auth-url?actor_id=person-local',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(authUrl.statusCode, 200);
    const stateParam = new URL(authUrl.json().url).searchParams.get('state');
    assert.ok(stateParam, 'auth-url must return a state token');

    const callback = await app.inject({
      method: 'GET',
      url: `/integrations/google-drive/callback?code=test-code&state=${encodeURIComponent(stateParam!)}`,
    });
    assert.equal(callback.statusCode, 200);

    const imported = await app.inject({
      method: 'POST',
      url: '/integrations/google-drive/import',
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        actor_id: 'person-local',
        file_ids: ['file-1'],
      },
    });
    assert.equal(imported.statusCode, 200);
    assert.equal(imported.json().count, 1);
    assert.equal(imported.json().imported[0].object.id, 'google-drive:file-1');

    const activity = await app.inject({
      method: 'GET',
      url: '/pod/activity?scope_alias=app%3Agoogle-drive&actor_id=google-drive:connector&include_sensitive=true',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(activity.statusCode, 200);
    assert.equal(activity.json().events[0].actor_id, 'google-drive:connector');
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
    await closeSmartwareCore();
  }
});

test('Integrations list reports implemented connection paths as beta-ready', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-integrations-test-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const res = await app.inject({ method: 'GET', url: '/integrations' });
    assert.equal(res.statusCode, 200);
    const integrations = res.json().integrations as Array<{
      id: string;
      availability: 'ready' | 'config_only' | 'coming_soon';
      testing_note?: string;
      products?: string[];
    }>;

    const byId = new Map(integrations.map((integration) => [integration.id, integration]));
    assert.equal(byId.has('coffee'), false, 'Coffee is not an advertised Pod integration yet');
    assert.equal(byId.get('local-folders')?.availability, 'ready');
    assert.deepEqual(byId.get('local-folders')?.products, ['Files', 'Obsidian', 'Notion', 'Evernote', 'Apple Notes', 'ChatGPT', 'Claude']);
    assert.equal(byId.get('google-drive')?.availability, 'ready');
    assert.equal(byId.get('openai')?.availability, 'ready');
    assert.equal(byId.get('anthropic')?.availability, 'ready');
    assert.equal(byId.get('github')?.availability, 'ready');
    assert.equal(byId.get('slack')?.availability, 'ready');
    for (const betaIntegration of [
      'microsoft-365', 'dropbox', 'box', 'asana', 'clickup', 'monday',
      'perplexity', 'canva', 'airtable', 'miro', 'atlassian', 'hubspot',
      'salesforce', 'attio', 'clay',
    ]) {
      assert.equal(byId.get(betaIntegration)?.availability, 'ready', `${betaIntegration} should be actionable in beta`);
    }
    assert.deepEqual(byId.get('atlassian')?.products, ['Jira', 'Confluence', 'Trello']);
    assert.deepEqual(byId.get('microsoft-365')?.products, ['Outlook', 'OneDrive', 'SharePoint', 'Teams']);
    // "Drive import" → now "picker-based folder selection and folder-scoped import" after the Picker migration.
    assert.ok(byId.get('google-drive')?.testing_note?.includes('import'));
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('/pod/query returns structured sources and steps for selected context', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-query-context-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const object = await app.inject({
      method: 'POST',
      url: '/pod/objects',
      payload: {
        actor_id: 'person-local',
        id: 'selected-roadmap-doc',
        collection_id: 'inbox',
        kind: 'doc',
        title: 'Selected Roadmap Doc',
        content: {
          text: 'Roadmap details: Graph selection should scope Ask Pod to selected relationships.',
        },
        source: { app: 'test' },
      },
    });
    assert.equal(object.statusCode, 200);

    const query = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'workspace',
        query: 'What is relevant about this selected doc?',
        include_observations: true,
        include_external_mcp: false,
        use_llm: false,
        context: {
          kind: 'map_selection',
          node_ids: ['obj:selected-roadmap-doc', 'sw:graph-selection'],
          labels: ['Selected Roadmap Doc', 'Graph selection'],
          edges: [{ id: 'edge:selected', source: 'obj:selected-roadmap-doc', target: 'sw:graph-selection', label: 'mentions' }],
        },
      },
    });
    assert.equal(query.statusCode, 200);
    const body = query.json() as {
      results: unknown[];
      observations: unknown[];
      sources: Array<{ marker: string; type: string; object_id?: string; title: string }>;
      citations: unknown[];
      steps: Array<{ id: string; status: string; count?: number }>;
    };
    assert.ok(Array.isArray(body.results));
    assert.ok(Array.isArray(body.observations));
    assert.ok(body.sources.some((source) => source.type === 'object' && source.object_id === 'selected-roadmap-doc' && source.title === 'Selected Roadmap Doc'));
    assert.equal(body.sources[0]?.marker, 'S1');
    assert.deepEqual(body.citations, []);
    assert.ok(body.steps.some((step) => step.id === 'context' && step.status === 'done'));
    assert.ok(body.steps.some((step) => step.id === 'memory' && step.status === 'done'));
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('/pod/query answers conflict-status questions without generic retrieval noise', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-conflict-query-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const query = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: 'person-local',
        scope: 'all',
        query: 'Are there any conflicting memories?',
        include_observations: true,
        include_external_mcp: true,
        use_llm: true,
      },
    });

    assert.equal(query.statusCode, 200);
    const body = query.json();
    assert.equal(
      body.answer,
      'I found no confirmed conflicting memories in the selected scope. Duplicate source views and corroborating evidence are not counted as conflicts.',
    );
    assert.equal(body.answer_mode, 'conflict');
    assert.equal(body.answer_status, 'ok');
    assert.deepEqual(body.conflicts, []);
    assert.deepEqual(body.sources, []);
    assert.deepEqual(body.experts, []);
    assert.deepEqual(body.conversations, []);
    assert.deepEqual(body.steps.map((step: { id: string }) => step.id), ['conflicts', 'answer']);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('/pod/query returns the matching claim instead of an unrelated high-confidence sibling', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-claim-query-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const observed = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'workspace',
        type: 'decision',
        content: 'Deadline: 2026-08-01. API endpoint: https://zephyr.example.test/v2',
        source_id: 'claim-granularity-fixture',
      },
    });
    assert.equal(observed.statusCode, 200);

    const compiled = await app.inject({
      method: 'POST',
      url: '/pod/compile',
      payload: { actor_id: 'person-local', operation_id: operationId(), scope_alias: 'workspace', use_llm: false },
    });
    assert.equal(compiled.statusCode, 200);

    const core = await getSmartwareCore(testEnv(dataDir));
    const profile = core.createPodProfile('founder-test', 'Founder Test Pod');
    const owner = { type: 'person' as const, id: core.getConfig().owner_id, display_name: 'Owner' };
    const graph = core.readKnowledgeGraph({ actor: owner, scopes: [profile.scopes.workspace] });
    const deadlineClaim = graph.claims.find((claim) => claim.predicate === 'deadline_is');
    const urlClaim = graph.claims.find((claim) =>
      claim.predicate === 'related_to' && String(claim.object.value).includes('zephyr'));
    assert.ok(deadlineClaim);
    assert.ok(urlClaim);

    const deadlineVersion = readLatestClaimVersion(dataDir, deadlineClaim.claim_id)?.version;
    assert.ok(deadlineVersion);
    await core.revise({
      actor: owner,
      target: deadlineClaim.claim_id,
      expected_base_version: deadlineVersion,
      set_confidence: 'high',
      reason: 'Make the unrelated sibling more confident than the matching claim',
      operation_id: 'op_QRYG000000000000000000001A',
    });

    const queried = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: 'person-local',
        scope_alias: 'workspace',
        query: 'zephyr',
        include_observations: false,
        use_llm: false,
      },
    });
    assert.equal(queried.statusCode, 200);
    const queryBody = queried.json();
    assert.equal(queryBody.results[0]?.claim?.id, urlClaim.claim_id);
    const claimSource = queryBody.sources.find((source: { claim_id?: string }) => source.claim_id === urlClaim.claim_id);
    assert.equal(claimSource?.id, `claim:${urlClaim.claim_id}`);
    assert.ok(claimSource?.observation_ids.includes(observed.json().id));
    assert.deepEqual(claimSource?.resolver, { method: 'POST', path: '/pod/explain' });
    const explained = await app.inject({
      method: 'POST',
      url: claimSource.resolver.path,
      payload: { actor_id: 'person-local', claim_id: claimSource.claim_id },
    });
    assert.equal(explained.statusCode, 200);
    assert.equal(explained.json().claim.claim_id, urlClaim.claim_id);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('Connected OpenAI keys power Ask Pod answers and reflection compile', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-openai-ai-test-'));
  const app = await buildApp(testEnv(dataDir), false);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes('api.openai.com/v1/chat/completions')) {
      throw new Error(`Unexpected fetch ${url}`);
    }

    const body = JSON.parse(String(init?.body ?? '{}')) as {
      model?: string;
      messages?: Array<{ content?: string }>;
    };
    const prompt = (body.messages ?? [])
      .map(message => typeof message.content === 'string' ? message.content : '')
      .join('\n');

    let content = '';
    if (prompt.includes('User question:')) {
      const observationMarker = prompt.match(/\[(S\d+)\][^\n]*\(observation,/)?.[1];
      assert.ok(observationMarker);
      content = `Pod is a user-owned memory companion for Coffee and third-party apps. [${observationMarker}]`;
    } else if (prompt.includes('Extract claims from the following content')) {
      content = JSON.stringify([
        {
          subject_name: 'Pod',
          subject_type: 'project',
          predicate: 'description_is',
          object: { type: 'text', value: 'A user-owned memory companion for Coffee and third-party apps.' },
          scope: 'pod/founder-test/workspace',
          validity: { from: '2026-05-14T00:00:00.000Z', to: null },
          epistemic: 'observed',
          confidence: 0.9,
          sensitive: false,
        },
      ]);
    } else if (prompt.includes('Synthesise the following claims about "Pod"')) {
      content = JSON.stringify({
        oneliner: 'Pod is a user-owned memory companion.',
        paragraph: 'Pod is a user-owned memory companion for Coffee and third-party apps.',
        fullPage: '## Pod\n\nPod is a user-owned memory companion for Coffee and third-party apps.',
      });
    } else {
      throw new Error(`Unexpected OpenAI prompt ${prompt}`);
    }

    return new Response(JSON.stringify({
      choices: [{ message: { content } }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const configured = await app.inject({
      method: 'POST',
      url: '/integrations/openai/configure',
      payload: { api_key: 'sk-openai-test' },
    });
    assert.equal(configured.statusCode, 200);
    assert.equal(configured.json().ai_default, true);

    const memoryDefaults = await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.memory_defaults',
      payload: { values: { default_use_llm: true } },
    });
    assert.equal(memoryDefaults.statusCode, 200, memoryDefaults.payload);

    const status = await app.inject({ method: 'GET', url: '/integrations/openai/status' });
    assert.equal(status.statusCode, 200);
    assert.equal(status.json().ai_default, true);

    const observed = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'workspace',
        type: 'decision',
        content: 'Pod is the user-owned memory companion for Coffee and third-party apps.',
        source_id: 'openai-ai-smoke',
      },
    });
    assert.equal(observed.statusCode, 200);

    const query = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: 'person-local',
        scope_alias: 'workspace',
        query: 'memory companion',
        include_observations: true,
        use_llm: true,
        model_mode: 'fast',
      },
    });
    assert.equal(query.statusCode, 200);
    assert.equal(query.json().answer_provider, 'openai');
    assert.equal(query.json().answer_model, 'gpt-4.1-mini');
    assert.match(query.json().answer, /user-owned memory companion/i);
    assert.match(query.json().citations[0]?.marker ?? '', /^S\d+$/);
    assert.match(query.json().citations[0]?.id ?? '', /^observation:/);
    assert.equal(query.json().citations[0]?.source_app, 'coffee-pod');
    assert.equal(query.json().citations[0]?.source_id, 'openai-ai-smoke');
    const resolvedEvidence = await app.inject({
      method: 'GET',
      url: query.json().citations[0].resolver.path,
    });
    assert.equal(resolvedEvidence.statusCode, 200);
    assert.equal(resolvedEvidence.json().evidence.id, query.json().citations[0].observation_id);
    assert.equal(resolvedEvidence.json().evidence.source_id, 'openai-ai-smoke');
    assert.match(String(resolvedEvidence.json().evidence.content), /memory companion/i);

    const compile = await app.inject({
      method: 'POST',
      url: '/pod/compile',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'workspace',
      },
    });
    assert.equal(compile.statusCode, 200, compile.payload);
    assert.ok(compile.json().pages_compiled >= 1);

    const smartwareConfig = JSON.parse(await readFile(path.join(dataDir, 'config.json'), 'utf8')) as {
      llm: { provider: string; model: string };
    };
    assert.equal(smartwareConfig.llm.provider, 'openai');
    assert.equal(smartwareConfig.llm.model, 'gpt-4.1');
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
    await closeSmartwareCore();
  }
});
