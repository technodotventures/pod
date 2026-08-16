const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (process.platform !== 'darwin') return;

  // electron-builder rebuilds the project copy of better-sqlite3 for the
  // target Electron ABI, but the app copy is staged before that rebuild and
  // otherwise retains Node's ABI. Install the rebuilt binary into the app's
  // native-module location. The desktop build wrapper restores the project
  // copy only after electron-builder has fully finished, because its final
  // copy phase may run after this hook.
  const projectRoot = path.resolve(__dirname, '..');
  // better-sqlite3 13+ is N-API and ships prebuilt binaries under prebuilds/,
  // named <platform>-<arch>.node, instead of build/Release/better_sqlite3.node.
  const prebuildName = `${context.electronPlatformName === 'darwin' ? 'darwin' : context.electronPlatformName}-${require('builder-util').Arch[context.arch]}.node`;
  const nativeModule = path.join('node_modules', 'better-sqlite3', 'prebuilds', prebuildName);
  const rebuiltSource = path.join(projectRoot, nativeModule);
  const appBundle = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const packagedDestination = path.join(
    appBundle,
    'Contents',
    'Resources',
    context.packager.config.asar === false ? 'app' : 'app.asar.unpacked',
    nativeModule,
  );
  const electronVersion = require(path.join(projectRoot, 'node_modules', 'electron', 'package.json')).version;
  const targetArch = require('builder-util').Arch[context.arch];
  execFileSync(path.join(projectRoot, 'node_modules', '.bin', 'electron-rebuild'), [
    '--version', electronVersion,
    '--arch', targetArch,
    '--force',
    '--which-module', 'better-sqlite3',
    '--module-dir', projectRoot,
  ], { cwd: projectRoot, stdio: 'inherit' });
  if (!fs.existsSync(rebuiltSource) || !fs.existsSync(packagedDestination)) {
    throw new Error('Packaged better-sqlite3 native module is missing.');
  }
  fs.copyFileSync(rebuiltSource, packagedDestination);

  execFileSync('/usr/bin/xattr', ['-cr', context.appOutDir], { stdio: 'inherit' });
};
