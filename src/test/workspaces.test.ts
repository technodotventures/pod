import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'workspace-test',
    podName: 'Workspace Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('workspaces persist and isolate library objects, collections, and activity', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-workspaces-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const initial = await app.inject({ method: 'GET', url: '/pod/workspaces' });
    assert.equal(initial.statusCode, 200);
    assert.equal(initial.json().workspaces.length, 1);
    assert.equal(initial.json().workspaces[0].id, 'default');
    assert.equal(initial.json().workspaces[0].is_default, true);

    const created = await app.inject({
      method: 'POST',
      url: '/pod/workspaces',
      payload: { name: 'Client work', emoji: '🧭' },
    });
    assert.equal(created.statusCode, 201, created.payload);
    const workspaceId = created.json().workspace.id as string;
    assert.match(created.json().workspace.scope, new RegExp(`/workspaces/${workspaceId}$`));

    const workspaceHeaders = { 'x-pod-workspace-id': workspaceId };
    const createFolder = await app.inject({
      method: 'POST',
      url: '/pod/collections',
      headers: workspaceHeaders,
      payload: { actor_id: 'person-local', name: 'Roadmap' },
    });
    assert.equal(createFolder.statusCode, 200, createFolder.payload);
    const collectionId = createFolder.json().collection.id as string;

    const createObject = await app.inject({
      method: 'POST',
      url: '/pod/objects',
      headers: workspaceHeaders,
      payload: {
        actor_id: 'person-local',
        collection_id: collectionId,
        kind: 'document',
        title: 'Workspace-only plan',
        content: { text: 'Only visible inside Client work.' },
      },
    });
    assert.equal(createObject.statusCode, 200, createObject.payload);
    const objectId = createObject.json().object.id as string;

    const selectedObjects = await app.inject({
      method: 'GET',
      url: '/pod/objects',
      headers: workspaceHeaders,
    });
    assert.equal(selectedObjects.json().objects.some((object: { title: string }) => object.title === 'Workspace-only plan'), true);

    const defaultObjects = await app.inject({ method: 'GET', url: '/pod/objects' });
    assert.equal(defaultObjects.json().objects.some((object: { title: string }) => object.title === 'Workspace-only plan'), false);

    const defaultObjectById = await app.inject({
      method: 'GET',
      url: `/pod/objects/${objectId}`,
    });
    assert.equal(defaultObjectById.statusCode, 404);

    const defaultVaultById = await app.inject({
      method: 'GET',
      url: `/pod/objects/${objectId}/vault`,
    });
    assert.equal(defaultVaultById.statusCode, 404);

    const selectedCollections = await app.inject({
      method: 'GET',
      url: '/pod/collections',
      headers: workspaceHeaders,
    });
    assert.equal(selectedCollections.json().collections.some((collection: { id: string }) => collection.id === collectionId), true);

    const defaultCollections = await app.inject({ method: 'GET', url: '/pod/collections' });
    assert.equal(defaultCollections.json().collections.some((collection: { id: string }) => collection.id === collectionId), false);

    const cannotDeleteContent = await app.inject({
      method: 'DELETE',
      url: `/pod/workspaces/${workspaceId}`,
    });
    assert.equal(cannotDeleteContent.statusCode, 409);
    assert.equal(cannotDeleteContent.json().error, 'workspace_not_empty');

    const renamed = await app.inject({
      method: 'PATCH',
      url: `/pod/workspaces/${workspaceId}`,
      payload: { name: 'Client delivery', emoji: '🚀' },
    });
    assert.equal(renamed.statusCode, 200);
    assert.equal(renamed.json().workspace.name, 'Client delivery');
    assert.equal(renamed.json().workspace.emoji, '🚀');

    const empty = await app.inject({
      method: 'POST',
      url: '/pod/workspaces',
      payload: { name: 'Temporary' },
    });
    assert.equal(empty.json().workspace.emoji, '📁');
    const emptyId = empty.json().workspace.id as string;
    const deleted = await app.inject({ method: 'DELETE', url: `/pod/workspaces/${emptyId}` });
    assert.equal(deleted.statusCode, 200);
    assert.equal(deleted.json().deleted, true);

    const staleSelection = await app.inject({
      method: 'GET',
      url: '/pod/objects',
      headers: { 'x-pod-workspace-id': emptyId },
    });
    assert.equal(staleSelection.statusCode, 404);
    assert.equal(staleSelection.json().error, 'workspace_not_found');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});
