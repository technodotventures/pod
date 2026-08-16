// REVISE negative cases per Conformance Test Spec v0.1.1 and Schemas v0.1.2.
//
// Schemas v0.1.2 fixed the REVISE request's if/then/else so that:
//   - dry_run: true forbids operation_id (preview phase consumes no OperationId)
//   - dry_run: false or omitted requires operation_id (commit phase)
//
// RV-03: REVISE on a user-authored claim by a non-user actor returns forbidden.
//        (Today this can't be exercised at the route boundary because user-
//        authored claims don't exist yet — the test asserts the contract; it
//        will go green after A3 + A4 land.)

import test from 'node:test';
import assert from 'node:assert/strict';
import { appendClaimVersion, type ClaimVersionRecord } from 'smartware';

import {
  buildConformanceApp,
  assertConformanceError,
  fakeOperationId,
} from './harness.js';

test('REVISE: dry_run with operation_id rejected with invalid_payload (schemas v0.1.2)', async () => {
  const { app, teardown } = await buildConformanceApp();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/pod/revise',
      payload: {
        target: { type: 'page', id: 'page_does-not-exist' },
        new_state: { author: 'user' },
        reason: 'test',
        dry_run: true,
        operation_id: fakeOperationId(),
        actor_id: 'user:test',
      },
    });

    const check = assertConformanceError(
      response,
      { status: 400, code: 'invalid_payload' },
      'REVISE dry_run+operation_id',
    );
    assert.equal(check.ok, true, check.reason);
  } finally {
    await teardown();
  }
});

test('REVISE: commit (dry_run omitted) without operation_id rejected with invalid_payload', async () => {
  const { app, teardown } = await buildConformanceApp();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/pod/revise',
      payload: {
        target: { type: 'claim', id: 'claim_does-not-exist' },
        new_state: { content: 'updated' },
        reason: 'test',
        actor_id: 'agent:test',
      },
    });

    const check = assertConformanceError(
      response,
      { status: 400, code: 'invalid_payload' },
      'REVISE commit without operation_id',
    );
    assert.equal(check.ok, true, check.reason);
  } finally {
    await teardown();
  }
});

test('RV-03: REVISE on user-authored claim by agent returns forbidden', async () => {
  const { app, dataDir, teardown } = await buildConformanceApp();
  const claimId = 'claim_00000000000000000000000000';
  const claim: ClaimVersionRecord = {
    claim_id: claimId,
    version: 1,
    state: 'active',
    content: 'User-authored canonical claim',
    claim_type: 'finding',
    claim_role: 'memory',
    author: 'user',
    epistemic_owner: 'user',
    fingerprint: 'fp_00000000000000000000000000',
    confidence: 'medium',
    epistemic_tag: 'fact',
    scope: 'pod/conformance-test/personal',
    derived_from: [],
    relations: [],
    created_at: '2026-01-01T00:00:00Z',
    version_at: '2026-01-01T00:00:00Z',
    operation_id: fakeOperationId(),
    actor_id: 'user:test',
    tags: [],
  };
  appendClaimVersion(dataDir, claim);

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/pod/revise',
      payload: {
        target: { type: 'claim', id: claimId },
        expected_base_version: 1,
        set_confidence: 'high',
        reason: 'Agent attempts to mutate protected epistemic state.',
        operation_id: fakeOperationId(),
        actor_id: 'agent:test',
      },
    });
    const check = assertConformanceError(response, { status: 403, code: 'forbidden' }, 'RV-03');
    assert.equal(check.ok, true, check.reason);
  } finally {
    await teardown();
  }
});
