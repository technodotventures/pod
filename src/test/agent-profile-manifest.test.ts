import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createConnectionGrant } from '@smartware/connectors';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import {
  closeDb,
  getDb,
  replaceSkillBindings,
  upsertSkill,
} from '../pod/db.js';
import { AGENT_PROFILE_TARGETS } from '../services/agent-profile-manifest.js';
import { closeSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 8732,
    dataDir,
    ownerId: undefined,
    podId: 'portable-profile-test',
    podName: 'Portable Profile Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('portable profile manifests preserve behaviour and authority without exporting secrets', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-agent-profile-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);

  try {
    const created = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:kimi-code',
        name: 'Kimi Researcher',
        description: 'Researches technical questions with cited sources.',
        model: 'kimi-for-coding',
        persona: 'Be curious, concise, and explicit about uncertainty.',
        access_mode: 'scoped',
        scopes: ['personal'],
        context_budget: 1800,
      },
    });
    assert.equal(created.statusCode, 200, created.payload);
    const token = created.json().agent.auth_token as string;

    const db = getDb(env);
    const skill = upsertSkill(db, {
      name: 'Source Review',
      description: 'Checks primary sources before answering.',
      version: '1.2.0',
      source: 'github',
      source_slug: 'coffee/source-review',
      status: 'installed',
      permissions: ['read:web', 'read:memory'],
      portability: 'exportable',
      trust_level: 'high',
    });
    replaceSkillBindings(db, skill.id, ['agent:kimi-code'], 'active');
    createConnectionGrant(db, {
      actor_id: 'agent:kimi-code',
      service_id: 'github',
      tool_pattern: 'search_*',
      created_by: 'owner',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/pod/registry/agents/agent%3Akimi-code/profile-manifest',
    });
    assert.equal(response.statusCode, 200, response.payload);
    const body = response.json();
    assert.equal(body.manifest.format, 'coffee-pod-agent-profile/v1');
    assert.equal(body.manifest.profile.id, 'agent:kimi-code');
    assert.equal(body.manifest.profile.persona, 'Be curious, concise, and explicit about uncertainty.');
    assert.deepEqual(body.manifest.context.read_scopes, ['personal']);
    assert.deepEqual(body.manifest.context.write_scopes, ['personal']);
    assert.equal(body.manifest.context.token_budget, 1800);
    assert.deepEqual(body.manifest.capabilities.skills.map((item: { name: string }) => item.name), ['Source Review']);
    assert.deepEqual(body.manifest.capabilities.connection_grants, [{
      service_id: 'github',
      tool_pattern: 'search_*',
      expires_at: null,
      status: 'active',
    }]);
    assert.deepEqual(body.manifest.compatibility.targets, AGENT_PROFILE_TARGETS);
    assert.equal(body.manifest.pod_connection.authentication.exportable, false);
    assert.equal(body.integrity.algorithm, 'sha256');
    assert.match(body.integrity.digest, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(response.payload, new RegExp(token));

    for (const target of AGENT_PROFILE_TARGETS) {
      const preview = await app.inject({
        method: 'GET',
        url: `/pod/registry/agents/agent%3Akimi-code/profile-materializations/${target}`,
      });
      assert.equal(preview.statusCode, 200, `${target}: ${preview.payload}`);
      assert.equal(preview.json().materialization.target, target);
      assert.equal(preview.json().materialization.writes_state, false);
      assert.doesNotMatch(preview.payload, new RegExp(token));
    }

    const kimiPreview = await app.inject({
      method: 'GET',
      url: '/pod/registry/agents/agent%3Akimi-code/profile-materializations/kimi-code',
    });
    const kimiMcpFile = kimiPreview.json().materialization.files.find(
      (file: { purpose: string }) => file.purpose === 'mcp',
    );
    assert.equal(kimiMcpFile.path, '$KIMI_CODE_HOME/mcp.json');
    assert.equal(
      kimiMcpFile.content.mcpServers['coffee-pod'].bearerTokenEnvVar,
      'COFFEE_POD_AGENT_TOKEN',
    );

    const unknown = await app.inject({
      method: 'GET',
      url: '/pod/registry/agents/agent%3Akimi-code/profile-materializations/unknown',
    });
    assert.equal(unknown.statusCode, 404);
    assert.equal(unknown.json().error, 'target_not_found');
  } finally {
    await app.close();
    await closeSmartwareCore();
    closeDb();
  }
});
