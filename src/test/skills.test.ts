import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { saveConfig, writeRegistryMarkdown } from 'smartware';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeDb, getDb, upsertSkill } from '../pod/db.js';
import { extractJsonArrayField } from '../routes/skills.js';
import { closeSmartwareCore, getSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'skills-test',
    podName: 'Skills Test Pod',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('skills.sh catalog extraction preserves nested arrays and brackets inside strings', () => {
  const payload = '0:{"initialSkills":[{"name":"alpha ] skill","weeklyInstalls":[3,2,1]},{"name":"beta","tags":["a","b"]}],"next":"value"}';
  assert.deepEqual(extractJsonArrayField(payload, 'initialSkills'), [
    { name: 'alpha ] skill', weeklyInstalls: [3, 2, 1] },
    { name: 'beta', tags: ['a', 'b'] },
  ]);
});

test('registry skill registration is idempotent and agent grants follow managed bindings', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-skills-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    for (const agent of [
      { id: 'agent:claude-code', name: 'Claude Code' },
      { id: 'agent:codex', name: 'Codex' },
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/pod/registry/agents',
        payload: agent,
      });
      assert.equal(response.statusCode, 200);
    }

    const register = (agentIds: string[]) => app.inject({
      method: 'POST',
      url: '/pod/skills',
      payload: {
        actor_id: 'person-local',
        name: 'Code Review',
        description: 'Reviews a change before merge.',
        version: '1.0.0',
        author: 'community',
        source: 'skills.sh',
        source_slug: 'community/code-review',
        scope: 'workspace',
        permissions: ['read:code', 'write:comments'],
        agent_ids: agentIds,
        portability: 'local',
      },
    });

    const first = await register(['agent:claude-code']);
    assert.equal(first.statusCode, 200);
    const firstSkill = first.json().skill;
    assert.equal(firstSkill.status, 'review');
    assert.equal(firstSkill.pending_revision.status, 'draft');
    assert.equal(firstSkill.pending_revision.revision_number, 1);
    assert.equal(firstSkill.revision_count, 1);

    const second = await register(['agent:claude-code', 'agent:codex']);
    assert.equal(second.statusCode, 200);
    const secondSkill = second.json().skill;
    assert.equal(secondSkill.id, firstSkill.id);
    assert.deepEqual(secondSkill.equipped_to, ['agent:claude-code', 'agent:codex']);
    assert.equal(second.json().revision_created, false);
    assert.equal(secondSkill.revision_count, 1);

    const listed = await app.inject({ method: 'GET', url: '/pod/skills' });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.json().skills.length, 1);

    const approved = await app.inject({
      method: 'POST',
      url: `/pod/skills/${encodeURIComponent(firstSkill.id)}/approve`,
      payload: { actor_id: 'person-local' },
    });
    assert.equal(approved.statusCode, 200, approved.payload);
    assert.equal(approved.json().skill.status, 'installed');
    assert.equal(approved.json().skill.current_revision.status, 'approved');
    assert.equal(approved.json().skill.pending_revision, null);
    assert.deepEqual(
      approved.json().skill.agent_bindings.map((binding: { agent_id: string; status: string }) => [binding.agent_id, binding.status]),
      [['agent:claude-code', 'active'], ['agent:codex', 'active']],
    );

    const initialGrantIds = new Map<string, string>(
      approved.json().skill.agent_bindings.map((binding: { agent_id: string; grant_id: string }) => [binding.agent_id, binding.grant_id]),
    );
    const initialConfig = JSON.parse(await readFile(path.join(dataDir, 'config.json'), 'utf-8'));
    for (const [agentId, grantId] of initialGrantIds) {
      const grant = initialConfig.grants.find((candidate: { id: string }) => candidate.id === grantId);
      assert.equal(grant?.actor_id, agentId);
      assert.equal(grant?.status, 'active');
    }

    const updateDraft = await app.inject({
      method: 'POST',
      url: '/pod/skills',
      payload: {
        actor_id: 'person-local',
        name: 'Code Review',
        description: 'Reviews a change and checks regressions before merge.',
        version: '1.1.0',
        author: 'community',
        source: 'skills.sh',
        source_slug: 'community/code-review',
        scope: 'workspace',
        permissions: ['read:code', 'write:comments'],
        agent_ids: ['agent:claude-code', 'agent:codex'],
        content: '# Code Review\n\nCheck correctness and regressions.\n',
      },
    });
    assert.equal(updateDraft.statusCode, 200, updateDraft.payload);
    assert.equal(updateDraft.json().created, false);
    assert.equal(updateDraft.json().revision_created, true);
    assert.equal(updateDraft.json().skill.version, '1.0.0', 'draft version must not replace the approved version');
    assert.equal(updateDraft.json().skill.pending_revision.version, '1.1.0');
    assert.equal(updateDraft.json().skill.revision_count, 2);

    const approveUpdate = await app.inject({
      method: 'POST',
      url: `/pod/skills/${encodeURIComponent(firstSkill.id)}/approve`,
      payload: { actor_id: 'person-local' },
    });
    assert.equal(approveUpdate.statusCode, 200, approveUpdate.payload);
    assert.equal(approveUpdate.json().skill.version, '1.1.0');
    assert.equal(approveUpdate.json().skill.current_revision.version, '1.1.0');
    assert.equal(approveUpdate.json().skill.revisions[1].status, 'superseded');

    const reassigned = await app.inject({
      method: 'PUT',
      url: `/pod/skills/${encodeURIComponent(firstSkill.id)}/agents`,
      payload: { actor_id: 'person-local', agent_ids: ['agent:codex'] },
    });
    assert.equal(reassigned.statusCode, 200, reassigned.payload);
    assert.deepEqual(reassigned.json().skill.equipped_to, ['agent:codex']);

    const reassignedConfig = JSON.parse(await readFile(path.join(dataDir, 'config.json'), 'utf-8'));
    assert.equal(
      reassignedConfig.grants.find((grant: { id: string }) => grant.id === initialGrantIds.get('agent:claude-code'))?.status,
      'revoked',
    );
    assert.equal(
      reassignedConfig.grants.find((grant: { id: string }) => grant.id === initialGrantIds.get('agent:codex'))?.status,
      'active',
    );

    const disabled = await app.inject({
      method: 'POST',
      url: `/pod/skills/${encodeURIComponent(firstSkill.id)}/disable`,
      payload: { actor_id: 'person-local' },
    });
    assert.equal(disabled.statusCode, 200, disabled.payload);
    assert.equal(disabled.json().skill.status, 'disabled');
    assert.equal(disabled.json().skill.agent_bindings[0].status, 'disabled');

    const reenabled = await app.inject({
      method: 'POST',
      url: `/pod/skills/${encodeURIComponent(firstSkill.id)}/approve`,
      payload: { actor_id: 'person-local' },
    });
    assert.equal(reenabled.statusCode, 200, reenabled.payload);
    assert.equal(reenabled.json().skill.agent_bindings[0].status, 'active');
    assert.notEqual(reenabled.json().skill.agent_bindings[0].grant_id, initialGrantIds.get('agent:codex'));

    const content = await app.inject({
      method: 'GET',
      url: `/pod/skills/${encodeURIComponent(firstSkill.id)}/content`,
    });
    assert.equal(content.statusCode, 200, content.payload);
    assert.equal(content.json().content, '# Code Review\n\nCheck correctness and regressions.\n');
    assert.equal(content.json().directory, 'Pod Library · revision 2');
    assert.equal(
      content.json().revision_id,
      approveUpdate.json().skill.current_revision.id,
      'canonical content must come from the approved revision, not a guessed local agent directory',
    );

    // Legacy releases assigned one shared person grant to multiple skills.
    // Retiring the first record must not revoke the grant from the second.
    const sharedGrantId = 'grant_legacy_shared';
    const core = await getSmartwareCore(testEnv(dataDir));
    const config = core.getConfig();
    config.grants.push({
      id: sharedGrantId,
      actor_type: 'person',
      actor_id: 'person-local',
      capabilities: {
        observe: ['workspace/default'], query: ['workspace/default'], compile: ['workspace/default'],
        correct: ['workspace/default'], forget: [], read: ['workspace/default'],
      },
      trusted: true,
      quarantine: false,
      created_at: new Date().toISOString(),
      expires_at: null,
      status: 'active',
    });
    saveConfig(core.dataDir, config);
    writeRegistryMarkdown(core.dataDir, config);

    const db = getDb(testEnv(dataDir));
    const legacyOne = upsertSkill(db, { name: 'Legacy One', status: 'installed', grant_id: sharedGrantId });
    const legacyTwo = upsertSkill(db, { name: 'Legacy Two', status: 'installed', grant_id: sharedGrantId });

    const disableLegacyOne = await app.inject({
      method: 'POST',
      url: `/pod/skills/${encodeURIComponent(legacyOne.id)}/disable`,
      payload: { actor_id: 'person-local' },
    });
    assert.equal(disableLegacyOne.statusCode, 200, disableLegacyOne.payload);
    const afterFirstLegacyDisable = JSON.parse(await readFile(path.join(dataDir, 'config.json'), 'utf-8'));
    assert.equal(afterFirstLegacyDisable.grants.find((grant: { id: string }) => grant.id === sharedGrantId)?.status, 'active');

    const disableLegacyTwo = await app.inject({
      method: 'POST',
      url: `/pod/skills/${encodeURIComponent(legacyTwo.id)}/disable`,
      payload: { actor_id: 'person-local' },
    });
    assert.equal(disableLegacyTwo.statusCode, 200, disableLegacyTwo.payload);
    const afterSecondLegacyDisable = JSON.parse(await readFile(path.join(dataDir, 'config.json'), 'utf-8'));
    assert.equal(afterSecondLegacyDisable.grants.find((grant: { id: string }) => grant.id === sharedGrantId)?.status, 'revoked');
  } finally {
    await app.close();
    await closeSmartwareCore();
    closeDb();
  }
});

