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
  // electron-builder rebuilds better-sqlite3 for Electron in-place. Always
  // restore the development checkout to the current Node ABI after the entire
  // package/sign/artifact pipeline has finished or failed.
  const restored = spawnSync('npm', ['rebuild', 'better-sqlite3'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  if (restored.error) throw restored.error;
  if (restored.status !== 0 && exitCode === 0) exitCode = restored.status ?? 1;
}

process.exitCode = exitCode;
