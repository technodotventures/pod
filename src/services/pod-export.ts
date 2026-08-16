import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { list as listTar, type ReadEntry } from 'tar';

const BACKUP_FORMAT = 'coffee-pod-backup/v1' as const;
const MANIFEST_NAME = 'backup-manifest.json';
const RESTORE_MARKER_PREFIX = '.coffee-pod-restore-';
const RESTORE_STAGE_PREFIX = '.coffee-pod-restore-stage-';
const RESTORE_ROLLBACK_PREFIX = '.coffee-pod-restore-rollback-';

export const BACKUP_ROOTS = [
  'agents',
  'claims',
  'coffee-clients.json',
  'config.json',
  'evidence',
  'files',
  'integrations',
  'operations',
  'pin.json',
  'pod-objects.json',
  'pod.db',
  'profiles',
  'vault',
  'wiki',
] as const;

type BackupRoot = typeof BACKUP_ROOTS[number];

const DERIVED_ROOTS = new Set([
  'indices',
  'recall',
  'smartware.db',
  'smartware.db-shm',
  'smartware.db-wal',
  'smartware.db-journal',
  'pod.db-shm',
  'pod.db-wal',
  'pod.db-journal',
]);

interface BackupFile {
  path: string;
  size_bytes: number;
  sha256: string;
}

interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  created_at: string;
  files: BackupFile[];
  roots: BackupRoot[];
  contains_private_memory: true;
  contains_connector_credentials: boolean;
}

interface PendingRestore {
  version: 1;
  target_name: string;
  stage_name: string;
  rollback_name: string;
  manifest_sha256: string;
  phase: 'staged' | 'ready';
  created_at: string;
}

export interface ExportResult {
  output_path: string;
  size_bytes: number;
  files: string[];
  file_count: number;
  manifest_sha256: string;
  contains_connector_credentials: boolean;
}

export interface ExportOptions {
  include?: BackupRoot[];
}

export interface StagedRestoreResult {
  status: 'staged';
  restart_required: true;
  file_count: number;
  manifest_sha256: string;
  contains_connector_credentials: boolean;
}

export interface AppliedRestoreResult {
  status: 'none' | 'applied';
  restored_roots?: string[];
  manifest_sha256?: string;
}

function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function restorePaths(targetDir: string): {
  parentDir: string;
  targetName: string;
  markerPath: string;
} {
  const resolved = path.resolve(targetDir);
  const parentDir = path.dirname(resolved);
  const targetName = path.basename(resolved);
  if (!targetName || resolved === parentDir) throw new Error(`Unsafe Pod data directory '${targetDir}'`);
  const identity = sha256(resolved).slice(0, 12);
  return {
    parentDir,
    targetName,
    markerPath: path.join(parentDir, `${RESTORE_MARKER_PREFIX}${targetName}-${identity}.json`),
  };
}

async function writeJsonDurably(filePath: string, value: unknown): Promise<void> {
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, filePath);
  try {
    const directory = await open(path.dirname(filePath), 'r');
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } catch {
    // Some filesystems do not permit syncing directory handles.
  }
}

async function runTar(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`tar exited ${code}: ${stderr.trim()}`));
    });
  });
}

