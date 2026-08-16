import assert from 'node:assert/strict';
import test from 'node:test';

import { opensInDocs } from '../src/content-routing';

test('authored and imported document artifacts open in Docs', () => {
  assert.equal(opensInDocs('page'), true);
  assert.equal(opensInDocs('markdown'), true);
  assert.equal(opensInDocs('pdf'), true);
});

test('memory artifacts do not become Docs just because they can appear in a list', () => {
  assert.equal(opensInDocs('email'), false);
  assert.equal(opensInDocs('claim'), false);
  assert.equal(opensInDocs('observation'), false);
  assert.equal(opensInDocs('skill'), false);
});

test('user-defined document types open in Docs', () => {
  assert.equal(opensInDocs('research-brief', true), true);
});
