// REFLECT negative cases per Conformance Test Spec v0.1.1.
//
// REF-11: REFLECT with target.type: "scope" returns invalid_payload (post-beta).
//
// Current route (src/routes/pod.ts:770) returns HTTP 501 for scope-target.
// Spec v1.5.4.2 / Protocol v0.4.1 require invalid_payload. This test is RED
// today; A6 (schema validation gateway) turns it green.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildConformanceApp,
  assertConformanceError,
  fakeOperationId,
} from './harness.js';

test('REF-11: REFLECT with target.type "scope" returns invalid_payload', async () => {
  const { app, teardown } = await buildConformanceApp();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/pod/reflect',
      payload: {
        scope: 'self',
        target: { type: 'scope' },
        mode: 'explicit',
        operation_id: fakeOperationId(),
        actor_id: 'substrate:coffee',
      },
    });

    const check = assertConformanceError(
      response,
      { status: 400, code: 'invalid_payload' },
      'REF-11',
    );
    assert.equal(check.ok, true, check.reason);
  } finally {
    await teardown();
  }
});
