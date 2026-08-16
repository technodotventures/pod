// Phase C conformance tests (PR-18).

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import {
  checkCapacity,
  hardCapDensify,
  transitionOnCorroboration,
  transitionOnContradiction,
  updateConfidence,
  runGuardian,
} from '../../services/plasticity.js';

// ── C5: capacity ─────────────────────────────────────────────────────

test('C5: checkCapacity flags near_capacity at ≥80% of budget', () => {
  const r1 = checkCapacity('a'.repeat(800), 1000);
  assert.equal(r1.near_capacity, true);
  assert.equal(r1.exceeded, false);
  const r2 = checkCapacity('a'.repeat(500), 1000);
  assert.equal(r2.near_capacity, false);
  const r3 = checkCapacity('a'.repeat(1200), 1000);
  assert.equal(r3.exceeded, true);
});

test('C5: hardCapDensify truncates with a marker when over budget', () => {
  const truncated = hardCapDensify('x'.repeat(2000), 100);
  assert.ok(truncated.length <= 100);
  assert.match(truncated, /truncated by capacity/);
  assert.equal(hardCapDensify('short', 1000), 'short');
});

// ── C7: bucket confidence ────────────────────────────────────────────

test('C7/PL-02: corroboration transitions low→medium→high (ceiling at high)', () => {
  assert.equal(transitionOnCorroboration('low'), 'medium');
  assert.equal(transitionOnCorroboration('medium'), 'high');
  assert.equal(transitionOnCorroboration('high'), 'high');
});

test('C7/PL-02: contradiction transitions high→medium→low (floor with flag)', () => {
  assert.deepEqual(transitionOnContradiction('high'), { next: 'medium', flag_for_review: false });
  assert.deepEqual(transitionOnContradiction('medium'), { next: 'low', flag_for_review: false });
  assert.deepEqual(transitionOnContradiction('low'), { next: 'low', flag_for_review: true });
});

test('C7/VP-07: user-authored confidence is untouched by both signals', () => {
  assert.equal(updateConfidence('low', 'user', 'corroborate', 'claim_X'), null);
  assert.equal(updateConfidence('high', 'user', 'contradict', 'claim_X'), null);
});

test('C7: agent-authored confidence updates on corroboration', () => {
  const upd = updateConfidence('low', 'agent', 'corroborate', 'claim_AGENT1');
  assert.deepEqual(upd, { claim_id: 'claim_AGENT1', prior: 'low', next: 'medium', flag_for_review: false });
});

test('C7: at floor + contradiction, agent claim is flagged for review (not dropped further)', () => {
  const upd = updateConfidence('low', 'agent', 'contradict', 'claim_AGENT2');
  assert.deepEqual(upd, { claim_id: 'claim_AGENT2', prior: 'low', next: 'low', flag_for_review: true });
});

// ── C8: structural guardian ──────────────────────────────────────────

test('C8: guardian rebuilds _index.md per category', async () => {
  const wikiDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-guardian-'));
  const concepts = path.join(wikiDir, 'concepts');
  mkdirSync(concepts, { recursive: true });
  writeFileSync(
    path.join(concepts, 'thing-one.md'),
    `---\nsummary: "first concept"\n---\n\n# Thing One\n`,
    'utf-8',
  );
  writeFileSync(
    path.join(concepts, 'thing-two.md'),
    `---\nsummary: "second concept"\n---\n\n# Thing Two\n`,
    'utf-8',
  );

  const report = runGuardian(wikiDir);
  assert.ok(report.indexes_rebuilt.includes('concepts'));

  const index = readFileSync(path.join(concepts, '_index.md'), 'utf-8');
  assert.match(index, /# Concepts/);
  assert.match(index, /thing-one/);
  assert.match(index, /thing-two/);
  assert.match(index, /first concept/);
});

test('C8: guardian handles missing category dirs without erroring', async () => {
  const wikiDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-guardian-empty-'));
  // No category dirs exist; should not throw, should return zero entries.
  const report = runGuardian(wikiDir);
  assert.equal(report.indexes_rebuilt.length, 0);
  assert.equal(report.errors.length, 0);
});
