import assert from 'node:assert/strict';
import test from 'node:test';

import { configuredPinLength, isCompletePin } from '../src/pin-entry';

test('uses the configured PIN length and falls back for legacy status responses', () => {
  assert.equal(configuredPinLength(6), 6);
  assert.equal(configuredPinLength(undefined), 4);
  assert.equal(configuredPinLength(7), 4);
});

test('auto-submit waits for the configured last digit', () => {
  assert.equal(isCompletePin('12345', 6), false);
  assert.equal(isCompletePin('123456', 6), true);
  assert.equal(isCompletePin('123456', 4), false);
});
