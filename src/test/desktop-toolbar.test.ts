import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('expanded top-bar actions opt out of the desktop window drag region', async () => {
  const styles = await readFile('ui/src/styles.css', 'utf8');
  const addActionsRule = styles.match(/\.add-actions\s*\{([^}]*)\}/)?.[1] ?? '';

  assert.match(addActionsRule, /-webkit-app-region:\s*no-drag\s*;/);
});
