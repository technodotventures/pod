import { spawnSync } from 'node:child_process';

const fixtures = [
  'benchmarks/locomo/smoke.json',
  'benchmarks/longmemeval/smoke.json',
];

let failed = false;
for (const fixture of fixtures) {
  const result = spawnSync(
    process.execPath,
    ['scripts/run-benchmark-fixture.mjs', fixture],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
