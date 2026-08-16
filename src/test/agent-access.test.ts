import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { agentAllowedScopeNames } from '../pod/agent-access.js';
import { ensureAppDataSpace } from '../pod/data-spaces.js';
import { closeDb } from '../pod/db.js';
import { closeSmartwareCore, getSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'agent-access-test',
    podName: 'Agent Access Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

let operationSequence = 0;
function operationId(): string {
  operationSequence += 1;
  return `op_${String(operationSequence).padStart(26, '0')}`;
}

test('legacy scoped agents keep their former Personal default', () => {
  assert.deepEqual(agentAllowedScopeNames({
    id: 'agent:legacy',
    status: 'active',
    access_mode: 'scoped',
    scopes: null,
  }, 'read'), ['personal']);
});

test('agent access presets enforce reads and writes even when the Pod is open', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-agent-access-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);
  ensureAppDataSpace(await getSmartwareCore(env), env, 'coffee');

  try {
    const catalog = await app.inject({ method: 'GET', url: '/pod/registry/agents' });
    assert.equal(catalog.statusCode, 200);
    assert.deepEqual(
      catalog.json().data_spaces.map((space: { id: string }) => space.id),
      ['personal', 'workspace', 'app:coffee'],
    );
    const categoryScope = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:category-test',
        name: 'Category Test',
        access_mode: 'scoped',
        scopes: ['meetings'],
      },
    });
    assert.equal(categoryScope.statusCode, 400);

    const created = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:hermes-test',
        name: 'Hermes Test',
        access_mode: 'none',
        scopes: [],
      },
    });
    assert.equal(created.statusCode, 200);
    assert.equal(created.json().agent.access_mode, 'none');
    const token = created.json().agent.auth_token as string;
    const agentHeaders = { authorization: `Bearer ${token}` };

    const noContext = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: agentHeaders,
      payload: { query: 'anything' },
    });
    assert.equal(noContext.statusCode, 403);

    const noQuery = await app.inject({
      method: 'POST',
      url: '/pod/query',
      headers: agentHeaders,
      payload: { actor_id: 'agent:hermes-test', query: 'anything', scope_alias: 'personal' },
    });
    assert.equal(noQuery.statusCode, 403);

    const noWrite = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      headers: agentHeaders,
      payload: {
        actor_id: 'agent:hermes-test',
        operation_id: operationId(),
        scope_alias: 'personal',
        content: 'This must not be written.',
      },
    });
    assert.equal(noWrite.statusCode, 403);

    const noRawLibraryBypass = await app.inject({
      method: 'GET',
      url: '/pod/objects',
      headers: agentHeaders,
    });
    assert.equal(noRawLibraryBypass.statusCode, 403);

    const noRegistryBypass = await app.inject({
      method: 'GET',
      url: '/pod/registry/agents',
      headers: agentHeaders,
    });
    assert.equal(noRegistryBypass.statusCode, 403);

    const noApprovalsBypass = await app.inject({
      method: 'GET',
      url: '/pod/approvals',
      headers: agentHeaders,
    });
    assert.equal(noApprovalsBypass.statusCode, 403);

    const capture = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:hermes-test',
        name: 'Hermes Test',
        access_mode: 'capture_only',
        scopes: ['app:coffee'],
      },
    });
    assert.equal(capture.statusCode, 200);
    assert.deepEqual(capture.json().agent.scopes, ['app:coffee']);

    const captureCannotRead = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: agentHeaders,
      payload: { query: 'meeting' },
    });
    assert.equal(captureCannotRead.statusCode, 403);

    const captureWrongArea = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      headers: agentHeaders,
      payload: {
        actor_id: 'agent:hermes-test',
        operation_id: operationId(),
        scope_alias: 'workspace',
        content: 'Wrong area.',
      },
    });
    assert.equal(captureWrongArea.statusCode, 403);

    const captureDefaultArea = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      headers: agentHeaders,
      payload: {
        actor_id: 'agent:hermes-test',
        operation_id: operationId(),
        content: 'Founder meeting follow-up is Friday.',
      },
    });
    assert.equal(captureDefaultArea.statusCode, 200);

    const scoped = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:hermes-test',
        name: 'Hermes Test',
        access_mode: 'scoped',
        scopes: ['app:coffee'],
      },
    });
    assert.equal(scoped.statusCode, 200);

    const meetingContext = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: agentHeaders,
      payload: { query: 'founder', scope: 'app:coffee' },
    });
    assert.equal(meetingContext.statusCode, 200);
    assert.deepEqual(meetingContext.json().scopes_read, ['app:coffee']);

    const workspaceContext = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: agentHeaders,
      payload: { query: 'founder', scope: 'workspace' },
    });
    assert.equal(workspaceContext.statusCode, 403);

    const workspaceQuery = await app.inject({
      method: 'POST',
      url: '/pod/query',
      headers: agentHeaders,
      payload: { actor_id: 'agent:hermes-test', query: 'founder', scope_alias: 'workspace' },
    });
    assert.equal(workspaceQuery.statusCode, 403);

    const all = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:hermes-test',
        name: 'Hermes Test',
        access_mode: 'all',
        scopes: ['app:coffee'],
      },
    });
    assert.equal(all.statusCode, 200);
    assert.deepEqual(all.json().agent.scopes, []);

    const allContext = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: agentHeaders,
      payload: { query: 'founder', scope: ['personal', 'workspace'] },
    });
    assert.equal(allContext.statusCode, 200);
    assert.deepEqual(allContext.json().scopes_read, ['personal', 'workspace']);

    const disabled = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:hermes-test',
        name: 'Hermes Test',
        access_mode: 'all',
        status: 'disabled',
      },
    });
    assert.equal(disabled.statusCode, 200);

    const disabledRequest = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: agentHeaders,
      payload: { query: 'founder' },
    });
    assert.equal(disabledRequest.statusCode, 403);
    assert.equal(disabledRequest.json().error, 'agent_disabled');
  } finally {
    await app.close();
    await closeSmartwareCore();
    closeDb();
  }
});
