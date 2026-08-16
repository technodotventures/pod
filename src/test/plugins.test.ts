import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildApp } from '../app.js';
import {
  AGENT_PLUGIN_SCHEMA_URI,
} from '../capabilities/plugin-package.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeDb } from '../pod/db.js';
import { closeSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'plugins-test',
    podName: 'Plugins Test Pod',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

function packageFiles(version: string, suffix = '') {
  return {
    'plugin.json': JSON.stringify({
      $schema: AGENT_PLUGIN_SCHEMA_URI,
      name: 'portable.review',
      version,
      description: 'Portable review capabilities.',
      author: { name: 'Coffee' },
    }),
    'skills/review/SKILL.md': `---\nname: review\ndescription: Review a change.\n---\n\nReview carefully.${suffix}\n`,
  };
}

test('Agent Plugin revisions move from Capability Inbox to Library without flattening nested Skills', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-plugins-'));
  const app = await buildApp(testEnv(dataDir), false);
  try {
    const first = await app.inject({
      method: 'POST',
      url: '/pod/plugins',
      payload: { actor_id: 'person-local', source: 'local', source_ref: 'portable.review', files: packageFiles('1.0.0') },
    });
    assert.equal(first.statusCode, 200, first.payload);
    const plugin = first.json().plugin;
    assert.equal(plugin.kind, 'plugin');
    assert.equal(plugin.pending_revision.status, 'draft');
    assert.equal(plugin.pending_revision.components[0].component_type, 'skill');

    const duplicate = await app.inject({
      method: 'POST',
      url: '/pod/plugins',
      payload: { actor_id: 'person-local', source: 'local', source_ref: 'portable.review', files: packageFiles('1.0.0') },
    });
    assert.equal(duplicate.statusCode, 200, duplicate.payload);
    assert.equal(duplicate.json().plugin.id, plugin.id);
    assert.equal(duplicate.json().revision_created, false);

    const approve = await app.inject({
      method: 'POST',
      url: `/pod/plugins/${encodeURIComponent(plugin.id)}/revisions/${encodeURIComponent(plugin.pending_revision.id)}/approve`,
      payload: { actor_id: 'person-local' },
    });
    assert.equal(approve.statusCode, 200, approve.payload);
    assert.equal(approve.json().plugin.status, 'approved');
    assert.equal(approve.json().plugin.current_revision.version, '1.0.0');

    const changed = await app.inject({
      method: 'POST',
      url: '/pod/plugins',
      payload: { actor_id: 'person-local', source: 'local', source_ref: 'portable.review', files: packageFiles('1.1.0', ' Updated.') },
    });
    assert.equal(changed.statusCode, 200, changed.payload);
    assert.equal(changed.json().plugin.version, '1.0.0', 'draft revisions must not replace the approved version');
    assert.equal(changed.json().plugin.pending_revision.version, '1.1.0');
    assert.equal(changed.json().plugin.revision_count, 2);

    const skills = await app.inject({ method: 'GET', url: '/pod/skills' });
    assert.equal(skills.statusCode, 200);
    assert.equal(skills.json().skills.length, 0, 'nested Plugin Skills remain part of their Plugin revision');
  } finally {
    await app.close();
    await closeSmartwareCore();
    closeDb();
  }
});
