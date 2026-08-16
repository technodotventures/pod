// L1 JSONL canonical surface (PR-14 / A3 carryover).
//
// Per Spec v1.5.4.2, L1 is canonical, append-only JSONL. Each line is one
// claim VERSION (not just one claim). The SQLite index is derived; the
// JSONL is the source of truth on disk.
//
// File layout: pod_data/claims/YYYY-MM.jsonl (one file per UTC month).
//
// Append discipline:
//   - O_APPEND open. flock optional for concurrent-write safety.
//   - Never modify existing lines.
//   - Old files are immutable once the month rolls over.
//
// Recovery semantics:
//   - Each claim_id can have N versions. Latest version with state=active
//     is the current state. state=forgotten supersedes any active version.
//   - LC-04 catastrophic recovery: if the SQLite index is corrupted or a
//     forgotten version's JSONL line is lost, replay the JSONL + L2
//     tombstones to reconstruct.
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync, } from 'node:fs';
import { join } from 'node:path';
import { backfillClaimVersion } from './migration.js';
function monthFilename(commit_ts) {
    return `${commit_ts.slice(0, 7)}.jsonl`; // YYYY-MM
}
export function claimsJsonlPath(dataDir, commit_ts) {
    return join(dataDir, 'claims', monthFilename(commit_ts));
}
/**
 * Append one ClaimVersionRecord to the canonical L1 JSONL surface. Caller
 * is responsible for stamping `version_at`/`operation_id`/`actor_id` per
 * the A0 single-commit-timestamp pattern.
 */
export function appendClaimVersion(dataDir, record) {
    appendClaimVersions(dataDir, [record]);
}
/** Append claim versions with one filesystem append per monthly file. */
export function appendClaimVersions(dataDir, records) {
    if (records.length === 0)
        return;
    const claimsDir = join(dataDir, 'claims');
    if (!existsSync(claimsDir))
        mkdirSync(claimsDir, { recursive: true, mode: 0o700 });
    const linesByPath = new Map();
    for (const record of records) {
        const recordPath = claimsJsonlPath(dataDir, record.version_at);
        const lines = linesByPath.get(recordPath) ?? [];
        lines.push(JSON.stringify(record));
        linesByPath.set(recordPath, lines);
    }
    for (const [recordPath, lines] of linesByPath) {
        const fd = openSync(recordPath, 'a', 0o600);
        try {
            writeFileSync(fd, lines.join('\n') + '\n', 'utf8');
            fsyncSync(fd);
        }
        finally {
            closeSync(fd);
        }
    }
}
/** Iterate every claim version on disk in chronological order. */
export function* iterAllClaimVersions(dataDir) {
    const claimsDir = join(dataDir, 'claims');
    if (!existsSync(claimsDir))
        return;
    const files = readdirSync(claimsDir)
        .filter((f) => f.endsWith('.jsonl'))
        .sort(); // YYYY-MM lexicographic = chronological
    for (const file of files) {
        const lines = readFileSync(join(claimsDir, file), 'utf-8').split('\n').filter(Boolean);
        for (const [i, line] of lines.entries()) {
            try {
                yield backfillClaimVersion(JSON.parse(line));
            }
            catch {
                throw new Error(`Malformed L1 JSONL at ${file}:${i + 1}`);
            }
        }
    }
}
/** All versions for a given claim_id in version order. */
export function readClaimHistory(dataDir, claimId) {
    const versions = [];
    for (const v of iterAllClaimVersions(dataDir)) {
        if (v.claim_id === claimId)
            versions.push(v);
    }
    return versions.sort((a, b) => a.version - b.version);
}
/** Latest version of a claim_id, or null if none exists. */
export function readLatestVersion(dataDir, claimId) {
    let latest = null;
    for (const v of iterAllClaimVersions(dataDir)) {
        if (v.claim_id !== claimId)
            continue;
        if (!latest || v.version > latest.version)
            latest = v;
    }
    return latest;
}
/** Next version number for a claim_id (1 if no history). */
export function nextVersion(dataDir, claimId) {
    const latest = readLatestVersion(dataDir, claimId);
    return latest ? latest.version + 1 : 1;
}
/**
 * Reconstruct a claim's full snapshot at v(N) — used by tombstone repair
 * and as-of queries (post-beta). Walks the version chain forward and
 * returns the state at the requested version, or the latest if version
 * is omitted.
 */
export function snapshotAt(dataDir, claimId, version) {
    const history = readClaimHistory(dataDir, claimId);
    if (history.length === 0)
        return null;
    if (version === undefined)
        return history[history.length - 1];
    const match = history.find((v) => v.version === version);
    return match ?? null;
}
//# sourceMappingURL=jsonl.js.map