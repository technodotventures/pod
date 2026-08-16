import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activityConflictFromEvent,
  buildConflictResolutionBody,
  formatActivityConflictValue,
} from '../src/activity-conflicts';

const conflict = {
  id: 'conflict:claim-active:claim-cancelled',
  subject_id: 'entity-release',
  subject_name: 'Release',
  predicate: 'status_is',
  scope: 'pod/test/workspace',
  claims: [
    {
      claim_id: 'claim-active',
      subject_id: 'entity-release',
      subject_name: 'Release',
      predicate: 'status_is',
      object: { type: 'text', value: 'active' },
      scope: 'pod/test/workspace',
      status: 'contested',
      contested_by: ['claim-cancelled'],
      epistemic_tag: 'contested',
      confidence: 0.7,
      version: 1,
      created_at: '2026-07-25T00:00:00.000Z',
      valid_at: '2026-07-25T00:00:00.000Z',
      invalid_at: null,
      provenance: { origin: 'deterministic', observation_ids: ['obs-active'] },
    },
    {
      claim_id: 'claim-cancelled',
      subject_id: 'entity-release',
      subject_name: 'Release',
      predicate: 'status_is',
      object: { type: 'text', value: 'cancelled' },
      scope: 'pod/test/workspace',
      status: 'contested',
      contested_by: ['claim-active'],
      epistemic_tag: 'contested',
      confidence: 0.6,
      version: 1,
      created_at: '2026-07-25T00:00:00.000Z',
      valid_at: '2026-07-25T00:00:00.000Z',
      invalid_at: null,
      provenance: { origin: 'model', observation_ids: ['obs-cancelled'] },
    },
  ],
};

test('activity conflict parsing accepts only a structured conflict event', () => {
  assert.deepEqual(activityConflictFromEvent({
    type: 'memory_conflict_detected',
    content: { conflict },
  }), conflict);
  assert.equal(activityConflictFromEvent({
    type: 'recall_completed',
    content: { query: 'Are there conflicts?', source_count: 6 },
  }), null);
});

test('conflict resolution payload identifies one current claim and preserves a reason', () => {
  assert.deepEqual(buildConflictResolutionBody({
    actorId: 'person_owner',
    eventId: 'event-1',
    selectedClaimId: 'claim-active',
    operationId: 'op_00000000000000000000000003',
    reason: 'The release remains active',
  }), {
    actor_id: 'person_owner',
    event_id: 'event-1',
    selected_claim_id: 'claim-active',
    operation_id: 'op_00000000000000000000000003',
    reason: 'The release remains active',
  });
});

test('conflict values stay readable for strings and structured values', () => {
  assert.equal(formatActivityConflictValue('active'), 'active');
  assert.equal(formatActivityConflictValue({ date: '2026-08-01' }), '{"date":"2026-08-01"}');
});
