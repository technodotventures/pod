# Backup and restore

Pod backups are complete, local snapshots intended for recovery and
moving a Pod between machines. They are different from support diagnostics:
backups contain private user data and may contain connector credentials.

## Desktop flow

Open **Settings → Storage**.

1. Choose **Create backup** and save the `.tar.gz` file somewhere private.
2. To restore, choose **Choose backup** and select a Pod backup.
3. Pod checks the archive structure, every file checksum, and the SQLite
   database before accepting it.
4. Choose **Restart and restore**. Live data is not changed until this restart.

If the process stops during the directory swap, the next start completes or
rolls back the staged restore before opening SQLite or Smartware.

## Snapshot contents

The version 1 backup contains every present canonical root:

- Smartware evidence, claims, wiki pages, operation records, agent data, and
  profiles
- Pod objects, SQLite data, vault documents, and inline attachments
- Pod configuration, device PIN state, Coffee client records, and integration
  configuration

`backup-manifest.json` records the format version, included roots, byte size,
and SHA-256 checksum for every file. Exports use SQLite's online backup API so
the database copy is consistent even while the Pod is running.

Derived search indexes, recall outputs, Smartware's derived SQLite index, and
SQLite sidecar files are not backed up. They are rebuilt from canonical data
after restore. Existing non-canonical support logs and backup exports are
preserved across a restore.

## API flow

Both endpoints require owner authorization.

```text
POST /pod/export
{ "output_dir": "/private/backup/location", "filename": "coffee-pod.tar.gz" }
```

The filename must be a simple `.tar.gz` name. The service refuses to write an
archive inside a canonical Pod root.

```text
POST /pod/import
{ "input_path": "/private/backup/location/coffee-pod.tar.gz", "confirm": true }
```

A successful import response means `status: "staged"` and
`restart_required: true`; it does not mean the live Pod was overwritten. The
next Pod start validates the staged snapshot again, swaps it into place, then
runs database migrations and Smartware recovery.

## Security boundary

- Backups are never uploaded automatically and are not encrypted by Coffee
  Pod. Store them on an encrypted disk or in a trusted encrypted vault.
- Import rejects absolute paths, traversal paths, symbolic links, unsupported
  archive entries, undeclared files, checksum changes, and corrupt SQLite.
- A backup is a full private-data artifact. Do not send it to support; use the
  content-free report under **Settings → Support** instead.
