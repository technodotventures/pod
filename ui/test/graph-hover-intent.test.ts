import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GRAPH_HOVER_CARD_DELAY_MS,
  updateGraphHoverIntent,
  type GraphHoverIntent,
} from '../src/graph-hover-intent';

test('graph cards require a deliberate hover rather than ordinary pointer traversal', () => {
  assert.ok(GRAPH_HOVER_CARD_DELAY_MS >= 500);

  const entered = updateGraphHoverIntent(null, { nodeId: 'node:a', x: 100, y: 100 });
  assert.equal(entered.restartTimer, true);

  const settled = updateGraphHoverIntent(entered.intent, { nodeId: 'node:a', x: 103, y: 102 });
  assert.equal(settled.restartTimer, false);

  const traversing = updateGraphHoverIntent(settled.intent, { nodeId: 'node:a', x: 112, y: 100 });
  assert.equal(traversing.restartTimer, true);
  assert.deepEqual(traversing.intent, { nodeId: 'node:a', anchorX: 112, anchorY: 100 });
});

test('graph hover intent restarts for another node and clears off-node', () => {
  const current: GraphHoverIntent = { nodeId: 'node:a', anchorX: 20, anchorY: 30 };
  const next = updateGraphHoverIntent(current, { nodeId: 'node:b', x: 40, y: 50 });
  const cleared = updateGraphHoverIntent(next.intent, null);

  assert.equal(next.restartTimer, true);
  assert.equal(next.intent?.nodeId, 'node:b');
  assert.equal(cleared.intent, null);
  assert.equal(cleared.restartTimer, false);
});
