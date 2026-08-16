import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAskPodQueryBody,
  localAskPodSearchTerms,
  type AskPodRequest,
} from '../src/ask-pod-client';

test('Map Ask Pod sends the owner identity required by the query endpoint', () => {
  const request: AskPodRequest = {
    query: 'What connects these memories?',
    history: [
      { role: 'user', content: 'Tell me about the launch plan.' },
      { role: 'assistant', content: 'The launch plan has three milestones.' },
    ],
    scope: {
      visibleNodes: [{ id: 'obj:one', label: 'One', type: 'doc' }],
      visibleEdges: [],
    },
  };

  const body = buildAskPodQueryBody(request);

  assert.equal(body.actor_id, 'person-local');
  assert.equal(body.query, request.query);
  assert.deepEqual(body.history, request.history);
  assert.deepEqual(body.context.object_ids, ['one']);
});

test('local Ask Pod search ignores conversational filler', () => {
  assert.deepEqual(
    localAskPodSearchTerms('What is my favourite colour?'),
    ['favourite', 'colour'],
  );
});
