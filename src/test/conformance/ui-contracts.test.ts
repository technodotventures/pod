// UI backend-contract verification (commits b01d3c5 + 13f7ab4).
//
// The React state machines in OnboardingWizardExpanded and
// EndorsementModal cannot be rendered from this worktree (no jsdom /
// testing-library / vitest installed; dev server forbidden by the
// verification guardrail). What IS testable: the exact HTTP payloads
// each component sends. This catches the "UI sends a shape the route
// rejects" class of defect that surfaced for the webhook receivers.
//
// React rendering + state transitions remain unverified from here.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { appendClaimVersion, readLatestClaimVersion, type ClaimVersionRecord } from 'smartware';

import { buildConformanceApp, fakeOperationId } from './harness.js';

// ─────────────────────────────────────────────────────────────────────
// OnboardingWizardExpanded — every POST it issues across the 8 steps
// ─────────────────────────────────────────────────────────────────────

test('b01d3c5: onboarding step 6 — observe(substrate:coffee, preference) accepted', async () => {
  // Wizard's IntegrationStep onClick posts:
  //   actor_id: 'substrate:coffee', content: 'onboarding: chose <id> as first integration',
  //   scope_alias: 'personal', type: 'preference'
  const { app, teardown } = await buildConformanceApp();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'substrate:coffee',
        operation_id: fakeOperationId(),
        content: 'onboarding: chose google-calendar as first integration',
        scope_alias: 'personal',
        type: 'preference',
      },
    });
    assert.equal(response.statusCode, 200, `expected 200, got ${response.statusCode}: ${response.payload}`);
  } finally {
    await teardown();
  }
});

test('b01d3c5: onboarding step 7 — reflect(target=profile, mode=explicit) accepted', async () => {
  // Wizard's ProfileCompileStep posts:
  //   actor_id: 'user:<slug>', scope: 'self',
  //   target: {type: 'profile', id: 'self'}, mode: 'explicit'
  const { app, teardown } = await buildConformanceApp();
  try {
    // Use the test-seeded user:test actor from the conformance harness
    // (the production wizard uses user:<user_slug>; both are user-typed
    // actors so the route's requireActorAuth treats them identically).
    const response = await app.inject({
      method: 'POST',
      url: '/pod/reflect',
      payload: {
        actor_id: 'user:test',
        operation_id: fakeOperationId(),
        scope: 'self',
        target: { type: 'profile', id: 'self' },
        mode: 'explicit',
      },
    });
    assert.equal(response.statusCode, 200, `expected 200, got ${response.statusCode}: ${response.payload}`);
    const body = response.json() as { target?: { type: string; id: string } };
    assert.equal(body.target?.type, 'profile');
    assert.equal(body.target?.id, 'self');
  } finally {
    await teardown();
  }
});

// ─────────────────────────────────────────────────────────────────────
// EndorsementModal — every POST it issues across the dry-run + commit
// + error-recovery paths
// ─────────────────────────────────────────────────────────────────────

function writeAgentPage(wikiDir: string, slug: string, claimIds: string[]): void {
  const dataDir = path.dirname(wikiDir);
  for (const claimId of claimIds) {
    if (readLatestClaimVersion(dataDir, claimId)) continue;
    const record: ClaimVersionRecord = {
      claim_id: claimId,
      version: 1,
      state: 'active',
      content: `Synthetic content for ${claimId}`,
      claim_type: 'finding',
      claim_role: 'memory',
      author: 'agent',
      epistemic_owner: 'agent',
      fingerprint: `fp_${claimId.replace(/[^a-zA-Z0-9]/g, '')}`,
      confidence: 'low',
      epistemic_tag: 'inference',
      scope: 'pod/conformance-test/personal',
      derived_from: [],
      relations: [],
      created_at: '2026-05-18T10:00:00Z',
      version_at: '2026-05-18T10:00:00Z',
      operation_id: fakeOperationId(),
      actor_id: 'substrate:test',
      tags: [],
    };
    appendClaimVersion(dataDir, record);
  }
  const dir = path.join(wikiDir, 'concepts');
  mkdirSync(dir, { recursive: true });
  const fm = [
    `page_id: "page_${slug}"`,
    `entity: "${slug}"`,
    `category: "concepts"`,
    `author: "agent"`,
    `summary: "Test"`,
    `claim_ids: [${claimIds.map((c) => `"${c}"`).join(', ')}]`,
    `sources_claim_ids: [${claimIds.map((c) => `"${c}"`).join(', ')}]`,
    `compiled_at: "2026-05-18T10:00:00Z"`,
  ].join('\n');
  writeFileSync(path.join(dir, `${slug}.md`), `---\n${fm}\n---\n\n# ${slug}\n`, 'utf-8');
}

