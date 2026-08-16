import assert from 'node:assert/strict';
import test from 'node:test';

import { podLoadErrorMessage } from '../src/pod-load-error';

test('authentication failures explain that stored Pod data was not removed', () => {
  assert.equal(
    podLoadErrorMessage(new Error('/pod/objects?limit=5000 401 session expired')),
    'The web app reached a Pod service, but it rejected the connection. Your stored data has not been removed.',
  );
});

test('network failures say that the data service is unavailable', () => {
  assert.equal(
    podLoadErrorMessage(new TypeError('Failed to fetch')),
    'The Pod data service is unavailable. Start the web API and try again.',
  );
});
