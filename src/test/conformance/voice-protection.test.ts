// Voice protection conformance tests (PR-15 / B1). VP-01..VP-12.

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { checkVoiceProtection, pageAuthor } from '../../services/voice-protection.js';

function writePage(dir: string, slug: string, author: 'agent' | 'user'): string {
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${slug}.md`);
  writeFileSync(
    filePath,
    `---\npage_id: "page_${slug}"\nauthor: "${author}"\ncategory: "synthesis"\n---\n\n# ${slug}\n\nBody.\n`,
    'utf-8',
  );
  return filePath;
}

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'coffee-pod-voice-'));
}

test('VP-01: agent cannot modify the body of a user-authored page', async () => {
  const dir = await tempDir();
  const filePath = writePage(dir, 'mine', 'user');
  const result = checkVoiceProtection('agent:test', filePath, { kind: 'modify_body' });
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? '', /body/);
});

test('VP-02: agent CAN append to supporting_claims on a user-authored page', async () => {
  const dir = await tempDir();
  const filePath = writePage(dir, 'mine', 'user');
  const result = checkVoiceProtection('agent:test', filePath, { kind: 'append_supporting_claim', claim_id: 'claim_x' });
  assert.equal(result.allowed, true);
});

test('VP-03: agent cannot modify sources (ClaimId list) on user-authored', async () => {
  const dir = await tempDir();
  const filePath = writePage(dir, 'mine', 'user');
  const result = checkVoiceProtection('agent:test', filePath, { kind: 'modify_sources' });
  assert.equal(result.allowed, false);
});

test('VP-04: agent cannot modify intent frontmatter (title/summary) on user-authored', async () => {
  const dir = await tempDir();
  const filePath = writePage(dir, 'mine', 'user');
  const r1 = checkVoiceProtection('agent:test', filePath, { kind: 'modify_intent_frontmatter', field: 'title' });
  assert.equal(r1.allowed, false);
  const r2 = checkVoiceProtection('agent:test', filePath, { kind: 'modify_intent_frontmatter', field: 'summary' });
  assert.equal(r2.allowed, false);
});

test('VP-05: agent CAN post a notice on a user-authored page', async () => {
  const dir = await tempDir();
  const filePath = writePage(dir, 'mine', 'user');
  const result = checkVoiceProtection('agent:test', filePath, { kind: 'post_notice', notice_type: 'staleness' });
  assert.equal(result.allowed, true);
});

test('VP-06: agent CAN update the _index.md entry', async () => {
  const dir = await tempDir();
  const filePath = writePage(dir, 'mine', 'user');
  const result = checkVoiceProtection('agent:test', filePath, { kind: 'update_index_entry' });
  assert.equal(result.allowed, true);
});

test('VP-07: agent CAN update the timestamp on user-authored', async () => {
  const dir = await tempDir();
  const filePath = writePage(dir, 'mine', 'user');
  const result = checkVoiceProtection('agent:test', filePath, { kind: 'update_timestamp' });
  assert.equal(result.allowed, true);
});

test('VP-08: agent CAN modify the body of an AGENT-authored page (no protection)', async () => {
  const dir = await tempDir();
  const filePath = writePage(dir, 'theirs', 'agent');
  const result = checkVoiceProtection('agent:test', filePath, { kind: 'modify_body' });
  assert.equal(result.allowed, true);
});

test('VP-09: user actor bypasses protection entirely', async () => {
  const dir = await tempDir();
  const filePath = writePage(dir, 'mine', 'user');
  const result = checkVoiceProtection('user:owner', filePath, { kind: 'modify_body' });
  assert.equal(result.allowed, true);
});

test('VP-10: missing/unknown author treated as agent-owned (permissive)', async () => {
  // Page without an author: frontmatter → null → permit (agents own
  // the substrate's compiled outputs by default).
  const dir = await tempDir();
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'orphan.md');
  writeFileSync(filePath, `---\npage_id: "page_orphan"\n---\n\nBody.\n`, 'utf-8');
  const result = checkVoiceProtection('agent:test', filePath, { kind: 'modify_body' });
  assert.equal(result.allowed, true);
});

test('VP-11: substrate actor permitted (not a user, not subject to protection)', async () => {
  const dir = await tempDir();
  const filePath = writePage(dir, 'mine', 'user');
  // Substrate is an agent kind from voice-protection's perspective; it
  // still hits the user-page restrictions but allow-list ops succeed.
  const allowed = checkVoiceProtection('substrate:coffee', filePath, { kind: 'append_supporting_claim', claim_id: 'claim_y' });
  assert.equal(allowed.allowed, true);
  const blocked = checkVoiceProtection('substrate:coffee', filePath, { kind: 'modify_body' });
  assert.equal(blocked.allowed, false);
});

test('VP-12: pageAuthor() correctly reads frontmatter `author` field', async () => {
  const dir = await tempDir();
  const a = writePage(dir, 'a', 'agent');
  const u = writePage(dir, 'u', 'user');
  assert.equal(pageAuthor(a), 'agent');
  assert.equal(pageAuthor(u), 'user');
  assert.equal(pageAuthor(path.join(dir, 'does-not-exist.md')), null);
});
