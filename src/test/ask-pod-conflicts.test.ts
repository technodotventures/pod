import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAskPodConflictAnswer,
  groupAskPodConflicts,
} from '../services/ask-pod-conflicts.js';

const BASE_CLAIM = {
  subject_id: 'entity-release',
  subject_name: 'Release',
  predicate: 'status_is',
  scope: 'pod/test/workspace',
  epistemic_tag: 'contested' as const,
  confidence: 0.7,
  version: 1,
  created_at: '2026-07-25T00:00:00.000Z',
  valid_at: '2026-07-25T00:00:00.000Z',
  invalid_at: null,
  provenance: {
    origin: 'deterministic' as const,
    observation_ids: [] as string[],
  },
};

test('Ask Pod groups mutually contested claims and cites each competing value', () => {
  const conflicts = groupAskPodConflicts([
    {
      ...BASE_CLAIM,
      claim_id: 'claim-open',
      object: { type: 'text', value: 'open' },
      status: 'contested',
      contested_by: ['claim-cancelled'],
      provenance: { ...BASE_CLAIM.provenance, observation_ids: ['obs-open'] },
    },
    {
      ...BASE_CLAIM,
      claim_id: 'claim-cancelled',
      object: { type: 'text', value: 'cancelled' },
      status: 'contested',
      contested_by: ['claim-open'],
      provenance: { ...BASE_CLAIM.provenance, observation_ids: ['obs-cancelled'] },
    },
  ]);

  assert.equal(conflicts.length, 1);
  assert.deepEqual(
    conflicts[0]?.claims.map(claim => claim.claim_id),
    ['claim-cancelled', 'claim-open'],
  );

  const answer = buildAskPodConflictAnswer(conflicts, new Map([
    ['claim-open', 'S1'],
    ['claim-cancelled', 'S2'],
  ]));
  assert.match(answer, /1 unresolved conflict/i);
  assert.match(answer, /"cancelled" \[S2\].*"open" \[S1\]/);
});

test('Ask Pod distinguishes an empty conflict result from ordinary retrieval', () => {
  assert.equal(
    buildAskPodConflictAnswer([], new Map()),
    'I found no confirmed conflicting memories in the selected scope. Duplicate source views and corroborating evidence are not counted as conflicts.',
  );
});
