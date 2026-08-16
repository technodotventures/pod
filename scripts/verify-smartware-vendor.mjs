import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
} from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendorRoot = resolve(repositoryRoot, 'vendor/smartware');
const lockPath = resolve(repositoryRoot, 'smartware-vendor.lock.json');

function snapshotFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...snapshotFiles(absolutePath));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function snapshotDigest() {
  const digest = createHash('sha256');
  const files = snapshotFiles(vendorRoot)
    .sort((left, right) => relative(vendorRoot, left).localeCompare(relative(vendorRoot, right)));

  for (const absolutePath of files) {
    const relativePath = relative(vendorRoot, absolutePath).split(sep).join('/');
    const stat = lstatSync(absolutePath);
    const content = stat.isSymbolicLink()
      ? Buffer.from(`symlink:${readlinkSync(absolutePath)}`, 'utf8')
      : readFileSync(absolutePath);
    digest.update(relativePath, 'utf8');
    digest.update('\0');
    digest.update(String(content.length), 'utf8');
    digest.update('\0');
    digest.update(content);
    digest.update('\0');
  }

  return digest.digest('hex');
}

const actualSnapshotDigest = snapshotDigest();
if (process.argv.includes('--print-snapshot')) {
  console.log(actualSnapshotDigest);
  process.exit(0);
}

const failures = [];
const fail = message => failures.push(message);
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const lock = readJson(lockPath);
const rootPackage = readJson(resolve(repositoryRoot, 'package.json'));
const rootPackageLock = readJson(resolve(repositoryRoot, 'package-lock.json'));
const vendorPackage = readJson(resolve(vendorRoot, 'package.json'));

function lockedPath(path, label) {
  if (typeof path !== 'string') {
    fail(`${label} must be a repository-relative path`);
    return null;
  }
  const absolutePath = resolve(repositoryRoot, path);
  if (absolutePath !== vendorRoot && !absolutePath.startsWith(`${vendorRoot}${sep}`)) {
    fail(`${label} must resolve inside vendor/smartware`);
    return null;
  }
  if (!existsSync(absolutePath)) {
    fail(`${label} does not exist: ${path}`);
    return null;
  }
  return absolutePath;
}

if (lock.schema_version !== 1) fail('schema_version must be 1');
if (!/^v\d+\.\d+\.\d+$/u.test(lock.release?.tag ?? '')) {
  fail('release.tag must name a stable semantic version');
}
if (!/^[a-f0-9]{40}$/u.test(lock.release?.commit ?? '')) {
  fail('release.commit must be a full Git commit SHA');
}
if (!/^\d{4}-\d{2}-\d{2}$/u.test(lock.release?.verified_upstream_on ?? '')) {
  fail('release.verified_upstream_on must be an ISO date');
}
if (rootPackage.dependencies?.smartware !== 'file:vendor/smartware') {
  fail('package.json must consume smartware from file:vendor/smartware');
}
if (rootPackageLock.packages?.['']?.dependencies?.smartware !== 'file:vendor/smartware') {
  fail('package-lock.json root dependency must consume file:vendor/smartware');
}
if (rootPackageLock.packages?.['vendor/smartware']?.version !== lock.package?.version) {
  fail('package-lock.json vendor version does not match the vendor lock');
}
if (vendorPackage.name !== lock.package?.name) {
  fail('vendored package name does not match the vendor lock');
}
if (vendorPackage.version !== lock.package?.version) {
  fail('vendored package version does not match the vendor lock');
}
if (lock.release?.tag !== `v${lock.package?.version}`) {
  fail('release tag does not match the vendored package version');
}

const sourceVersion = readFileSync(resolve(vendorRoot, 'src/version.ts'), 'utf8')
  .match(/SMARTWARE_VERSION\s*=\s*['"]([^'"]+)['"]/u)?.[1];
const distVersion = readFileSync(resolve(vendorRoot, 'dist/version.js'), 'utf8')
  .match(/SMARTWARE_VERSION\s*=\s*['"]([^'"]+)['"]/u)?.[1];
if (sourceVersion !== lock.package?.version) {
  fail('src/version.ts does not match the vendor lock');
}
if (distVersion !== lock.package?.version) {
  fail('dist/version.js does not match the vendor lock');
}

const specificationPath = lockedPath(lock.specification?.path, 'specification.path');
if (specificationPath) {
  const specificationDigest = createHash('sha256')
    .update(readFileSync(specificationPath))
    .digest('hex');
  if (specificationDigest !== lock.specification?.sha256) {
    fail('vendored specification digest does not match the vendor lock');
  }
}
lockedPath(lock.protocol?.path, 'protocol.path');
lockedPath(lock.schemas?.directory, 'schemas.directory');
lockedPath(lock.schemas?.checksum_manifest, 'schemas.checksum_manifest');

if (lock.snapshot?.directory !== 'vendor/smartware') {
  fail('snapshot.directory must be vendor/smartware');
}
if (actualSnapshotDigest !== lock.snapshot?.sha256) {
  fail(`vendor snapshot digest mismatch (actual ${actualSnapshotDigest})`);
}

const authority = readFileSync(resolve(repositoryRoot, 'docs/smartware-authority.md'), 'utf8');
const authorityClaims = [
  `\`smartware\` v${lock.package?.version}`,
  `\`${lock.release?.tag}\``,
  `\`${lock.release?.commit}\``,
  `v${lock.specification?.version}; SHA-256 \`${lock.specification?.sha256}\``,
  `Protocol | v${lock.protocol?.version}`,
  `Schemas | v${lock.schemas?.version}`,
];
for (const claim of authorityClaims) {
  if (!authority.includes(claim)) {
    fail(`docs/smartware-authority.md is missing vendor claim: ${claim}`);
  }
}

if (failures.length > 0) {
  console.error('Smartware vendor verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Smartware vendor verified: ${lock.release.tag} @ ${lock.release.commit.slice(0, 12)} `
  + `(snapshot ${actualSnapshotDigest.slice(0, 12)})`,
);
