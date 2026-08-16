import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeDb, getDb } from '../pod/db.js';
import {
  applyPendingRestore,
  exportPodData,
  importPodData,
  validateBackupArchivePath,
} from '../services/pod-export.js';
import { closeSmartwareCore } from '../smartware/core.js';

const execFileAsync = promisify(execFile);

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'backup-test',
    podName: 'Backup Test Pod',
    apiToken: 'cpod_owner_backup_fixture_token',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5200,
  };
}

test('backup is complete and checksummed; restart restores it exactly before databases open', async () => {
  const parentDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-backup-lifecycle-'));
  const dataDir = path.join(parentDir, 'data');
  const archive = path.join(parentDir, 'snapshot.tar.gz');
  const env = testEnv(dataDir);
  await mkdir(path.join(dataDir, 'claims'), { recursive: true });
  await mkdir(path.join(dataDir, 'evidence'), { recursive: true });
  await mkdir(path.join(dataDir, 'files', 'inline'), { recursive: true });
  await mkdir(path.join(dataDir, 'diagnostics'), { recursive: true });
  await writeFile(path.join(dataDir, 'claims', 'memory.txt'), 'BACKED_UP_CLAIM\n');
  await writeFile(path.join(dataDir, 'evidence', 'sentinel.txt'), 'BACKED_UP_EVIDENCE\n');
  await writeFile(path.join(dataDir, 'files', 'inline', 'asset.png'), 'BACKED_UP_FILE');
  await writeFile(path.join(dataDir, 'pin.json'), '{"hash":"original"}\n');
  await writeFile(path.join(dataDir, 'diagnostics', 'events.jsonl'), 'OLD_DIAGNOSTIC\n');

  const db = getDb(env);
  db.exec('CREATE TABLE beta_backup_probe (value TEXT NOT NULL)');
  db.prepare('INSERT INTO beta_backup_probe (value) VALUES (?)').run('BACKED_UP_DATABASE');

  try {
    const exported = await exportPodData(dataDir, archive, {}, db);
    assert.ok(exported.files.includes('claims'));
    assert.ok(exported.files.includes('files'));
    assert.ok(exported.files.includes('pin.json'));
    assert.ok(exported.files.includes('pod.db'));
    assert.ok(exported.file_count >= 5);

    await writeFile(path.join(dataDir, 'claims', 'memory.txt'), 'LIVE_CLAIM_AFTER_BACKUP\n');
    await writeFile(path.join(dataDir, 'evidence', 'future-only.txt'), 'MUST_BE_REMOVED\n');
    await writeFile(path.join(dataDir, 'files', 'inline', 'asset.png'), 'LIVE_FILE_AFTER_BACKUP');
    await writeFile(path.join(dataDir, 'pin.json'), '{"hash":"future"}\n');
    await writeFile(path.join(dataDir, 'diagnostics', 'events.jsonl'), 'CURRENT_DIAGNOSTIC\n');
    await writeFile(path.join(dataDir, 'smartware.db'), 'STALE_DERIVED_DATABASE');

    const staged = await importPodData(archive, dataDir);
    assert.equal(staged.status, 'staged');
    assert.equal(staged.restart_required, true);
    assert.equal(await readFile(path.join(dataDir, 'claims', 'memory.txt'), 'utf8'), 'LIVE_CLAIM_AFTER_BACKUP\n');

    closeDb();
    const app = await buildApp(env, false);
    try {
      assert.equal(await readFile(path.join(dataDir, 'claims', 'memory.txt'), 'utf8'), 'BACKED_UP_CLAIM\n');
      assert.equal(await readFile(path.join(dataDir, 'files', 'inline', 'asset.png'), 'utf8'), 'BACKED_UP_FILE');
      assert.equal(await readFile(path.join(dataDir, 'pin.json'), 'utf8'), '{"hash":"original"}\n');
      assert.equal(await readFile(path.join(dataDir, 'diagnostics', 'events.jsonl'), 'utf8'), 'CURRENT_DIAGNOSTIC\n');
      assert.equal(existsSync(path.join(dataDir, 'evidence', 'future-only.txt')), false);
      const rebuiltSmartwareDb = await readFile(path.join(dataDir, 'smartware.db'));
      assert.equal(rebuiltSmartwareDb.subarray(0, 16).toString('utf8'), 'SQLite format 3\0');

      const restoredDb = getDb(env);
      const probe = restoredDb.prepare('SELECT value FROM beta_backup_probe').get() as { value: string };
      assert.equal(probe.value, 'BACKED_UP_DATABASE');

      const status = await app.inject({
        method: 'GET',
        url: '/pod/status',
        headers: { authorization: `Bearer ${env.apiToken}` },
      });
      assert.equal(status.statusCode, 200, status.payload);
    } finally {
      await app.close();
    }
  } finally {
    await closeSmartwareCore();
    closeDb();
    await rm(parentDir, { recursive: true, force: true });
  }
});

