// PR-20 schema gateway conformance — exercises the canonical Zod
// validators directly. Routes already have surgical reject paths; this
// confirms the gateway module is wire-correct for adopters.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateRecall,
  validateRevise,
  validateReflect,
  validateObserve,
} from '../../services/schema-gateway.js';

// ── RECALL ───────────────────────────────────────────────────────────

test('schema-gateway: RECALL rejects numeric min_confidence', () => {
  const r = validateRecall({ query: 'x', scope: 'self', resolution: { min_confidence: 0.5 } });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, 'invalid_payload');
    assert.match(r.error.details.path, /min_confidence/);
  }
});

test('schema-gateway: RECALL accepts bucket min_confidence', () => {
  const r = validateRecall({ query: 'x', scope: 'self', resolution: { min_confidence: 'medium' } });
  assert.equal(r.ok, true);
});

test('schema-gateway: RECALL rejects as_of as post-beta', () => {
  const r = validateRecall({ query: 'x', scope: 'self', as_of: '2026-05-01T00:00:00Z' });
  assert.equal(r.ok, false);
});

// ── REVISE ───────────────────────────────────────────────────────────

test('schema-gateway: REVISE dry_run + operation_id rejected', () => {
  const r = validateRevise({
    target: { type: 'page', id: 'page_x' },
    new_state: { author: 'user' },
    reason: 't',
    dry_run: true,
    operation_id: 'op_A0000000000000000000000000',
    actor_id: 'user:test',
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error.message, /preview phase/);
});

test('schema-gateway: REVISE commit without operation_id rejected', () => {
  const r = validateRevise({
    target: { type: 'claim', id: 'claim_x' },
    new_state: { content: 'updated' },
    reason: 't',
    actor_id: 'agent:test',
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error.message, /commit requires operation_id/);
});

test('schema-gateway: REVISE valid commit accepted', () => {
  const r = validateRevise({
    target: { type: 'claim', id: 'claim_x' },
    new_state: { content: 'updated' },
    reason: 't',
    operation_id: 'op_A0000000000000000000000000',
    actor_id: 'user:test',
  });
  assert.equal(r.ok, true);
});

test('schema-gateway: REVISE rejects malformed operation_id', () => {
  const r = validateRevise({
    target: { type: 'claim', id: 'claim_x' },
    new_state: { content: 'updated' },
    reason: 't',
    operation_id: 'not-an-op-id',
    actor_id: 'user:test',
  });
  assert.equal(r.ok, false);
});

test('schema-gateway: REVISE rejects malformed actor_id', () => {
  const r = validateRevise({
    target: { type: 'claim', id: 'claim_x' },
    new_state: { content: 'updated' },
    reason: 't',
    operation_id: 'op_A0000000000000000000000000',
    actor_id: 'person-local',
  });
  assert.equal(r.ok, false);
});

// ── REFLECT ──────────────────────────────────────────────────────────

test('schema-gateway: REFLECT rejects scope-target (REF-11)', () => {
  const r = validateReflect({ target: { type: 'scope' as unknown as 'page' }, mode: 'explicit', actor_id: 'substrate:coffee' });
  assert.equal(r.ok, false);
});

// ── OBSERVE ──────────────────────────────────────────────────────────

test('schema-gateway: OBSERVE with valid spec-shaped payload accepted', () => {
  const r = validateObserve({
    source: 'test',
    scope: 'self',
    content: 'hello',
    actor_id: 'user:test',
    operation_id: 'op_A0000000000000000000000000',
  });
  assert.equal(r.ok, true);
});
