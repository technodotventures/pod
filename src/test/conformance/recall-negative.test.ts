// RECALL negative cases per Conformance Test Spec v0.1.1.
//
// RC-03 (negative): numeric min_confidence must be rejected; bucket enum only in beta.
// RC-11:           as_of on RECALL returns invalid_payload (post-beta feature).
//
// Both tests are expected RED on the current branch (the route accepts numeric
// min_confidence today and does not reject as_of). They turn green when A6 +
// A7 (schema validation gateway + HTTP status mapping) land.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildConformanceApp,
  assertConformanceError,
} from './harness.js';

// Note: actor_id is supplied on these payloads because the Pod
// consumer enforces auth at the route boundary even though the Smartware
// spec's wire shape doesn't require it for RECALL. The spec validation
// (the assertion below) runs after the auth check; both tests trip on
// the spec field being wrong, not on missing auth.

test('RC-03 (negative): RECALL rejects numeric min_confidence with invalid_payload', async () => {
  const { app, teardown } = await buildConformanceApp();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/pod/recall',
      payload: {
        actor_id: 'agent:test',
        query: 'anything',
        scope: 'self',
        resolution: {
          // Wire type per schemas v0.1.2 is the ConfidenceBucket enum; a
          // numeric value must be rejected with invalid_payload.
          min_confidence: 0.5,
        },
      },
    });

    const check = assertConformanceError(
      response,
      { status: 400, code: 'invalid_payload' },
      'RC-03 negative',
    );
    assert.equal(check.ok, true, check.reason);
  } finally {
    await teardown();
  }
});

test('RC-11: RECALL with as_of returns invalid_payload (post-beta feature)', async () => {
  const { app, teardown } = await buildConformanceApp();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/pod/recall',
      payload: {
        actor_id: 'agent:test',
        query: 'anything',
        scope: 'self',
        as_of: '2026-05-01T00:00:00Z',
      },
    });

    const check = assertConformanceError(
      response,
      { status: 400, code: 'invalid_payload' },
      'RC-11',
    );
    assert.equal(check.ok, true, check.reason);
  } finally {
    await teardown();
  }
});
