import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

test('representative recall corpus remains green with no forbidden hits', () => {
  const run = spawnSync(
    process.execPath,
    ['scripts/run-benchmark-fixture.mjs', 'benchmarks/recall/representative-v1.json'],
    { cwd: process.cwd(), encoding: 'utf8' },
  );

  assert.equal(run.status, 0, `${run.stderr}\n${run.stdout}`);
  const summary = JSON.parse(run.stdout) as {
    scenarios: number;
    passed: number;
    hit_at_1: number;
    mean_reciprocal_rank: number;
    forbidden_hits: number;
  };
  assert.equal(summary.scenarios, 8);
  assert.equal(summary.passed, 8);
  assert.equal(summary.hit_at_1, 1);
  assert.equal(summary.mean_reciprocal_rank, 1);
  assert.equal(summary.forbidden_hits, 0);
});
