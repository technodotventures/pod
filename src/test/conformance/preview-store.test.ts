// Cascade preview store contracts (PR-7 / A6).
//
// Targets Protocol Contract v0.4.1 + Reference Impl v0.1.2 §"Cascade
// preview store". The store is the substrate-side cache that holds a
// dry-run cascade preview between a REVISE dry_run and its commit.
//
// Pre-conditions the consumer (PR-8 / B3) relies on:
//   - newPreviewId() matches ^preview_[0-9A-HJKMNP-TV-Z]{26}$
//   - lookup returns 'hit' within TTL; 'expired' past TTL; 'consumed'
//     after a successful commit; 'not_found' otherwise
//   - consume() is idempotent (re-consuming returns false; never replays)
//   - gc() removes expired previews; doesn't remove fresh ones
//
// The store is exercised directly here. Wiring to /pod/revise is PR-8.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CascadePreviewStore,
  PREVIEW_ID_PATTERN,
  isValidCascadePreviewId,
} from 'smartware';

test('A6: CascadePreviewStore.newPreviewId returns the spec pattern', () => {
  const previewId = CascadePreviewStore.newPreviewId();
  assert.match(previewId, PREVIEW_ID_PATTERN);
  assert.equal(isValidCascadePreviewId(previewId), true);
  assert.equal(isValidCascadePreviewId('preview_foo'), false);
  assert.equal(isValidCascadePreviewId('not_preview_01HX1A2B3C4D5E6F7G8H9J0KMN'), false);
});

test('A6: put → lookup hit returns the payload within TTL', () => {
  const store = new CascadePreviewStore(':memory:');
  try {
    const payload = {
      page_id: 'page_coffee-thesis',
      sources_snapshot: ['claim_a', 'claim_b'],
      shared_claims_snapshot: ['claim_b'],
      actor_id: 'user:test',
      reason: 'unit test',
    };
    const previewId = store.put(payload);
    const lookup = store.lookup(previewId);
    assert.equal(lookup.kind, 'hit');
    if (lookup.kind === 'hit') {
      assert.deepEqual(lookup.payload, payload);
    }
  } finally {
    store.close();
  }
});

test('A6: lookup on unknown previewId returns not_found', () => {
  const store = new CascadePreviewStore(':memory:');
  try {
    const lookup = store.lookup('preview_DOESNOTEXIST0000000000000');
    assert.equal(lookup.kind, 'not_found');
  } finally {
    store.close();
  }
});

test('A6: TTL expiry — sub-1s TTL produces expired lookup after sleep', async () => {
  const store = new CascadePreviewStore(':memory:', 0); // immediate expiry
  try {
    const previewId = store.put({
      page_id: 'page_test',
      sources_snapshot: [],
      shared_claims_snapshot: [],
    });
    // Yield to event loop to ensure clock has advanced past 0ms TTL.
    await new Promise((r) => setTimeout(r, 5));
    const lookup = store.lookup(previewId);
    assert.equal(lookup.kind, 'expired', `expected expired, got: ${JSON.stringify(lookup)}`);
  } finally {
    store.close();
  }
});

test('A6: consume on a fresh preview returns true; lookup-after returns consumed', () => {
  const store = new CascadePreviewStore(':memory:');
  try {
    const previewId = store.put({
      page_id: 'page_test',
      sources_snapshot: ['claim_x'],
      shared_claims_snapshot: [],
    });
    assert.equal(store.consume(previewId), true);
    const lookup = store.lookup(previewId);
    assert.equal(lookup.kind, 'consumed', `expected consumed, got: ${JSON.stringify(lookup)}`);
  } finally {
    store.close();
  }
});

test('A6: consume is idempotent — second consume returns false (no replay)', () => {
  const store = new CascadePreviewStore(':memory:');
  try {
    const previewId = store.put({
      page_id: 'page_test',
      sources_snapshot: ['claim_x'],
      shared_claims_snapshot: [],
    });
    assert.equal(store.consume(previewId), true);
    assert.equal(store.consume(previewId), false);
  } finally {
    store.close();
  }
});

test('A6: gc removes expired previews, keeps fresh ones', async () => {
  const store = new CascadePreviewStore(':memory:', 0);
  try {
    const expiredId = store.put({ page_id: 'page_e', sources_snapshot: [], shared_claims_snapshot: [] });
    await new Promise((r) => setTimeout(r, 5)); // let expired entry age
    // Switch to a long TTL for the second insert.
    const freshStore = new CascadePreviewStore(':memory:', 600);
    const freshId = freshStore.put({ page_id: 'page_f', sources_snapshot: [], shared_claims_snapshot: [] });

    const removed = store.gc();
    assert.ok(removed >= 1, `gc should have removed expired entry; removed=${removed}`);

    // After gc, expired id is not_found (row deleted).
    assert.equal(store.lookup(expiredId).kind, 'not_found');
    // Fresh id in the other store still hits.
    assert.equal(freshStore.lookup(freshId).kind, 'hit');
    freshStore.close();
  } finally {
    store.close();
  }
});
