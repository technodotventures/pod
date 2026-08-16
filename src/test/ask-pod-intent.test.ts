import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyAskPodIntent } from '../services/ask-pod-intent.js';

test('Ask Pod routes conflict-status and expertise questions to their dedicated retrieval lanes', () => {
  assert.equal(
    classifyAskPodIntent('Are there any conflicting memories?'),
    'conflict_status',
  );
  assert.equal(
    classifyAskPodIntent('Do any of my claims contradict each other?'),
    'conflict_status',
  );
  assert.equal(
    classifyAskPodIntent('Who knows the release process best?'),
    'expertise',
  );
  assert.equal(classifyAskPodIntent('What should I call the owner?'), 'profile');
  assert.equal(classifyAskPodIntent('What is my preferred name?'), 'profile');
  assert.equal(
    classifyAskPodIntent('Summarise the release process'),
    'general',
  );
});
