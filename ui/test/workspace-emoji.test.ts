import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_WORKSPACE_EMOJI,
  WORKSPACE_EMOJI_OPTIONS,
  workspaceEmojiLabel,
  workspaceRequestErrorMessage,
} from '../src/workspace-emoji';

test('workspace emoji choices are unique, API-safe, and include the default', () => {
  const emojis = WORKSPACE_EMOJI_OPTIONS.map(option => option.emoji);

  assert.equal(new Set(emojis).size, emojis.length);
  assert.ok(emojis.includes(DEFAULT_WORKSPACE_EMOJI));
  assert.ok(emojis.every(emoji => Array.from(emoji).length <= 8));
  assert.equal(workspaceEmojiLabel('🚀'), 'Rocket');
  assert.equal(workspaceEmojiLabel('🪩'), 'Custom icon');
});

test('stale workspace services produce an actionable recovery message', () => {
  const recovery = 'Workspaces are not available in the running Pod. Close and reopen Pod, then try again.';

  assert.equal(workspaceRequestErrorMessage(new TypeError('Failed to fetch'), 'Fallback'), recovery);
  assert.equal(
    workspaceRequestErrorMessage(new Error('Route POST:/pod/workspaces not found'), 'Fallback'),
    recovery,
  );
  assert.equal(workspaceRequestErrorMessage(new Error('Workspace name is required.'), 'Fallback'), 'Workspace name is required.');
  assert.equal(workspaceRequestErrorMessage(null, 'Fallback'), 'Fallback');
});
