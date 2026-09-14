// Deliberate failure — exercises the CI self-heal loop (factory demo). Removed after the demo.
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('ci-heal demo — deliberate failure', () => {
  assert.ok(false, 'deliberate failure for the self-heal demo');
});
