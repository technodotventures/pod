const { execFileSync } = require('node:child_process');

exports.default = async function afterPack(context) {
  if (process.platform !== 'darwin') return;

  // better-sqlite3 13+ is N-API: its prebuilt binary is ABI-stable across
  // Electron versions, so no rebuild or binary substitution is needed.
  // electron-builder stages the package as-is.
  execFileSync('/usr/bin/xattr', ['-cr', context.appOutDir], { stdio: 'inherit' });
};
