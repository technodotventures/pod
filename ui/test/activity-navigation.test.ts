import assert from 'node:assert/strict';
import test from 'node:test';

import { activitySourceItems, resolveActivityDestination } from '../src/activity-navigation';

test('a single-file upload resolves to the uploaded object', () => {
  assert.deepEqual(resolveActivityDestination({
    type: 'file_upload',
    content: {
      import_id: 'imp-1',
      files: [{ id: 'obj-upload', title: 'Project handoff' }],
    },
  }, [
    { id: 'obj-upload', collection_id: 'inbox' },
  ]), { kind: 'object', id: 'obj-upload' });
});

test('an event linked to a pod object resolves to that exact object', () => {
  assert.deepEqual(resolveActivityDestination({
    type: 'claim_revised',
    pod_object_id: 'claim-1',
  }, []), { kind: 'object', id: 'claim-1' });
});

test('an aggregate Gmail sync resolves to the Gmail collection', () => {
  assert.deepEqual(resolveActivityDestination({
    type: 'gmail_sync',
    actor_id: 'gmail:connector',
    content: { messages: ['First email', 'Second email'] },
  }, []), { kind: 'collection', id: 'gmail' });
});

test('an aggregate sync exposes exact source items when the event retains them', () => {
  assert.deepEqual(activitySourceItems({
    type: 'gmail_sync',
    content: {
      items: [{
        title: 'Launch timing',
        object_id: 'gmail:message-1',
        source_url: 'https://mail.google.com/mail/u/owner%40example.com/#all/thread-1',
        sender: 'Teammate',
        occurred_at: '2026-07-19T10:00:00.000Z',
      }],
    },
  }), [{
    title: 'Launch timing',
    object_id: 'gmail:message-1',
    source_url: 'https://mail.google.com/mail/u/owner%40example.com/#all/thread-1',
    sender: 'Teammate',
    occurred_at: '2026-07-19T10:00:00.000Z',
  }]);
});

test('legacy Gmail source items use the signed-in default account', () => {
  assert.deepEqual(activitySourceItems({
    type: 'gmail_sync',
    content: {
      items: [{
        title: 'Social Money, thank you for your order.',
        source_url: 'https://mail.google.com/mail/u/google-account/#all/19fd06c93939da01',
      }],
    },
  }), [{
    title: 'Social Money, thank you for your order.',
    source_url: 'https://mail.google.com/mail/u/0/#all/19fd06c93939da01',
  }]);
});

test('older aggregate events still expose their retained message titles', () => {
  assert.deepEqual(activitySourceItems({
    type: 'gmail_sync',
    content: { messages: ['First email', 'Second email'] },
  }), [
    { title: 'First email' },
    { title: 'Second email' },
  ]);
});

test('source items reject unsafe provider links', () => {
  assert.deepEqual(activitySourceItems({
    content: {
      items: [{ title: 'Suspicious email', source_url: 'javascript:alert(1)' }],
    },
  }), [{ title: 'Suspicious email' }]);
});

test('a known source id resolves to the exact matching object', () => {
  assert.deepEqual(resolveActivityDestination({
    type: 'google_drive_observe',
    source_id: 'google-drive:file-1',
  }, [
    { id: 'google-drive:file-1', collection_id: 'google-drive' },
  ]), { kind: 'object', id: 'google-drive:file-1' });
});

test('a multi-file upload resolves to the shared destination collection', () => {
  assert.deepEqual(resolveActivityDestination({
    type: 'file_upload',
    content: {
      files: [{ id: 'obj-one' }, { id: 'obj-two' }],
    },
  }, [
    { id: 'obj-one', collection_id: 'inbox' },
    { id: 'obj-two', collection_id: 'inbox' },
  ]), { kind: 'collection', id: 'inbox' });
});

test('an event without an artifact or source collection has no destination', () => {
  assert.equal(resolveActivityDestination({ type: 'dream_completed' }, []), null);
});
