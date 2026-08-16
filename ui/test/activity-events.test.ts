import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activityAttentionPresentation,
  activityAttentionEvents,
  activityNeedsAttention,
} from '../src/activity-events';

test('attention queue prefers an explicit backend signal and ignores resolved work', () => {
  const base = {
    id: 'event-1',
    type: 'observation',
    process: 'observe',
    title: 'A normal memory',
    observed_at: '2026-07-20T10:00:00.000Z',
  };

  assert.equal(activityNeedsAttention({ ...base, requires_attention: true }), true);
  assert.equal(activityNeedsAttention({ ...base, requires_attention: true, resolved_at: '2026-07-20T11:00:00.000Z' }), false);
  assert.equal(activityNeedsAttention({ ...base, requires_attention: true, dismissed_at: '2026-07-20T11:00:00.000Z' }), false);
  assert.equal(activityNeedsAttention({ ...base, type: 'memory_conflict_resolved', requires_attention: false }), false);
  assert.equal(activityNeedsAttention(base), false);
});

test('attention queue recognises conservative review and failure language', () => {
  const event = {
    id: 'event-2',
    type: 'permission_change',
    process: 'access',
    title: 'New skill requesting access',
    detail: 'Permission change pending review',
    observed_at: '2026-07-20T11:00:00.000Z',
  };

  assert.equal(activityNeedsAttention(event), true);
});

test('attention queue ignores incidental failure language inside activity detail', () => {
  const event = {
    id: 'event-gmail-sync',
    type: 'gmail_sync',
    process: 'observe',
    title: 'Synced 20 emails from Gmail',
    detail: 'Renew your expired products, Credit card payment failed',
    observed_at: '2026-07-20T11:00:00.000Z',
  };

  assert.equal(activityNeedsAttention(event), false);
});

test('attention queue does not turn a recall question about conflicts into work', () => {
  const event = {
    id: 'event-conflict-query',
    type: 'recall_completed',
    process: 'recall',
    title: 'Recalled: Are there any conflicting memories?',
    detail: '6 sources found',
    observed_at: '2026-07-20T11:00:00.000Z',
  };

  assert.equal(activityNeedsAttention(event), false);
});

test('attention queue gives actionable system events specific copy', () => {
  const event = {
    id: 'event-permission',
    type: 'permission_request',
    process: 'access',
    title: 'New skill requesting access',
    observed_at: '2026-07-20T11:00:00.000Z',
  };

  assert.deepEqual(activityAttentionPresentation(event), {
    reason: 'Your approval is needed',
    actionLabel: 'Review access',
    action: 'access',
  });
});

test('attention queue preserves an explicit conflict action from the backend', () => {
  const event = {
    id: 'event-conflict',
    type: 'memory_conflict_detected',
    process: 'recall',
    title: 'Release · status',
    observed_at: '2026-07-20T11:00:00.000Z',
    requires_attention: true,
    attention_reason: 'Choose what Pod should treat as current',
    attention_action_label: 'Review conflict',
    attention_action: 'conflict' as const,
  };

  assert.deepEqual(activityAttentionPresentation(event), {
    reason: 'Choose what Pod should treat as current',
    actionLabel: 'Review conflict',
    action: 'conflict',
  });
});

test('attention queue returns every unresolved item newest first', () => {
  const oldest = { id: 'old', type: 'sync_failed', process: 'observe', title: 'Sync failed', observed_at: '2026-07-19T10:00:00.000Z' };
  const newest = { id: 'new', type: 'permission', process: 'access', title: 'Approval required', observed_at: '2026-07-20T10:00:00.000Z' };
  const normal = { id: 'normal', type: 'observe', process: 'observe', title: 'Meeting remembered', observed_at: '2026-07-20T12:00:00.000Z' };

  assert.deepEqual(activityAttentionEvents([oldest, normal, newest]).map(event => event.id), ['new', 'old']);
});
