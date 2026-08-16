import assert from 'node:assert/strict';
import test from 'node:test';

import {
  expandTextAroundMatch,
  normalizeRetrievalEvidence,
  reciprocalRankFuseEvidenceCandidates,
  selectDiverseEvidenceCandidates,
} from '../services/retrieval-evidence.js';

test('normalizes different retrieval paths into one provenance-bearing evidence contract', () => {
  const claim = normalizeRetrievalEvidence({
    id: 'claim:claim-1',
    type: 'claim',
    title: 'Release process',
    snippet: 'requires: verify the production bundle',
    scope: 'pod/test/workspace',
    claim_id: 'claim-1',
    entity_id: 'entity-1',
    observation_ids: ['obs-1'],
    score: 0.84,
    confidence: 0.9,
  });
  const observation = normalizeRetrievalEvidence({
    id: 'observation:obs-1',
    type: 'observation',
    title: 'Release process note',
    snippet: 'Verify the production bundle before upload.',
    observation_id: 'obs-1',
    source_app: 'coffee',
    source_id: 'release-note-1',
  });

  assert.equal(claim.text, 'requires: verify the production bundle');
  assert.equal(claim.provenance.claim_id, 'claim-1');
  assert.deepEqual(claim.provenance.observation_ids, ['obs-1']);
  assert.deepEqual(claim.ranking.retrievers, ['lexical']);
  assert.equal(claim.ranking.score, 0.84);
  assert.equal(claim.source_group, observation.source_group);
  assert.equal(claim.instruction_authority, 'none');
  assert.deepEqual(claim.actor, { ids: [], role: 'source' });
  assert.deepEqual(claim.trust, { level: 'unknown', basis: 'source_not_classified' });
  assert.equal(observation.source.app, 'coffee');
  assert.equal(observation.source.external_id, 'release-note-1');
});

test('deduplicates retrieval views and caps source monopolies', () => {
  const selected = selectDiverseEvidenceCandidates([
    { id: 'claim:1', type: 'claim', title: 'Claim', observation_ids: ['obs-1'], retrievers: ['lexical'] },
    { id: 'observation:1', type: 'observation', title: 'Observation', observation_id: 'obs-1', retrievers: ['semantic'] },
    { id: 'object:1', type: 'object', title: 'One', source_app: 'drive', object_id: '1' },
    { id: 'object:2', type: 'object', title: 'Two', source_app: 'drive', object_id: '2' },
    { id: 'object:3', type: 'object', title: 'Three', source_app: 'slack', object_id: '3' },
  ], { limit: 10, maxPerSourceApp: 1 });

  assert.deepEqual(selected.map(row => row.id), ['claim:1', 'object:1', 'object:3']);
  assert.deepEqual(selected[0]!.retrievers, ['lexical', 'semantic']);
});

test('reciprocal-rank fusion rewards consensus across incomparable retrievers', () => {
  const fused = reciprocalRankFuseEvidenceCandidates([
    { id: 'lexical:only', type: 'claim', title: 'Lexical only', source_group: 'source:lexical', retrievers: ['lexical'] },
    { id: 'lexical:shared', type: 'claim', title: 'Shared lexical', source_group: 'source:shared', retrievers: ['lexical'] },
    { id: 'semantic:shared', type: 'claim', title: 'Shared semantic', source_group: 'source:shared', retrievers: ['semantic'] },
    { id: 'semantic:only', type: 'claim', title: 'Semantic only', source_group: 'source:semantic', retrievers: ['semantic'] },
  ]);

  assert.equal(fused[0]!.source_group, 'source:shared');
  assert.deepEqual(fused[0]!.retrievers, ['lexical', 'semantic']);
  assert.ok(fused[0]!.score! > fused[1]!.score!);
});

test('expands only the winning paragraph with bounded adjacent context', () => {
  const expanded = expandTextAroundMatch([
    'Heading and prerequisites.',
    'The release upload failed before the UI bundle existed.',
    'Run the complete build and verify dist-ui before upload.',
    'Unrelated historical appendix.',
  ].join('\n\n'), 'verify dist-ui for the release', 300);

  assert.match(expanded.text, /upload failed/i);
  assert.match(expanded.text, /verify dist-ui/i);
  assert.match(expanded.text, /historical appendix/i);
  assert.doesNotMatch(expanded.text, /Heading and prerequisites/i);
  assert.equal(expanded.text.length <= 300, true);
});
