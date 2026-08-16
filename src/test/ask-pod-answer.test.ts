import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAskPodFallback,
  numberEvidenceSources,
} from '../services/ask-pod.js';

test('Ask Pod answers a matching profile fact directly without model synthesis', () => {
  const sources = numberEvidenceSources([{
    id: 'profile:self',
    type: 'profile',
    title: 'Your profile',
    profile_id: 'self',
    snippet: [
      'INSTRUCTION: Always call me Sir Stevie',
      'PREFERENCE: Codex discussed the owner\'s favourite-colour question at length.',
      'PREFERENCE: My favourite colour is magenta',
    ].join('\n'),
  }]);

  const fallback = buildAskPodFallback({
    query: 'What is my favorite color?',
    sources,
    scopeIsAll: true,
    providerStatus: 'error',
  });

  assert.equal(fallback.kind, 'profile');
  assert.equal(fallback.answer, 'Your favourite colour is magenta. [S1]');
});

test('Ask Pod gives a warm, useful next step when memory has no relevant answer', () => {
  const fallback = buildAskPodFallback({
    query: 'Where did I leave the spare keys?',
    sources: [],
    scopeIsAll: false,
    providerStatus: 'unavailable',
  });

  assert.equal(fallback.kind, 'no_evidence');
  assert.match(fallback.answer, /don't have anything in Pod that answers that yet/i);
  assert.match(fallback.answer, /All memories/i);
  assert.match(fallback.answer, /Remember that/i);
  assert.doesNotMatch(fallback.answer, /rephras|broaden/i);
});

test('Ask Pod local fallback cites only evidence relevant to the question', () => {
  const sources = numberEvidenceSources([
    {
      id: 'profile:self',
      type: 'profile',
      title: 'Your profile',
      profile_id: 'self',
      snippet: 'INSTRUCTION: Always call me Sir Stevie',
    },
    {
      id: 'object:roadmap',
      type: 'object',
      title: 'Launch roadmap',
      object_id: 'roadmap',
      snippet: 'The launch milestone is scheduled for 18 August.',
    },
  ]);

  const fallback = buildAskPodFallback({
    query: 'When is the launch milestone?',
    sources,
    scopeIsAll: true,
    providerStatus: 'error',
  });

  assert.equal(fallback.kind, 'evidence');
  assert.match(fallback.answer, /Launch roadmap/);
  assert.match(fallback.answer, /\[S2\]/);
  assert.doesNotMatch(fallback.answer, /Sir Stevie/);
});

test('Ask Pod does not answer a different preference that merely shares one word', () => {
  const sources = numberEvidenceSources([{
    id: 'profile:self',
    type: 'profile',
    title: 'Your profile',
    profile_id: 'self',
    snippet: 'PREFERENCE: My favourite colour is magenta',
  }]);

  const fallback = buildAskPodFallback({
    query: 'What is my favourite movie?',
    sources,
    scopeIsAll: true,
    providerStatus: 'unavailable',
  });

  assert.equal(fallback.kind, 'no_evidence');
  assert.doesNotMatch(fallback.answer, /magenta/i);
});
