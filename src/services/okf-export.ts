// OKF (Open Knowledge Format) export.
//
// Projects a Pod's objects (and, optionally, compiled claims) into an
// Open Knowledge Format bundle — a directory of markdown "concept" files
// with YAML frontmatter, organised by source, cross-linked, plus an
// index.md. The bundle is portable: a plain tarball any OKF consumer
// (Google Knowledge Catalog, other agents) can read.
//
// This is a LOSSY projection, not a backup. Smartware's claim graph
// (epistemics, confidence, validity, scopes, grants) is richer than OKF's
// flat concept model — use exportPodData() for fidelity-preserving backups.
//
// Ref: https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing/

import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type Database from 'better-sqlite3';
import { listObjects, listAllObjectReferences, type PodObject, type PodObjectReference } from '../pod/db.js';

/* ── Public types ── */

export interface OkfExportOptions {
  /** Include objects flagged sensitive. Default false — bundles are portable. */
  includeSensitive?: boolean;
  /** Include archived objects. Default false. */
  includeArchived?: boolean;
  /** Resolve compiled claims for an object → rendered markdown lines. Optional;
   *  inject from a route that has SmartwareCore so this module stays db-only. */
  claimsFor?: (objectId: string) => Promise<string[]>;
  /** Stamp written into the bundle manifest. Pass from the caller —
   *  Date.now() is fine in app code (this is not a workflow script). */
  exportedAt?: string;
}

export interface OkfExportResult {
  output_path: string;
  size_bytes: number;
  concept_count: number;
}

/* ── Concept mapping (one PodObject → one OKF concept file) ── */

/** Map a Smartware object kind to an OKF `type` (the one required field). */
function kindToOkfType(kind: string): string {
  const map: Record<string, string> = {
    page: 'Note',
    note: 'Note',
    journal: 'Journal Entry',
    calendar_event: 'Event',
    email: 'Email',
    file: 'Document',
    markdown: 'Document',
    wiki: 'Concept',
    entity: 'Entity',
    skill: 'Skill',
  };
  return map[kind] ?? (kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : 'Concept');
}

/** Plain URL-safe slug (no id suffix) — used for folder buckets. */
function slugPlain(s: string): string {
  return (s || 'misc')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'misc';
}

/** Filename stem for a concept: title slug + short id suffix. Global
 *  uniqueness is still enforced by the caller (see assignPaths). */
function slugify(title: string, id: string): string {
  const suffix = id.replace(/[^a-z0-9]/gi, '').slice(-8) || 'x';
  return `${slugPlain(title)}-${suffix}`;
}

/** Folder bucket for a concept — group by source app, else by type. */
function bucketFor(obj: PodObject): string {
  return slugPlain(obj.source_app ?? kindToOkfType(obj.kind));
}

/** Best-effort plain-text body from an object's content blob. */
function bodyText(obj: PodObject): string {
  const c = obj.content;
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object') {
    const rec = c as Record<string, unknown>;
    for (const k of ['text', 'body', 'summary', 'description', 'notes']) {
      if (typeof rec[k] === 'string' && (rec[k] as string).trim()) return rec[k] as string;
    }
  }
  return obj.summary ?? '';
}