test('13f7ab4: modal dry-run request shape (no operation_id) accepted by /pod/revise', async () => {
  // EndorsementModal.runDryRun posts:
  //   target: {type: 'page', id: pageId}, new_state: {author: 'user'},
  //   reason, dry_run: true, actor_id
  // Critically: NO operation_id (the schema gateway rejects dry_run+op_id).
  const { app, dataDir, teardown } = await buildConformanceApp();
  try {
    writeAgentPage(path.join(dataDir, 'wiki'), 'modal-dryrun', ['claim_a', 'claim_b']);
    const response = await app.inject({
      method: 'POST',
      url: '/pod/revise',
      payload: {
        target: { type: 'page', id: 'page_modal-dryrun' },
        new_state: { author: 'user' },
        reason: 'Endorsing this page as my own thinking.',
        dry_run: true,
        actor_id: 'user:test',
      },
    });
    assert.equal(response.statusCode, 200, `expected 200, got ${response.statusCode}: ${response.payload}`);
    const body = response.json() as { cascade_preview_id?: string; cascade?: { claims_reauthored: string[] } };
    assert.match(body.cascade_preview_id ?? '', /^preview_[0-9A-HJKMNP-TV-Z]{26}$/);
    assert.deepEqual(body.cascade?.claims_reauthored, ['claim_a', 'claim_b']);
  } finally {
    await teardown();
  }
});

test('13f7ab4: modal commit request shape (fresh op_id + cascade_preview_id) accepted', async () => {
  // EndorsementModal.onConfirm posts:
  //   target, new_state, reason, actor_id, operation_id (fresh, NOT
  //   from dry-run), cascade_preview_id (from dry-run)
  const { app, dataDir, teardown } = await buildConformanceApp();
  try {
    writeAgentPage(path.join(dataDir, 'wiki'), 'modal-commit', ['claim_x']);
    // Step 1: dry-run to obtain preview_id
    const dry = await app.inject({
      method: 'POST',
      url: '/pod/revise',
      payload: {
        target: { type: 'page', id: 'page_modal-commit' },
        new_state: { author: 'user' },
        reason: 't',
        dry_run: true,
        actor_id: 'user:test',
      },
    });
    assert.equal(dry.statusCode, 200);
    const dryBody = dry.json() as { cascade_preview_id: string };
    // Step 2: commit with fresh op_id (matches modal's newOperationId())
    const commit = await app.inject({
      method: 'POST',
      url: '/pod/revise',
      payload: {
        target: { type: 'page', id: 'page_modal-commit' },
        new_state: { author: 'user' },
        reason: 't',
        operation_id: fakeOperationId(),
        cascade_preview_id: dryBody.cascade_preview_id,
        actor_id: 'user:test',
      },
    });
    assert.equal(commit.statusCode, 200, `expected 200, got ${commit.statusCode}: ${commit.payload}`);
    const commitBody = commit.json() as { status?: string };
    assert.equal(commitBody.status, 'endorsed');
  } finally {
    await teardown();
  }
});

test('13f7ab4: modal generated newOperationId() format matches OperationId pattern', () => {
  // Replay the exact algorithm from EndorsementModal.newOperationId().
  const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const newOperationId = (): string => {
    let body = '';
    for (let i = 0; i < 26; i += 1) {
      body += ULID_ALPHABET[Math.floor(Math.random() * ULID_ALPHABET.length)];
    }
    return `op_${body}`;
  };
  // Generate 100 ids and confirm each matches the spec pattern.
  for (let i = 0; i < 100; i += 1) {
    const id = newOperationId();
    assert.match(id, /^op_[0-9A-HJKMNP-TV-Z]{26}$/, `iteration ${i}: ${id}`);
  }
});
