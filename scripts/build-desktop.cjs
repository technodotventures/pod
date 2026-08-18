const { spawnSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const target = process.argv[2] || 'dir';
const builder = path.join(projectRoot, 'node_modules', '.bin', 'electron-builder');
let exitCode = 1;

try {
  const result = spawnSync(builder, ['--mac', target], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  exitCode = result.status ?? 1;
} finally {
  // better-sqlite3 13+ is N-API and is no longer rebuilt for Electron, so the
  // development checkout never leaves the current Node ABI.
}

process.exitCode = exitCode;