test('backup round-trips invisible Unicode filenames without weakening archive validation', async () => {
  const parentDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-backup-unicode-'));
  const sourceDir = path.join(parentDir, 'source');
  const targetDir = path.join(parentDir, 'target');
  const archive = path.join(parentDir, 'snapshot.tar.gz');
  const fileName = '\u200Bmemory.md';
  const sourceFile = path.join(sourceDir, 'vault', 'docs', fileName);

  try {
    await mkdir(path.dirname(sourceFile), { recursive: true });
    await writeFile(sourceFile, 'UNICODE_FILENAME_MEMORY\n');

    await exportPodData(sourceDir, archive);
    await importPodData(archive, targetDir);
    await applyPendingRestore(targetDir);

    assert.equal(
      await readFile(path.join(targetDir, 'vault', 'docs', fileName), 'utf8'),
      'UNICODE_FILENAME_MEMORY\n',
    );
  } finally {
    await rm(parentDir, { recursive: true, force: true });
  }
});

test('restore resumes after the live directory was moved but before the staged directory was installed', async () => {
  const parentDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-restore-interrupted-'));
  const sourceDir = path.join(parentDir, 'source');
  const targetDir = path.join(parentDir, 'target');
  const archive = path.join(parentDir, 'snapshot.tar.gz');
  await mkdir(path.join(sourceDir, 'claims'), { recursive: true });
  await mkdir(path.join(targetDir, 'claims'), { recursive: true });
  await writeFile(path.join(sourceDir, 'claims', 'memory.jsonl'), 'BACKED_UP\n');
  await writeFile(path.join(targetDir, 'claims', 'memory.jsonl'), 'LIVE\n');

  try {
    await exportPodData(sourceDir, archive);
    await importPodData(archive, targetDir);

    const markerName = (await readdir(parentDir))
      .find(name => name.startsWith('.coffee-pod-restore-target-'));
    assert.ok(markerName);
    const markerPath = path.join(parentDir, markerName);
    const pending = JSON.parse(await readFile(markerPath, 'utf8')) as {
      phase: string;
      rollback_name: string;
    };
    pending.phase = 'ready';
    await writeFile(markerPath, `${JSON.stringify(pending, null, 2)}\n`);
    await rename(targetDir, path.join(parentDir, pending.rollback_name));

    const applied = await applyPendingRestore(targetDir);
    assert.equal(applied.status, 'applied');
    assert.equal(await readFile(path.join(targetDir, 'claims', 'memory.jsonl'), 'utf8'), 'BACKED_UP\n');
    assert.equal(existsSync(path.join(targetDir, 'backup-manifest.json')), false);
    assert.equal(existsSync(markerPath), false);
    assert.equal(existsSync(path.join(parentDir, pending.rollback_name)), false);
  } finally {
    await rm(parentDir, { recursive: true, force: true });
  }
});

