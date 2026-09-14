import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshnessBucket,
  isInstructionFile,
  pluginComponentDiff,
  skillFileDiff,
} from '../src/capability-utils';

test('isInstructionFile — SKILL.md is the instruction file', () => {
  assert.equal(isInstructionFile('SKILL.md'), true);
  assert.equal(isInstructionFile('skill.md'), true);
  assert.equal(isInstructionFile('examples/SKILL.md'), true);
  assert.equal(isInstructionFile('reference/cheatsheet.md'), false);
  assert.equal(isInstructionFile('scripts/run.sh'), false);
});

test('skillFileDiff — added / changed / removed with instruction split', () => {
  const prev = { 'SKILL.md': 'v1', 'reference/old.md': 'x', 'keep.txt': 'same' };
  const next = { 'SKILL.md': 'v2', 'reference/new.md': 'y', 'keep.txt': 'same' };
  const diff = skillFileDiff(prev, next);
  assert.deepEqual(
    diff.map(d => `${d.kind}:${d.path}:${d.instruction ? 'i' : 'r'}`),
    ['changed:SKILL.md:i', 'added:reference/new.md:r', 'removed:reference/old.md:r'],
  );
});

test('skillFileDiff — first revision means everything is added', () => {
  const diff = skillFileDiff(null, { 'SKILL.md': 'v1', 'notes/a.md': 'a' });
  assert.equal(diff.length, 2);
  assert.ok(diff.every(d => d.kind === 'added'));
});

test('skillFileDiff — identical revisions produce no changes', () => {
  const files = { 'SKILL.md': 'same', 'a/b.md': 'b' };
  assert.deepEqual(skillFileDiff(files, { ...files }), []);
});

test('pluginComponentDiff — added, removed and status transitions', () => {
  const prev = [
    { component_type: 'mcp_server' as const, component_key: 'stripe', status: 'valid' as const },
    { component_type: 'skill' as const, component_key: 'deploy', status: 'valid' as const },
  ];
  const next = [
    { component_type: 'mcp_server' as const, component_key: 'stripe', status: 'invalid' as const },
    { component_type: 'extension' as const, component_key: 'vscode', status: 'valid' as const },
  ];
  const diff = pluginComponentDiff(prev, next);
  assert.deepEqual(
    diff.map(d => `${d.kind}:${d.componentKey}${d.from ? `:${d.from}->${d.to}` : ''}`),
    ['added:vscode', 'status_changed:stripe:valid->invalid', 'removed:deploy'],
  );
});

test('pluginComponentDiff — first revision has no baseline', () => {
  const diff = pluginComponentDiff(null, [
    { component_type: 'skill', component_key: 'x', status: 'valid' },
  ]);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].kind, 'added');
});

test('freshnessBucket — fresh / recent / stale / unknown', () => {
  const now = Date.parse('2026-09-14T12:00:00Z');
  assert.equal(freshnessBucket('2026-09-14T06:00:00Z', now), 'fresh');
  assert.equal(freshnessBucket('2026-09-11T12:00:00Z', now), 'recent');
  assert.equal(freshnessBucket('2026-08-01T12:00:00Z', now), 'stale');
  assert.equal(freshnessBucket(null, now), 'unknown');
  assert.equal(freshnessBucket('not-a-date', now), 'unknown');
});
