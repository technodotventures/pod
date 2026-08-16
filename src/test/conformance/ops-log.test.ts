// Operations log canonical surface — round-trip tests.
//
// Covers the basic contract introduced in PR-2 (A0):
//   - OperationId pattern validation rejects malformed IDs
//   - Append → read round-trip preserves entries chronologically
//   - runCommit appends the ops-log entry AFTER the work closure runs
//   - runCommit does NOT append when the work closure throws
//   - Recovery scan returns the committed set
//
// The full kill-process-mid-commit conformance fixture lives in
// kill-mid-commit.test.ts and is skipped pending A3 (PR-4) — those tests
// require L1 versions to carry operation_id so orphan classification can
// run end-to-end.

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendOpLogEntry,
  isValidOperationId,
  loadCommittedOperationIds,
  readAllOpLogEntries,
  runCommit,
  runCommitSync,
  runRecovery,
} from 'smartware';
import type { OpLogEntry } from 'smartware';

function freshOpId(seed: number): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const padded = seed.toString().padStart(26, '0');
  let body = '';
  for (const ch of padded) body += alphabet[parseInt(ch, 10)];
  return `op_${body}`;
}

test('OPERATION_ID_PATTERN: accepts valid op_<ulid> shape, rejects malformed', () => {
  assert.equal(isValidOperationId(freshOpId(1)), true);
  assert.equal(isValidOperationId('op_'), false);
  assert.equal(isValidOperationId('not-an-op'), false);
  assert.equal(isValidOperationId('op_lowercase01234567890123456'), false);
  // Crockford excludes I, L, O, U
  assert.equal(isValidOperationId('op_IIIIIIIIIIIIIIIIIIIIIIIIII'), false);
});

test('ops log: append → readAll round-trip preserves chronological order', async () => {
  const opsDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-opslog-'));

  const entries: OpLogEntry[] = [
    {
      operation_id: freshOpId(10),
      actor_id: 'user:stevie',
      timestamp: '2026-05-17T10:00:00Z',
      op: 'observe',
    },
    {
      operation_id: freshOpId(11),
      actor_id: 'agent:test',
      timestamp: '2026-05-18T10:00:00Z',
      op: 'reflect.explicit',
      details: { page_id: 'page_test' },
    },
    {
      operation_id: freshOpId(12),
      actor_id: 'user:stevie',
      timestamp: '2026-05-18T11:00:00Z',
      op: 'endorse',
      details: { cascade: ['claim_x', 'claim_y'] },
    },
  ];

  for (const entry of entries) appendOpLogEntry(opsDir, entry);

  const readBack = Array.from(readAllOpLogEntries(opsDir));
  assert.equal(readBack.length, 3);
  assert.deepEqual(readBack.map((e) => e.operation_id), entries.map((e) => e.operation_id));
  // Day rollover: entries[0] in 2026-05-17.jsonl; entries[1,2] in 2026-05-18.jsonl
  const day17 = await readFile(path.join(opsDir, '2026-05-17.jsonl'), 'utf-8');
  const day18 = await readFile(path.join(opsDir, '2026-05-18.jsonl'), 'utf-8');
  assert.equal(day17.split('\n').filter(Boolean).length, 1);
  assert.equal(day18.split('\n').filter(Boolean).length, 2);
});

test('ops log: appendOpLogEntry rejects malformed operation_id', async () => {
  const opsDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-opslog-'));
  assert.throws(
    () =>
      appendOpLogEntry(opsDir, {
        operation_id: 'op_not-a-ulid',
        actor_id: 'user:test',
        timestamp: '2026-05-18T10:00:00Z',
        op: 'observe',
      }),
    /does not match/,
  );
});

test('runCommit: work runs before ops-log entry is appended', async () => {
  const opsDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-commit-'));
  const order: string[] = [];

  const result = await runCommit(
    { opsDir },
    {
      operation_id: freshOpId(20),
      actor_id: 'user:test',
      op: 'observe',
    },
    async (commit_ts) => {
      order.push('work-runs');
      // Sanity-check: at this point the ops log file does NOT exist yet.
      const committedSoFar = loadCommittedOperationIds(opsDir);
      order.push(`committed-during-work=${committedSoFar.size}`);
      return { commit_ts };
    },
  );

  // After commit returns, the entry IS present.
  const committedAfter = loadCommittedOperationIds(opsDir);
  order.push(`committed-after=${committedAfter.size}`);

  assert.deepEqual(order, ['work-runs', 'committed-during-work=0', 'committed-after=1']);
  assert.equal(result.value.commit_ts, result.commit_ts);
});

test('runCommit: throw in work closure leaves ops log empty (no partial commit)', async () => {
  const opsDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-commit-throw-'));

  await assert.rejects(
    runCommit(
      { opsDir },
      { operation_id: freshOpId(30), actor_id: 'user:test', op: 'observe' },
      async () => {
        throw new Error('work failed mid-flight');
      },
    ),
    /work failed mid-flight/,
  );

  const committed = loadCommittedOperationIds(opsDir);
  assert.equal(committed.size, 0, 'no entry should be written when work throws');
});

test('runCommitSync: same ops-log-last semantics for sync callers', async () => {
  const opsDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-commit-sync-'));
  const opId = freshOpId(40);
  const result = runCommitSync(
    { opsDir },
    { operation_id: opId, actor_id: 'user:test', op: 'forget' },
    (commit_ts) => commit_ts,
  );
  const committed = loadCommittedOperationIds(opsDir);
  assert.equal(committed.has(opId), true);
  assert.equal(result.value, result.commit_ts);
});

test('runRecovery: returns committed set; no orphans without L1 operation_id (pre-A3)', async () => {
  const opsDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-recovery-'));
  const evidenceDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-evidence-'));
  const quarantineDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-quarantine-'));

  appendOpLogEntry(opsDir, {
    operation_id: freshOpId(50),
    actor_id: 'user:test',
    timestamp: '2026-05-18T10:00:00Z',
    op: 'observe',
  });

  const report = runRecovery({ opsDir, evidenceDir, quarantineDir });
  assert.equal(report.committedOperations, 1);
  // Pre-A3: orphan scan can't run yet because L1 doesn't carry operation_id.
  assert.deepEqual(report.orphans, []);
  assert.deepEqual(report.completed, []);
  assert.deepEqual(report.quarantined, []);
});
