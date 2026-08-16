import assert from 'node:assert/strict';
import test from 'node:test';

import { documentContentFields } from '../src/document-content';

test('treats top-level string content as canonical markdown text', () => {
  const markdown = '\n## Current Understanding\n\nA complete reflected document.';

  assert.deepEqual(documentContentFields(markdown), {
    text: markdown,
    body: null,
  });
});

test('preserves structured text and body content fields', () => {
  assert.deepEqual(documentContentFields({ text: 'edited', body: 'compiled' }), {
    text: 'edited',
    body: 'compiled',
  });
});
