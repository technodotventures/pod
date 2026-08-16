import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import {
  closeDb,
  getAgent,
  getDb,
  getObject,
  getSkill,
  upsertAgent,
} from '../pod/db.js';
import { closeSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 8732,
    dataDir,
    ownerId: undefined,
    podId: 'openclaw-migration-test',
    podName: 'OpenClaw Migration Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

async function createOpenClawFixture(): Promise<{ root: string; secret: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'coffee-pod-openclaw-source-'));
  const workspace = path.join(root, 'workspace');
  const skill = path.join(workspace, 'skills', 'source-review');
  await mkdir(path.join(workspace, 'memory'), { recursive: true });
  await mkdir(path.join(skill, 'scripts'), { recursive: true });
  await mkdir(path.join(root, 'sessions'), { recursive: true });
  await mkdir(path.join(root, 'plugins'), { recursive: true });
  await writeFile(path.join(workspace, 'SOUL.md'), '# Soul\nBe curious and cite evidence.\n');
  await writeFile(path.join(workspace, 'AGENTS.md'), '# Working rules\nPrefer primary sources.\n');
  await writeFile(path.join(workspace, 'IDENTITY.md'), '# Identity\nResearch companion.\n');
  await writeFile(path.join(workspace, 'USER.md'), '# User\nPrefers concise answers.\n');
  await writeFile(path.join(workspace, 'MEMORY.md'), '# Memory\nThe launch is in October.\n');
  await writeFile(path.join(workspace, 'memory', '2026-07-28.md'), '# Daily\nReviewed the migration design.\n');
  const secret = 'sk-ant-secret-value-that-must-never-leak';
  await writeFile(path.join(workspace, 'memory', 'unsafe.md'), `Do not copy ${secret}\n`);
  await writeFile(path.join(root, 'openclaw.json'), JSON.stringify({
    agents: { defaults: { model: { primary: 'anthropic/claude-sonnet-4-6' } } },
    providers: { anthropic: { apiKey: secret } },
  }));
  await writeFile(path.join(skill, 'SKILL.md'), [
    '---',
    'name: Source Review',
    'description: Check primary sources before answering.',
    '---',
    '',
    '# Source Review',
    'Run the bundled checker before reporting.',
    '',
  ].join('\n'));
  await writeFile(path.join(skill, 'scripts', 'check.py'), 'print("reviewed")\n');
  return { root, secret };
}