function yamlScalar(s: string): string {
  // Quote if it contains anything that would confuse a YAML parser.
  return /[:#\[\]{}"'\n]|^\s|\s$/.test(s) ? JSON.stringify(s) : s;
}

/** Render one object as an OKF concept markdown document. */
function objectToConcept(
  obj: PodObject,
  relPath: string,
  pathById: Map<string, string>,
  claimLines: string[],
  refs: PodObjectReference[],
): { relPath: string; markdown: string } {
  // ── OKF frontmatter: the spec's canonical fields first, then Smartware
  // extensions (OKF explicitly allows extra frontmatter). ──
  const fm: Array<[string, string | undefined]> = [
    ['type', kindToOkfType(obj.kind)],            // required by OKF
    ['title', obj.title],
    ['description', obj.summary ?? undefined],
    ['resource', obj.source_url ?? `smartware://object/${obj.id}`],
    ['timestamp', obj.updated_at],
    // extensions (namespaced-ish so consumers can ignore them)
    ['smartware_id', obj.id],
    ['source', obj.source_app ?? undefined],
    ['origin', obj.origin ?? undefined],
    ['created', obj.created_at],
  ];

  const lines: string[] = ['---'];
  for (const [k, v] of fm) {
    if (v === undefined || v === '') continue;
    lines.push(`${k}: ${yamlScalar(String(v))}`);
  }
  if (obj.tags.length) {
    lines.push('tags:');
    for (const t of obj.tags) lines.push(`  - ${yamlScalar(t)}`);
  }
  lines.push('---', '');

  // ── Body ──
  lines.push(`# ${obj.title}`, '');
  const body = bodyText(obj).trim();
  if (body) lines.push(body, '');

  // Compiled claims (if a resolver was injected) become a knowledge section.
  if (claimLines.length) {
    lines.push('## Knowledge', '');
    for (const cl of claimLines) lines.push(`- ${cl}`);
    lines.push('');
  }

  // Cross-links → OKF markdown links between concepts, from Smartware's
  // object_references adjacency table. Only link to targets that are in the
  // bundle (filtered/sensitive objects won't be in pathById).
  const links = refs
    .filter(r => pathById.has(r.target_object_id))
    .map(r => ({
      type: r.reference_type,
      title: r.target_title || r.target_object_id,
      rel: relativeLink(relPath, pathById.get(r.target_object_id)!),
    }));
  if (links.length) {
    lines.push('## Related', '');
    for (const l of links) lines.push(`- [${l.title}](${l.rel}) — ${l.type.replace(/_/g, ' ')}`);
    lines.push('');
  }

  return { relPath, markdown: lines.join('\n') };
}

/** Build a relative markdown link from one bundle path to another. */
function relativeLink(from: string, to: string): string {
  const fromParts = dirname(from).split('/');
  const toParts = to.split('/');
  let i = 0;
  while (i < fromParts.length && fromParts[i] === toParts[i]) i++;
  const ups = fromParts.slice(i).map(() => '..');
  return [...ups, ...toParts.slice(i)].join('/') || `./${to}`;
}

/* ── Bundle builder ── */

/**
 * Write an OKF bundle to `${outDir}` and tar it to `${outputPath}`.
 * `outDir` is a scratch directory (removed afterwards).
 */
export async function exportPodAsOkf(
  db: Database.Database,
  outputPath: string,
  outDir: string,
  options: OkfExportOptions = {},
): Promise<OkfExportResult> {
  const objects = listObjects(db, {
    includeArchived: options.includeArchived ?? false,
    limit: 100_000,
  }).filter(o => (options.includeSensitive ? true : !o.sensitive) && !o.redacted_at);

  // First pass: assign every object a stable, GLOBALLY UNIQUE path so
  // cross-links resolve and no concept silently overwrites another.
  const pathById = new Map<string, string>();
  const usedPaths = new Set<string>();
  for (const obj of objects) {
    const stem = join('concepts', bucketFor(obj), slugify(obj.title, obj.id));
    let rel = `${stem}.md`;
    for (let n = 2; usedPaths.has(rel); n++) rel = `${stem}-${n}.md`;
    usedPaths.add(rel);
    pathById.set(obj.id, rel);
  }

  // Pre-fetch the full reference adjacency once, grouped by source object.
  const refsBySource = new Map<string, PodObjectReference[]>();
  for (const r of listAllObjectReferences(db)) {
    const arr = refsBySource.get(r.source_object_id);
    if (arr) arr.push(r); else refsBySource.set(r.source_object_id, [r]);
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  // Second pass: render + write each concept.
  const indexByBucket = new Map<string, Array<{ title: string; path: string }>>();
  for (const obj of objects) {
    const claimLines = options.claimsFor ? await options.claimsFor(obj.id).catch(() => []) : [];
    const relPath = pathById.get(obj.id)!;
    const { markdown } = objectToConcept(obj, relPath, pathById, claimLines, refsBySource.get(obj.id) ?? []);
    const abs = join(outDir, relPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, markdown, 'utf8');
    const bucket = bucketFor(obj);
    if (!indexByBucket.has(bucket)) indexByBucket.set(bucket, []);
    indexByBucket.get(bucket)!.push({ title: obj.title, path: relPath });
  }

  // Root index.md (OKF bundles are browsable; the index is the entry point).
  const idx: string[] = [
    '---',
    'type: Index',
    'title: Pod Knowledge Bundle',
    `description: ${objects.length} concepts exported from Smartware in Open Knowledge Format.`,
    `timestamp: ${options.exportedAt ?? ''}`,
    '---',
    '',
    '# Pod Knowledge Bundle',
    '',
  ];
  for (const [bucket, items] of [...indexByBucket].sort()) {
    idx.push(`## ${bucket}`, '');
    for (const it of items.sort((a, b) => a.title.localeCompare(b.title))) {
      idx.push(`- [${it.title}](${it.path})`);
    }
    idx.push('');
  }
  await writeFile(join(outDir, 'index.md'), idx.join('\n'), 'utf8');

  // Tar the bundle (same approach as exportPodData).
  await new Promise<void>((resolve, reject) => {
    const tar = spawn('tar', ['-czf', outputPath, '-C', outDir, '.'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    tar.stderr.on('data', d => { stderr += String(d); });
    tar.on('close', code => code === 0 ? resolve() : reject(new Error(`tar exited ${code}: ${stderr.trim()}`)));
    tar.on('error', reject);
  });
  await rm(outDir, { recursive: true, force: true });

  return {
    output_path: outputPath,
    size_bytes: statSync(outputPath).size,
    concept_count: objects.length,
  };
}