function safeArchivePath(value: string): string | null {
  const normalized = value.replace(/^\.\//, '').replace(/\/$/, '');
  if (!normalized || normalized === '.') return null;
  if (path.isAbsolute(normalized) || normalized.includes('\\')) {
    throw new Error(`Unsafe backup path '${value}'`);
  }
  const segments = normalized.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Unsafe backup path '${value}'`);
  }
  return normalized;
}

function allowedBackupPath(relativePath: string): boolean {
  const topLevel = relativePath.split('/')[0];
  return topLevel === MANIFEST_NAME || (BACKUP_ROOTS as readonly string[]).includes(topLevel!);
}

export function validateBackupArchivePath(value: string): void {
  const safe = safeArchivePath(value);
  if (safe && !allowedBackupPath(safe)) throw new Error(`Backup contains unsupported path '${value}'`);
}

function validateBackupArchiveEntry(entry: ReadEntry): void {
  if (entry.type !== 'File' && entry.type !== 'OldFile' && entry.type !== 'Directory') {
    throw new Error('Backup contains a symbolic link or unsupported archive entry.');
  }

  try {
    validateBackupArchivePath(entry.path);
  } catch (error) {
    // macOS tar stores extended attributes as top-level AppleDouble entries
    // (for example, "._vault"). Validate them against the canonical path they
    // accompany without relaxing traversal or top-level allowlist checks.
    const normalized = entry.path.replace(/^\.\//, '');
    const segments = normalized.split('/');
    const topLevel = segments[0];
    if (!topLevel?.startsWith('._') || topLevel.length === 2) throw error;
    segments[0] = topLevel.slice(2);
    validateBackupArchivePath(segments.join('/'));
  }
}

async function validateBackupArchiveEntries(inputTarball: string): Promise<void> {
  let validationError: unknown;
  await listTar({
    file: inputTarball,
    strict: true,
    onReadEntry: entry => {
      if (validationError) return;
      try {
        validateBackupArchiveEntry(entry);
      } catch (error) {
        validationError = error;
      }
    },
  });
  if (validationError) throw validationError;
}

async function listRegularFiles(root: string, prefix = ''): Promise<string[]> {
  const directory = path.join(root, prefix);
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relative = prefix ? path.posix.join(prefix, entry.name) : entry.name;
    const absolute = path.join(root, relative);
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) throw new Error(`Backup contains symbolic link '${relative}'`);
    if (info.isDirectory()) files.push(...await listRegularFiles(root, relative));
    else if (info.isFile()) files.push(relative);
    else throw new Error(`Backup contains unsupported entry '${relative}'`);
  }
  return files;
}

async function copyTree(source: string, destination: string): Promise<void> {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Refusing to back up symbolic link '${source}'`);
  if (info.isDirectory()) {
    await mkdir(destination, { recursive: true, mode: 0o700 });
    for (const entry of await readdir(source)) {
      await copyTree(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }
  if (!info.isFile()) throw new Error(`Refusing to back up non-file '${source}'`);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await copyFile(source, destination);
}

async function assertHealthyDatabase(db: Database.Database, label: string): Promise<void> {
  const result = db.pragma('quick_check', { simple: true });
  if (result !== 'ok') throw new Error(`${label} failed SQLite quick_check.`);
}

async function buildManifest(stagingDir: string, roots: BackupRoot[]): Promise<BackupManifest> {
  const relativeFiles = (await listRegularFiles(stagingDir))
    .filter(file => file !== MANIFEST_NAME)
    .sort();
  const files: BackupFile[] = [];
  for (const relative of relativeFiles) {
    const raw = await readFile(path.join(stagingDir, relative));
    files.push({ path: relative, size_bytes: raw.length, sha256: sha256(raw) });
  }
  return {
    format: BACKUP_FORMAT,
    created_at: new Date().toISOString(),
    files,
    roots,
    contains_private_memory: true,
    contains_connector_credentials: roots.includes('integrations') || roots.includes('coffee-clients.json'),
  };
}

export async function exportPodData(
  dataDir: string,
  outputPath: string,
  options: ExportOptions = {},
  podDb?: Database.Database,
): Promise<ExportResult> {
  const resolvedDataDir = path.resolve(dataDir);
  const resolvedOutput = path.resolve(outputPath);
  const outputRelative = path.relative(resolvedDataDir, resolvedOutput);
  if (outputRelative && !outputRelative.startsWith('..') && !path.isAbsolute(outputRelative)) {
    const outputRoot = outputRelative.split(path.sep)[0];
    if ((BACKUP_ROOTS as readonly string[]).includes(outputRoot!)) {
      throw new Error(`Backup output cannot be written inside canonical root '${outputRoot}'.`);
    }
  }
  for (const root of options.include ?? []) {
    if (!(BACKUP_ROOTS as readonly string[]).includes(root)) throw new Error(`Backup root '${root}' is unsupported.`);
  }
  const roots = [...new Set(options.include ?? BACKUP_ROOTS)]
    .filter(root => root !== 'pod.db' || podDb !== undefined || existsSync(path.join(dataDir, root)))
    .sort() as BackupRoot[];
  if (roots.length === 0) throw new Error(`No backup roots present in ${dataDir}.`);

  const stagingDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-backup-'));
  try {
    for (const root of roots) {
      const source = path.join(dataDir, root);
      if (root === 'pod.db' && (podDb || existsSync(source))) {
        const sourceDb = podDb ?? new Database(source, { readonly: true, fileMustExist: true });
        try {
          await assertHealthyDatabase(sourceDb, 'Pod database');
          await sourceDb.backup(path.join(stagingDir, root));
        } finally {
          if (!podDb) sourceDb.close();
        }
      } else if (existsSync(source)) {
        await copyTree(source, path.join(stagingDir, root));
      }
    }
    const presentRoots = roots.filter(root => existsSync(path.join(stagingDir, root)));
    if (presentRoots.length === 0) throw new Error(`No backup roots present in ${dataDir}.`);
    const manifest = await buildManifest(stagingDir, presentRoots);
    const manifestRaw = `${JSON.stringify(manifest, null, 2)}\n`;
    await writeFile(path.join(stagingDir, MANIFEST_NAME), manifestRaw, { mode: 0o600 });
    await mkdir(path.dirname(outputPath), { recursive: true, mode: 0o700 });
    await runTar(['-czf', outputPath, '-C', stagingDir, '.']);
    const archive = await stat(outputPath);
    return {
      output_path: outputPath,
      size_bytes: archive.size,
      files: presentRoots,
      file_count: manifest.files.length,
      manifest_sha256: sha256(manifestRaw),
      contains_connector_credentials: manifest.contains_connector_credentials,
    };
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }
}

async function validateExtractedBackup(
  stagingDir: string,
  allowPreservedFiles = false,
): Promise<{ manifest: BackupManifest; manifestHash: string }> {
  const files = await listRegularFiles(stagingDir);
  if (!files.includes(MANIFEST_NAME)) throw new Error('Backup manifest is missing.');
  for (const relative of files) {
    if (!allowPreservedFiles && !allowedBackupPath(relative)) {
      throw new Error(`Backup contains unsupported path '${relative}'`);
    }
  }
  const manifestRaw = await readFile(path.join(stagingDir, MANIFEST_NAME), 'utf8');
  const manifest = JSON.parse(manifestRaw) as BackupManifest;
  if (manifest.format !== BACKUP_FORMAT || !Array.isArray(manifest.files) || !Array.isArray(manifest.roots)) {
    throw new Error('Backup manifest format is unsupported.');
  }
  for (const root of manifest.roots) {
    if (typeof root !== 'string' || !(BACKUP_ROOTS as readonly string[]).includes(root)) {
      throw new Error(`Backup root '${String(root)}' is unsupported.`);
    }
  }
  if (new Set(manifest.roots).size !== manifest.roots.length) throw new Error('Backup manifest contains duplicate roots.');
  for (const file of manifest.files) {
    if (!file || typeof file.path !== 'string' || !Number.isSafeInteger(file.size_bytes)
      || file.size_bytes < 0 || typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error('Backup manifest contains an invalid file record.');
    }
  }
  const expectedPaths = new Set(manifest.files.map(file => file.path));
  if (expectedPaths.size !== manifest.files.length) throw new Error('Backup manifest contains duplicate file paths.');
  const trackedFiles = files.filter(file => {
    if (file === MANIFEST_NAME) return false;
    return manifest.roots.includes(file.split('/')[0] as BackupRoot);
  });
  const actualPaths = new Set(trackedFiles);
  if (expectedPaths.size !== actualPaths.size
    || [...expectedPaths].some(file => !actualPaths.has(file))) {
    throw new Error('Backup file set does not match its manifest.');
  }
  for (const file of manifest.files) {
    if (!safeArchivePath(file.path) || !allowedBackupPath(file.path)) {
      throw new Error(`Backup manifest contains unsafe path '${file.path}'`);
    }
    if (!manifest.roots.includes(file.path.split('/')[0] as BackupRoot)) {
      throw new Error(`Backup file '${file.path}' is outside its declared roots.`);
    }
    const raw = await readFile(path.join(stagingDir, file.path));
    if (raw.length !== file.size_bytes || sha256(raw) !== file.sha256) {
      throw new Error(`Backup checksum mismatch for '${file.path}'`);
    }
  }
  for (const root of manifest.roots) {
    if (!existsSync(path.join(stagingDir, root))) throw new Error(`Backup root '${root}' is missing.`);
  }
  if (manifest.roots.includes('pod.db')) {
    const restoredDbPath = path.join(stagingDir, 'pod.db');
    const restoredDb = new Database(restoredDbPath, { readonly: true, fileMustExist: true });
    try {
      await assertHealthyDatabase(restoredDb, 'Backup Pod database');
    } finally {
      restoredDb.close();
      // A database carrying WAL journal mode may create empty sidecars even
      // when opened read-only. They are derived and never belong in a backup.
      await rm(`${restoredDbPath}-shm`, { force: true });
      await rm(`${restoredDbPath}-wal`, { force: true });
    }
  }
  return { manifest, manifestHash: sha256(manifestRaw) };
}

export async function importPodData(inputTarball: string, targetDir: string): Promise<StagedRestoreResult> {
  if (!existsSync(inputTarball)) throw new Error(`Backup ${inputTarball} not found.`);
  const { parentDir, targetName, markerPath } = restorePaths(targetDir);
  if (existsSync(markerPath)) throw new Error('A restore is already staged; restart the Pod before importing another.');
  await mkdir(parentDir, { recursive: true, mode: 0o700 });
  await mkdir(targetDir, { recursive: true, mode: 0o700 });

  const archiveDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-import-'));
  const stableArchive = path.join(archiveDir, 'backup.tar.gz');
  try {
    await copyFile(inputTarball, stableArchive);
    await validateBackupArchiveEntries(stableArchive);

    const stageName = `${RESTORE_STAGE_PREFIX}${targetName}-${randomUUID()}`;
    const rollbackName = `${RESTORE_ROLLBACK_PREFIX}${targetName}-${randomUUID()}`;
    const stagingDir = path.join(parentDir, stageName);
    await mkdir(stagingDir, { mode: 0o700 });
    try {
      await runTar(['-xzf', stableArchive, '-C', stagingDir]);
      const { manifest, manifestHash } = await validateExtractedBackup(stagingDir);
      const pending: PendingRestore = {
        version: 1,
        target_name: targetName,
        stage_name: stageName,
        rollback_name: rollbackName,
        manifest_sha256: manifestHash,
        phase: 'staged',
        created_at: new Date().toISOString(),
      };
      await writeJsonDurably(markerPath, pending);
      return {
        status: 'staged',
        restart_required: true,
        file_count: manifest.files.length,
        manifest_sha256: manifestHash,
        contains_connector_credentials: manifest.contains_connector_credentials,
      };
    } catch (error) {
      await rm(stagingDir, { recursive: true, force: true });
      throw error;
    }
  } finally {
    await rm(archiveDir, { recursive: true, force: true });
  }
}

function parsePendingRestore(raw: string, targetName: string): PendingRestore {
  const pending = JSON.parse(raw) as Partial<PendingRestore>;
  if (pending.version !== 1
    || pending.target_name !== targetName
    || typeof pending.stage_name !== 'string'
    || !pending.stage_name.startsWith(`${RESTORE_STAGE_PREFIX}${targetName}-`)
    || path.basename(pending.stage_name) !== pending.stage_name
    || typeof pending.rollback_name !== 'string'
    || !pending.rollback_name.startsWith(`${RESTORE_ROLLBACK_PREFIX}${targetName}-`)
    || path.basename(pending.rollback_name) !== pending.rollback_name
    || typeof pending.manifest_sha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(pending.manifest_sha256)
    || (pending.phase !== 'staged' && pending.phase !== 'ready')
    || typeof pending.created_at !== 'string') {
    throw new Error('Pending restore marker is malformed.');
  }
  return pending as PendingRestore;
}

async function removePreservedCopies(stagingDir: string): Promise<void> {
  for (const entry of await readdir(stagingDir)) {
    if (entry === MANIFEST_NAME || (BACKUP_ROOTS as readonly string[]).includes(entry)) continue;
    await rm(path.join(stagingDir, entry), { recursive: true, force: true });
  }
}

async function copyNonCanonicalData(targetDir: string, stagingDir: string): Promise<void> {
  if (!existsSync(targetDir)) return;
  for (const entry of await readdir(targetDir)) {
    if (entry === MANIFEST_NAME
      || DERIVED_ROOTS.has(entry)
      || (BACKUP_ROOTS as readonly string[]).includes(entry)) continue;
    await copyTree(path.join(targetDir, entry), path.join(stagingDir, entry));
  }
}

export async function applyPendingRestore(targetDir: string): Promise<AppliedRestoreResult> {
  const { parentDir, targetName, markerPath } = restorePaths(targetDir);
  if (!existsSync(markerPath)) return { status: 'none' };
  let pending = parsePendingRestore(await readFile(markerPath, 'utf8'), targetName);
  const stagingDir = path.join(parentDir, pending.stage_name);
  const rollbackDir = path.join(parentDir, pending.rollback_name);

  // A crash after the directory swap leaves the new target and rollback in place.
  // Treat that as committed and finish cleanup before any database is opened.
  if (!existsSync(stagingDir) && existsSync(targetDir) && existsSync(rollbackDir)) {
    await rm(path.join(targetDir, MANIFEST_NAME), { force: true });
    await rm(rollbackDir, { recursive: true, force: true });
    await rm(markerPath, { force: true });
    return { status: 'applied', manifest_sha256: pending.manifest_sha256 };
  }
  if (!existsSync(stagingDir)) {
    if (!existsSync(targetDir) && existsSync(rollbackDir)) await rename(rollbackDir, targetDir);
    throw new Error('Pending restore staging directory is missing.');
  }

  if (pending.phase === 'staged') {
    const { manifestHash } = await validateExtractedBackup(stagingDir);
    if (manifestHash !== pending.manifest_sha256) throw new Error('Pending restore manifest changed after staging.');
    await removePreservedCopies(stagingDir);
    await copyNonCanonicalData(targetDir, stagingDir);
    pending = { ...pending, phase: 'ready' };
    await writeJsonDurably(markerPath, pending);
  }

  const { manifest, manifestHash } = await validateExtractedBackup(stagingDir, true);
  if (manifestHash !== pending.manifest_sha256) throw new Error('Pending restore manifest changed after staging.');
  if (existsSync(targetDir) && existsSync(rollbackDir)) {
    throw new Error('Restore cannot continue because both the live and rollback directories exist.');
  }

  try {
    if (existsSync(targetDir)) await rename(targetDir, rollbackDir);
    await rename(stagingDir, targetDir);
  } catch (error) {
    if (!existsSync(targetDir) && existsSync(rollbackDir)) await rename(rollbackDir, targetDir);
    throw error;
  }

  // Keep the manifest inside the staged directory until after the atomic
  // directory swap. A process death before the rename can then resume from a
  // fully verifiable stage; a death after it is handled by the cleanup branch
  // above.
  await rm(path.join(targetDir, MANIFEST_NAME), { force: true });
  await rm(rollbackDir, { recursive: true, force: true });
  await rm(markerPath, { force: true });
  return {
    status: 'applied',
    restored_roots: manifest.roots,
    manifest_sha256: manifestHash,
  };
}
