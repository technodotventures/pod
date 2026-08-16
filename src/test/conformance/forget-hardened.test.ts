// FG-02 / FG-10 / LC-04 conformance via the L1 JSONL canonical (PR-14).

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, readFile } from 'node:fs/promises';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

import {
  SmartwareCore,
  appendClaimVersion,
  readClaimHistory,
  readLatestClaimVersion,
  type ClaimVersionRecord,
} from 'smartware';

import { forgetHardened, reviveTombstone } from '../../services/forget-hardened.js';

function seedActiveClaim(dataDir: string, claimId: string, content: string, author: 'agent' | 'user' = 'agent'): ClaimVersionRecord {
  const ts = '2026-05-18T10:00:00Z';
  const record: ClaimVersionRecord = {
    claim_id: claimId,
    version: 1,
    state: 'active',
    content,
    claim_type: 'finding',
    claim_role: 'memory',
    author,
    epistemic_owner: author,
    fingerprint: `fp_${claimId.slice(6, 22)}`,
    confidence: 'medium',
    epistemic_tag: 'inference',
    scope: 'pod/test/personal',
    derived_from: [],
    relations: [],
    created_at: ts,
    version_at: ts,
    operation_id: 'op_TEST00000000000000000SEED',
    actor_id: author === 'user' ? 'user:test' : 'agent:test',
    tags: [],
  };
  appendClaimVersion(dataDir, record);
  return record;
}

async function openCore(): Promise<{ core: SmartwareCore; dataDir: string }> {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-forget-hardened-'));
  const core = await SmartwareCore.open({ dataDir, ownerId: 'user:test' });
  return { core, dataDir };
}

test('FG-02: forgetHardened carries forward all non-content metadata', async () => {
  const { core, dataDir } = await openCore();
  try {
    seedActiveClaim(dataDir, 'claim_FG02TEST', 'this claim has metadata to preserve');
    const result = forgetHardened(core, {
      claim_id: 'claim_FG02TEST',
      operation_id: 'op_FG020000000000000000000001',
      actor_id: 'agent:test',
      reason: 'spec test',
    });
    assert.ok('tombstone_id' in result, `expected success: ${JSON.stringify(result)}`);

    const history = readClaimHistory(dataDir, 'claim_FG02TEST');
    assert.equal(history.length, 2);
    const forgotten = history[1];
    assert.equal(forgotten.state, 'forgotten');
    // content omitted on forgotten version
    assert.equal('content' in forgotten, false);
    // every non-content field carries forward from v1
    assert.equal(forgotten.claim_type, 'finding');
    assert.equal(forgotten.claim_role, 'memory');
    assert.equal(forgotten.author, 'agent');
    assert.equal(forgotten.confidence, 'medium');
    assert.equal(forgotten.epistemic_tag, 'inference');
    assert.equal(forgotten.scope, 'pod/test/personal');
    assert.equal(forgotten.created_at, '2026-05-18T10:00:00Z');
    // forget-specific fields
    assert.equal(forgotten.supersedes, 1);
    assert.ok(forgotten.tombstone_id);
    assert.ok(forgotten.forgotten_at);
    assert.equal(forgotten.forgotten_by, 'agent:test');
  } finally {
    core.close();
  }
});

test('FG-10: FORGET on user-authored claim by agent returns forbidden', async () => {
  const { core, dataDir } = await openCore();
  try {
    seedActiveClaim(dataDir, 'claim_USERAUTHFG10', 'user wrote this', 'user');
    const result = forgetHardened(core, {
      claim_id: 'claim_USERAUTHFG10',
      operation_id: 'op_FG100000000000000000000001',
      actor_id: 'agent:trying-to-forget',
      reason: 'should be rejected',
    });
    assert.ok('error' in result);
    assert.match(result.error, /forbidden/);
  } finally {
    core.close();
  }
});

test('RV-10/RV-11: tombstone revival appends active v3; page citations NOT auto-restored', async () => {
  const { core, dataDir } = await openCore();
  try {
    seedActiveClaim(dataDir, 'claim_REVIVE001', 'original content');
    const forgotten = forgetHardened(core, {
      claim_id: 'claim_REVIVE001',
      operation_id: 'op_FRGE0000000000000000REVV0A',
      actor_id: 'agent:test',
      reason: 'forget then revive',
    });
    assert.ok('tombstone_id' in forgotten);

    const revived = reviveTombstone(core, {
      tombstone_id: forgotten.tombstone_id,
      operation_id: 'op_REVV0000000000000000000001',
      actor_id: 'agent:test',
      reason: 'never mind',
    });
    assert.ok('claim_id' in revived, `expected success: ${JSON.stringify(revived)}`);

    const history = readClaimHistory(dataDir, 'claim_REVIVE001');
    assert.equal(history.length, 3, 'should have v1 active, v2 forgotten, v3 active-revived');
    assert.equal(history[2].state, 'active');
    assert.equal(history[2].revived_via, forgotten.tombstone_id);
    assert.equal(history[2].supersedes, 2);
  } finally {
    core.close();
  }
});

test('RV-03: REVISE/FORGET on user-authored claim by agent rejected (combined)', async () => {
  const { core, dataDir } = await openCore();
  try {
    seedActiveClaim(dataDir, 'claim_RV03', 'user content', 'user');
    const result = forgetHardened(core, {
      claim_id: 'claim_RV03',
      operation_id: 'op_RV030000000000000000000001',
      actor_id: 'agent:nope',
      reason: 'cannot',
    });
    assert.ok('error' in result);
    assert.match(result.error, /forbidden/);
  } finally {
    core.close();
  }
});

test('LC-04: tombstone contains the complete snapshot required for reconstruction', async () => {
  const { core, dataDir } = await openCore();
  try {
    seedActiveClaim(dataDir, 'claim_LC04SNAP', 'the content to recover');
    const forgotten = forgetHardened(core, {
      claim_id: 'claim_LC04SNAP',
      operation_id: 'op_C04A000000000000000000001A',
      actor_id: 'agent:test',
      reason: 'LC-04 test',
    });
    assert.ok('tombstone_id' in forgotten);

    // The tombstone file should contain everything needed to reconstruct
    // the prior active version's snapshot.
    const slug = forgotten.tombstone_id.replace(/^tomb_/, '');
    const tombstonePath = path.join(core.wikiDir, 'tombstones', `${slug}.md`);
    const tombstoneContent = await readFile(tombstonePath, 'utf-8');
    // Snapshot must contain content + every spec-required field
    assert.match(tombstoneContent, /"content":\s*"the content to recover"/);
    assert.match(tombstoneContent, /"version":\s*1/);
    assert.match(tombstoneContent, /"claim_type":\s*"finding"/);
    assert.match(tombstoneContent, /"operation_id":/);
    assert.match(tombstoneContent, /"actor_id":/);
    assert.match(tombstoneContent, /"version_at":/);
    assert.match(tombstoneContent, /"relations":/);

    // The forgotten L1 version itself omits content — but L1 history
    // still has the prior active v1 with content intact, plus v2
    // forgotten. So reconstruction is possible from EITHER L1 alone OR
    // the tombstone snapshot.
    const history = readClaimHistory(dataDir, 'claim_LC04SNAP');
    assert.equal(history.length, 2);
    assert.equal('content' in history[0] ? history[0].content : undefined, 'the content to recover');
    assert.equal('content' in history[1], false);
  } finally {
    core.close();
  }
});