test('a Skill revision can enter the canonical Library before any agent is assigned', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-skill-library-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const registered = await app.inject({
      method: 'POST',
      url: '/pod/skills',
      payload: {
        actor_id: 'person-local',
        name: 'Portable Notes',
        description: 'Keep notes portable across agents.',
        version: '1.0.0',
        author: 'Coffee',
        source: 'local',
        source_slug: 'codex:portable-notes',
        files: {
          'SKILL.md': '---\nname: Portable Notes\nversion: 1.0.0\n---\n\n# Portable Notes\n',
        },
      },
    });
    assert.equal(registered.statusCode, 200, registered.payload);
    const skill = registered.json().skill;
    assert.equal(skill.equipped_to.length, 0);
    assert.equal(skill.pending_revision.status, 'draft');

    const approved = await app.inject({
      method: 'POST',
      url: `/pod/skills/${encodeURIComponent(skill.id)}/revisions/${encodeURIComponent(skill.pending_revision.id)}/approve`,
      payload: { actor_id: 'person-local' },
    });
    assert.equal(approved.statusCode, 200, approved.payload);
    assert.equal(approved.json().skill.status, 'approved');
    assert.equal(approved.json().skill.current_revision.status, 'approved');
    assert.equal(approved.json().skill.pending_revision, null);
    assert.deepEqual(approved.json().skill.equipped_to, []);
  } finally {
    await app.close();
    await closeSmartwareCore();
    closeDb();
  }
});
