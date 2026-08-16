import assert from 'node:assert/strict';
import test from 'node:test';

import { groupProfileFacts, profileCorrectionContent, type ProfileFact } from '../src/profile-model';

const facts: ProfileFact[] = [
  { id: 'obs_1', category: 'instruction', text: 'Never invent a citation.', source_ids: ['obs_1'], observed_at: '2026-07-16T01:00:00.000Z', scope: 'personal', origin: 'observation' },
  { id: 'obs_2', category: 'identity', text: 'My timezone is Australia/Melbourne.', source_ids: ['obs_2'], observed_at: '2026-07-16T02:00:00.000Z', scope: 'personal', origin: 'observation' },
];

test('groups profile facts in the stable UI category order', () => {
  assert.deepEqual(groupProfileFacts(facts).map(group => group.category), ['identity', 'instruction']);
});

test('builds a trimmed, target-specific correction observation', () => {
  assert.deepEqual(profileCorrectionContent({
    action: 'replace',
    category: 'preference',
    text: '  Prefer concise answers.  ',
    targetFactId: 'claim_1',
  }), {
    kind: 'profile_correction',
    action: 'replace',
    category: 'preference',
    text: 'Prefer concise answers.',
    target_fact_id: 'claim_1',
  });
});