test('tampered and symbolic-link backups are rejected without touching live data', async () => {
  const parentDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-backup-reject-'));
  const sourceDir = path.join(parentDir, 'source');
  const targetDir = path.join(parentDir, 'target');
  const validArchive = path.join(parentDir, 'valid.tar.gz');
  const tamperedArchive = path.join(parentDir, 'tampered.tar.gz');
  const symlinkArchive = path.join(parentDir, 'symlink.tar.gz');
  const unpackedDir = path.join(parentDir, 'unpacked');
  const symlinkDir = path.join(parentDir, 'symlink-source');
  await mkdir(path.join(sourceDir, 'claims'), { recursive: true });
  await mkdir(path.join(targetDir, 'claims'), { recursive: true });
  await writeFile(path.join(sourceDir, 'claims', 'memory.jsonl'), 'ORIGINAL_BACKUP\n');
  await writeFile(path.join(targetDir, 'claims', 'memory.jsonl'), 'LIVE_DATA\n');

  try {
    await exportPodData(sourceDir, validArchive);
    await mkdir(unpackedDir);
    await execFileAsync('tar', ['-xzf', validArchive, '-C', unpackedDir]);
    await writeFile(path.join(unpackedDir, 'claims', 'memory.jsonl'), 'TAMPERED\n');
    await execFileAsync('tar', ['-czf', tamperedArchive, '-C', unpackedDir, '.']);
    await assert.rejects(importPodData(tamperedArchive, targetDir), /checksum mismatch/);

    await mkdir(path.join(symlinkDir, 'claims'), { recursive: true });
    await symlink('/tmp', path.join(symlinkDir, 'claims', 'escape'));
    await execFileAsync('tar', ['-czf', symlinkArchive, '-C', symlinkDir, '.']);
    await assert.rejects(importPodData(symlinkArchive, targetDir), /symbolic link|unsupported archive entry/);

    assert.equal(await readFile(path.join(targetDir, 'claims', 'memory.jsonl'), 'utf8'), 'LIVE_DATA\n');
    const siblingNames = await readdir(parentDir);
    assert.equal(siblingNames.some(name => name.startsWith('.coffee-pod-restore-target-')), false);
  } finally {
    await rm(parentDir, { recursive: true, force: true });
  }
});

test('backup paths and output locations cannot escape the allowlist', async () => {
  assert.throws(() => validateBackupArchivePath('../pod.db'), /Unsafe backup path/);
  assert.throws(() => validateBackupArchivePath('/tmp/pod.db'), /Unsafe backup path/);
  assert.throws(() => validateBackupArchivePath('claims\\escape'), /Unsafe backup path/);
  assert.throws(() => validateBackupArchivePath('./exports/private.tar.gz'), /unsupported path/);
  assert.doesNotThrow(() => validateBackupArchivePath('./claims/memory.jsonl'));

  const parentDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-backup-output-'));
  const dataDir = path.join(parentDir, 'data');
  await mkdir(path.join(dataDir, 'claims'), { recursive: true });
  await writeFile(path.join(dataDir, 'claims', 'memory.jsonl'), 'MEMORY\n');
  try {
    await assert.rejects(
      exportPodData(dataDir, path.join(dataDir, 'claims', 'backup.tar.gz')),
      /cannot be written inside canonical root/,
    );
    assert.equal(existsSync(path.join(dataDir, 'claims', 'backup.tar.gz')), false);
  } finally {
    await rm(parentDir, { recursive: true, force: true });
  }
});

test('backup routes are owner-only and describe staged restore semantics', async () => {
  const parentDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-backup-route-'));
  const dataDir = path.join(parentDir, 'data');
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);
  const auth = { authorization: `Bearer ${env.apiToken}` };
  try {
    const blocked = await app.inject({ method: 'POST', url: '/pod/export', payload: {} });
    assert.equal(blocked.statusCode, 401);

    const invalidName = await app.inject({
      method: 'POST',
      url: '/pod/export',
      headers: auth,
      payload: { filename: '../escape.tar.gz' },
    });
    assert.equal(invalidName.statusCode, 400);

    const exported = await app.inject({ method: 'POST', url: '/pod/export', headers: auth, payload: {} });
    assert.equal(exported.statusCode, 200, exported.payload);
    assert.match(exported.json().warning, /private memory/);

    const unconfirmed = await app.inject({
      method: 'POST',
      url: '/pod/import',
      headers: auth,
      payload: { input_path: exported.json().output_path, confirm: false },
    });
    assert.equal(unconfirmed.statusCode, 400);
  } finally {
    await app.close();
    await closeSmartwareCore();
    closeDb();
    await rm(parentDir, { recursive: true, force: true });
  }
});
