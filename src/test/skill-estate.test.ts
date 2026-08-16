import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { CoffeePodEnv } from '../config/env.js';
import {
  approveSkillRevision,
  closeDb,
  getDb,
  listSkillRevisions,
} from '../pod/db.js';
import {
  applySkillDeployment,
  captureSkillPackage,
  previewSkillDeployment,
  scanSkillSource,
} from '../skills/skill-estate.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'skill-estate-test',
    podName: 'Skill Estate Test Pod',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

const INITIAL_SKILL = `---
name: Review Changes
description: Review a change before merge
version: 1.0.0
author: Coffee
---

# Review Changes

Check correctness and regressions.
`;

test('Skill estate converges agent packages, revisions changes, and refuses deployment overwrite', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'coffee-pod-skill-estate-'));
  const dataDir = path.join(root, 'pod-data');
  const codexRoot = path.join(root, 'codex-skills');
  const claudeRoot = path.join(root, 'claude-skills');
  const codexPackage = path.join(codexRoot, 'review-changes');
  const claudePackage = path.join(claudeRoot, 'review-changes');
  await mkdir(codexPackage, { recursive: true });
  await mkdir(claudePackage, { recursive: true });
  await writeFile(path.join(codexPackage, 'SKILL.md'), INITIAL_SKILL, 'utf-8');
  await writeFile(path.join(codexPackage, 'reference.md'), 'Use a correctness checklist.\n', 'utf-8');
  await writeFile(path.join(claudePackage, 'SKILL.md'), INITIAL_SKILL, 'utf-8');
  await writeFile(path.join(claudePackage, 'reference.md'), 'Use a correctness checklist.\n', 'utf-8');

  const db = getDb(testEnv(dataDir));
  try {
    const [codex] = await scanSkillSource('codex', codexRoot);
    const first = captureSkillPackage(db, codex);
    assert.equal(first.created_skill, true);
    assert.equal(first.created_revision, true);
    assert.equal(first.revision.status, 'draft');

    const [claude] = await scanSkillSource('claude-code', claudeRoot);
    const converged = captureSkillPackage(db, claude);
    assert.equal(converged.skill.id, first.skill.id);
    assert.equal(converged.revision.id, first.revision.id);
    assert.equal(converged.created_revision, false, 'identical packages from different agents must converge');

    const approved = approveSkillRevision(db, first.skill.id, first.revision.id);
    assert.equal(approved?.status, 'approved');

    const deployed = await applySkillDeployment({
      db,
      skill_id: first.skill.id,
      revision_id: first.revision.id,
      agent_id: 'agent:claude-code',
      target: 'claude-code',
      target_root: path.join(root, 'target-skills'),
    });
    assert.equal(deployed.deployment.status, 'synced');
    assert.deepEqual(deployed.files_written.sort(), ['SKILL.md', 'reference.md']);
    assert.equal(
      await readFile(path.join(root, 'target-skills', 'review-changes', 'SKILL.md'), 'utf-8'),
      INITIAL_SKILL,
    );

    const changedSkill = INITIAL_SKILL.replace('Check correctness and regressions.', 'Check correctness, security, and regressions.');
    await writeFile(path.join(codexPackage, 'SKILL.md'), changedSkill, 'utf-8');
    const [changed] = await scanSkillSource('codex', codexRoot);
    const changedCapture = captureSkillPackage(db, changed);
    assert.equal(changedCapture.skill.id, first.skill.id);
    assert.equal(changedCapture.created_revision, true);
    assert.equal(listSkillRevisions(db, first.skill.id).length, 2);
    approveSkillRevision(db, first.skill.id, changedCapture.revision.id);

    const conflict = await previewSkillDeployment({
      db,
      skill_id: first.skill.id,
      revision_id: changedCapture.revision.id,
      agent_id: 'agent:claude-code',
      target: 'claude-code',
      target_root: path.join(root, 'target-skills'),
    });
    assert.equal(conflict.action, 'conflict');
    assert.equal(conflict.can_apply, false);

    const blockedApply = await applySkillDeployment({
      db,
      skill_id: first.skill.id,
      revision_id: changedCapture.revision.id,
      agent_id: 'agent:claude-code',
      target: 'claude-code',
      target_root: path.join(root, 'target-skills'),
    });
    assert.equal(blockedApply.deployment.status, 'drifted');
    assert.deepEqual(blockedApply.files_written, []);
    assert.equal(
      await readFile(path.join(root, 'target-skills', 'review-changes', 'SKILL.md'), 'utf-8'),
      INITIAL_SKILL,
      'drift handling must not overwrite the target',
    );
  } finally {
    closeDb();
  }
});
