import test from 'node:test';
import assert from 'node:assert/strict';

import { citedEvidenceSources, numberEvidenceSources } from '../services/ask-pod.js';

test('Ask Pod citations include only valid evidence markers in answer order', () => {
  const sources = numberEvidenceSources([
    { id: 'claim:one', type: 'claim', title: 'First claim', claim_id: 'one' },
    { id: 'object:two', type: 'object', title: 'Second object', object_id: 'two' },
  ]);

  assert.deepEqual(sources.map(source => source.marker), ['S1', 'S2']);
  assert.deepEqual(
    citedEvidenceSources('Second fact [S2]. First fact [S1] and again [S2]. Invalid [S99].', sources)
      .map(source => source.id),
    ['object:two', 'claim:one'],
  );
});
