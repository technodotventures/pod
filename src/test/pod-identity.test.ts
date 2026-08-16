import test from 'node:test';
import assert from 'node:assert/strict';

import { inferPodIdFromScopes, selectPodId } from '../pod/pod-identity.js';

test('restored Pod identity is inferred from the dominant existing Smartware scope root', () => {
  const scopes = [
    'pod/local/personal',
    'pod/local/workspace',
    'pod/founder/personal',
    'pod/founder/workspace',
    'pod/founder/apps/gmail',
    'pod/founder/documents',
    'pod/founder/meetings',
  ];

  assert.equal(inferPodIdFromScopes(scopes), 'founder');
  assert.equal(selectPodId({
    requestedId: 'local',
    explicit: false,
    scopeIds: scopes,
  }), 'founder');
});

test('persisted identity wins over defaults and an explicit operator choice wins over both', () => {
  const scopes = ['pod/founder/personal', 'pod/founder/workspace'];

  assert.equal(selectPodId({
    requestedId: 'local',
    explicit: false,
    persistedId: 'restored-pod',
    scopeIds: scopes,
  }), 'restored-pod');

  assert.equal(selectPodId({
    requestedId: 'operator-pod',
    explicit: true,
    persistedId: 'restored-pod',
    scopeIds: scopes,
  }), 'operator-pod');
});

test('ambiguous legacy scope roots do not silently choose an identity', () => {
  const scopes = [
    'pod/alpha/personal',
    'pod/alpha/workspace',
    'pod/beta/personal',
    'pod/beta/workspace',
  ];

  assert.equal(inferPodIdFromScopes(scopes), undefined);
  assert.equal(selectPodId({
    requestedId: 'safe-default',
    explicit: false,
    scopeIds: scopes,
  }), 'safe-default');
});
