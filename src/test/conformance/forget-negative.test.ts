// FORGET negative cases per Conformance Test Spec v0.1.1.

import test from 'node:test';
import assert from 'node:assert/strict';
import { appendClaimVersion, type ClaimVersionRecord } from 'smartware';

import { closeSmartwareCore } from '../../smartware/core.js';
import {
  assertConformanceError,
  buildConformanceApp,
  fakeOperationId,
} from './harness.js';

test('FG-10: FORGET on a user-owned claim by an agent returns forbidden', async () => {
  const { app, dataDir, teardown } = await buildConformanceApp();
  const claimId = 'claim_11111111111111111111111111';
  const claim: ClaimVersionRecord = {
    claim_id: claimId,
    version: 1,
    state: 'active',
    content: 'Agent body with user-owned epistemic state',
    claim_type: 'finding',
    claim_role: 'memory',
    author: 'agent',
    epistemic_owner: 'user',
    fingerprint: 'fp_11111111111111111111111111',
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
  // Re-open so the derived SQLite read model is rebuilt from canonical L1.
  await closeSmartwareCore();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/pod/forget',
      payload: {
        actor_id: 'agent:test',
        target: { type: 'claim', id: claimId },
        mode: 'tombstone',
        reason: 'Agent attempts to forget protected truth.',
        operation_id: fakeOperationId(),
      },
    });
    const check = assertConformanceError(response, { status: 403, code: 'forbidden' }, 'FG-10');
    assert.equal(check.ok, true, check.reason);
  } finally {
    await teardown();
  }
});
