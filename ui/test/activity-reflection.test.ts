import assert from 'node:assert/strict';
import test from 'node:test';

import { activityReflectionResult } from '../src/activity-reflection';

test('parses auditable reflection output from a reflection event', () => {
  assert.deepEqual(activityReflectionResult({
    type: 'reflect',
    content: {
      claims_created: 3,
      pages_compiled: 1,
      results: [{
        scope: 'pod/founder/personal',
        claims_created: 3,
        pages_compiled: 1,
        pages: [{ id: 'wiki:people/ada', title: 'Ada', entity_id: 'entity_ada', path: 'people/ada.md' }],
      }],
    },
  }), {
    claims_created: 3,
    pages_compiled: 1,
    scopes: [{
      scope: 'pod/founder/personal',
      claims_created: 3,
      pages_compiled: 1,
      pages: [{ id: 'wiki:people/ada', title: 'Ada', entity_id: 'entity_ada', path: 'people/ada.md' }],
    }],
  });
});

test('older summary-only reflection events remain unsupported rather than inventing detail', () => {
  assert.equal(activityReflectionResult({
    type: 'reflect',
    content: { mode: 'scheduled', scopes: ['pod/founder/personal'] },
  }), null);
});

test('non-reflection events are ignored', () => {
  assert.equal(activityReflectionResult({ type: 'gmail_sync', content: {} }), null);
});