test('OpenClaw migration previews, applies, projects, and rolls back without copying secrets', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-openclaw-migration-'));
  const env = testEnv(dataDir);
  const source = await createOpenClawFixture();
  const app = await buildApp(env, false);

  try {
    const created = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:hermes-migrated',
        name: 'Hermes Migrated',
        description: 'Target for an OpenClaw migration.',
        persona: 'Existing Pod persona.',
        model: 'existing/model',
        access_mode: 'scoped',
        scopes: ['personal'],
      },
    });
    assert.equal(created.statusCode, 200, created.payload);

    const preview = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents/agent%3Ahermes-migrated/migrations/openclaw/preview',
      payload: { source_path: source.root, memory_scope: 'personal' },
    });
    assert.equal(preview.statusCode, 200, preview.payload);
    const plan = preview.json().plan;
    assert.equal(plan.format, 'coffee-pod-openclaw-migration-plan/v1');
    assert.equal(plan.summary.instructions, 3);
    assert.equal(plan.summary.memories, 3);
    assert.equal(plan.summary.skills, 1);
    assert.equal(plan.summary.runtime_preferences, 1);
    assert.deepEqual(
      new Set(plan.conflicts.map((conflict: { id: string }) => conflict.id)),
      new Set(['conflict_instruction_soul', 'conflict_preferred_model']),
    );
    assert(plan.skipped.some((entry: { path: string; reason: string }) =>
      entry.path.endsWith('unsafe.md') && entry.reason === 'possible_secret'));
    assert(plan.skipped.some((entry: { path: string; reason: string }) =>
      entry.path === 'sessions' && entry.reason === 'credential_or_runtime_state_excluded'));
    assert(plan.skipped.some((entry: { path: string; reason: string }) =>
      entry.path === 'plugins' && entry.reason === 'unsupported_runtime_artifact'));
    assert.doesNotMatch(preview.payload, new RegExp(source.secret));

    const payload = {
      source_path: source.root,
      memory_scope: 'personal',
      plan_digest: plan.plan_digest,
      resolutions: {
        conflict_instruction_soul: 'use_incoming',
        conflict_preferred_model: 'use_incoming',
      },
    };
    const applied = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents/agent%3Ahermes-migrated/migrations/openclaw/apply',
      payload,
    });
    assert.equal(applied.statusCode, 200, applied.payload);
    const appliedBody = applied.json();
    assert.equal(appliedBody.idempotent, false);
    assert.equal(appliedBody.receipt.format, 'coffee-pod-agent-migration-receipt/v1');
    assert.equal(appliedBody.receipt.created_object_ids.length, 4);
    assert.equal(appliedBody.receipt.created_skill_ids.length, 1);
    assert.equal(appliedBody.receipt.observation_ids.length, 3);
    assert.equal(appliedBody.receipt.previous_agent, undefined);
    assert.equal(appliedBody.receipt.applied_agent, undefined);
    assert.doesNotMatch(applied.payload, new RegExp(source.secret));

    const hermesFiles = appliedBody.hermes_projection.files as Array<{
      path: string;
      content: unknown;
    }>;
    assert(hermesFiles.some(file => file.path === '$HERMES_HOME/SOUL.md'));
    assert(hermesFiles.some(file => file.path === '$HERMES_HOME/AGENTS.md'));
    assert(hermesFiles.some(file => file.path.endsWith('/skills/source-review/SKILL.md')));
    assert(hermesFiles.some(file => file.path.endsWith('/skills/source-review/scripts/check.py')));
    const config = hermesFiles.find(file => file.path === '$HERMES_HOME/config.yaml')!.content as {
      model: string;
    };
    assert.equal(config.model, 'anthropic/claude-sonnet-4-6');
    for (const [target, skillRoot] of Object.entries({
      codex: '$CODEX_HOME/skills',
      'claude-code': '~/.claude/skills',
      openclaw: '$OPENCLAW_STATE_DIR/workspace/skills',
      'kimi-code': '$KIMI_CODE_HOME/skills',
    })) {
      const projection = await app.inject({
        method: 'GET',
        url: `/pod/registry/agents/agent%3Ahermes-migrated/profile-materializations/${target}`,
      });
      assert.equal(projection.statusCode, 200, projection.payload);
      assert(projection.json().materialization.files.some(
        (file: { path: string }) => file.path === `${skillRoot}/source-review/SKILL.md`,
      ));
      assert.match(projection.payload, /Prefer primary sources/);
      assert.doesNotMatch(projection.payload, new RegExp(source.secret));
    }

    const db = getDb(env);
    const migratedAgent = getAgent(db, 'agent:hermes-migrated')!;
    assert.match(migratedAgent.persona!, /Be curious/);
    assert.equal(migratedAgent.model, 'anthropic/claude-sonnet-4-6');
    assert.equal(
      (migratedAgent.metadata?.portable_instructions as any).slots.agents.source.harness,
      'openclaw',
    );
    const skillId = appliedBody.receipt.created_skill_ids[0] as string;
    const importedSkill = getSkill(db, skillId)!;
    assert.equal(importedSkill.status, 'review');
    assert.equal(importedSkill.trust_level, 'blocked');
    assert.equal(importedSkill.portability, 'exportable');

    const repeated = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents/agent%3Ahermes-migrated/migrations/openclaw/apply',
      payload,
    });
    assert.equal(repeated.statusCode, 200, repeated.payload);
    assert.equal(repeated.json().idempotent, true);
    assert.equal(repeated.json().receipt.id, appliedBody.receipt.id);

    const receipts = await app.inject({
      method: 'GET',
      url: '/pod/registry/agents/agent%3Ahermes-migrated/migration-receipts',
    });
    assert.equal(receipts.statusCode, 200, receipts.payload);
    assert.equal(receipts.json().receipts.length, 1);
    assert.doesNotMatch(receipts.payload, /Be curious and cite evidence/);

    upsertAgent(db, {
      id: migratedAgent.id,
      name: migratedAgent.name,
      model: 'later/user-selected-model',
      metadata: migratedAgent.metadata ?? undefined,
    });
    const rolledBack = await app.inject({
      method: 'POST',
      url: `/pod/registry/agents/agent%3Ahermes-migrated/migration-receipts/${appliedBody.receipt.id}/rollback`,
    });
    assert.equal(rolledBack.statusCode, 200, rolledBack.payload);
    assert(rolledBack.json().receipt.rollback.rolled_back_at);
    assert(rolledBack.json().receipt.rollback.warnings.some(
      (warning: string) => warning.includes('Preferred model changed after migration'),
    ));
    const restoredAgent = getAgent(db, 'agent:hermes-migrated')!;
    assert.equal(restoredAgent.persona, 'Existing Pod persona.');
    assert.equal(restoredAgent.model, 'later/user-selected-model');
    assert.equal(restoredAgent.metadata?.portable_instructions, undefined);
    assert.equal(getSkill(db, skillId), null);
    for (const objectId of appliedBody.receipt.created_object_ids as string[]) {
      assert(getObject(db, objectId)?.deleted_at);
    }
  } finally {
    await app.close();
    await closeSmartwareCore();
    closeDb();
  }
});

test('OpenClaw migration apply rejects a source changed after preview', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-openclaw-stale-'));
  const env = testEnv(dataDir);
  const source = await createOpenClawFixture();
  const app = await buildApp(env, false);

  try {
    await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:hermes-stale',
        name: 'Hermes Stale',
        access_mode: 'scoped',
        scopes: ['personal'],
      },
    });
    const preview = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents/agent%3Ahermes-stale/migrations/openclaw/preview',
      payload: { source_path: source.root },
    });
    assert.equal(preview.statusCode, 200, preview.payload);
    await writeFile(path.join(source.root, 'workspace', 'MEMORY.md'), '# Memory\nChanged after preview.\n');

    const applied = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents/agent%3Ahermes-stale/migrations/openclaw/apply',
      payload: {
        source_path: source.root,
        plan_digest: preview.json().plan.plan_digest,
      },
    });
    assert.equal(applied.statusCode, 409, applied.payload);
    assert.equal(applied.json().error, 'plan_changed');
  } finally {
    await app.close();
    await closeSmartwareCore();
    closeDb();
  }
});
