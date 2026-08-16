/**
 * Vault Writer — syncs Pod objects to Markdown files on disk.
 *
 * Every object upsert writes a .md file with YAML frontmatter to
 * the vault directory. The filesystem becomes the portability/export
 * layer; SQLite remains the primary store for V1.
 *
 * Vault structure:
 *   {dataDir}/vault/
 *     docs/           ← notes, projects, decisions, claims, topics
 *     files/          ← imported file metadata
 *     observations/   ← raw observations
 *     .smartware/     ← system metadata (not user-facing)
 */
import fs from 'node:fs';
import path from 'node:path';

import type { PodObject } from '../pod/db.js';

/* ── Frontmatter contract ── */

interface VaultFrontmatter {
  type: string;
  smartware_id: string;
  origin?: string;
  created_origin?: string;
  last_modified_by?: string;
  sync_status?: string;
  source?: string;
  source_external_id?: string;
  source_url?: string;
  scope?: string;
  status?: string;
  processing_state?: string;
  pod_object_version?: number;
  pod_object_hash?: string;
  tags?: string[];
  belongs_to?: string[];
  related_to?: string[];
  derived_from?: string[];
  mentions?: string[];
  collection?: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/* ── Kind → vault subfolder mapping ── */

const KIND_FOLDERS: Record<string, string> = {
  // Document types → docs/
  page: 'docs',
  note: 'docs',
  markdown: 'docs',
  text: 'docs',
  html: 'docs',
  project: 'docs',
  decision: 'docs',
  claim: 'docs',
  topic: 'docs',
  person: 'docs',
  company: 'docs',
  entity: 'docs',
  skill: 'docs',

  // File types → files/
  file: 'files',
  pdf: 'files',
  document: 'files',
  csv: 'files',
  json: 'files',
  yaml: 'files',
  toml: 'files',
  xml: 'files',
  'google_drive.file': 'files',

  // Observations → observations/
  observation: 'observations',
  source: 'observations',
};

export function folderForKind(kind: string): string {
  return KIND_FOLDERS[kind] ?? 'docs';
}

/* ── Filename sanitization ── */

export function safeFilename(title: string, id: string): string {
  // Clean the title for filesystem use
  let name = title
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')  // remove illegal chars
    .replace(/\s+/g, ' ')                     // collapse whitespace
    .trim()
    .slice(0, 120);                            // cap length

  if (!name) name = id;

  return name;
}

/* ── YAML frontmatter serializer ── */

function serializeFrontmatter(fm: VaultFrontmatter): string {
  const lines: string[] = ['---'];

  // Ordered fields for readability
  const ordered: Array<[string, unknown]> = [
    ['type', fm.type],
    ['smartware_id', fm.smartware_id],
    ['origin', fm.origin],
    ['created_origin', fm.created_origin],
    ['last_modified_by', fm.last_modified_by],
    ['sync_status', fm.sync_status],
    ['source', fm.source],
    ['source_external_id', fm.source_external_id],
    ['source_url', fm.source_url],
    ['scope', fm.scope],
    ['status', fm.status],
    ['processing_state', fm.processing_state],
    ['collection', fm.collection],
    ['pod_object_version', fm.pod_object_version],
    ['pod_object_hash', fm.pod_object_hash],
    ['tags', fm.tags],
    ['belongs_to', fm.belongs_to],
    ['related_to', fm.related_to],
    ['derived_from', fm.derived_from],
    ['mentions', fm.mentions],
    ['created_at', fm.created_at],
    ['updated_at', fm.updated_at],
  ];

  // Add any extra keys not in the ordered list
  const orderedKeys = new Set(ordered.map(([k]) => k));
  for (const [key, value] of Object.entries(fm)) {
    if (!orderedKeys.has(key)) {
      ordered.push([key, value]);
    }
  }

  for (const [key, value] of ordered) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${yamlScalar(String(item))}`);
      }
    } else if (typeof value === 'object') {
      // Skip complex objects in frontmatter
      continue;
    } else {
      lines.push(`${key}: ${yamlScalar(String(value))}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

function yamlScalar(value: string): string {
  // Quote if it contains special YAML chars or looks like a number/bool
  if (/[:#{}[\],&*?|>!%@`]/.test(value) ||
      /^(true|false|yes|no|null|~)$/i.test(value) ||
      /^\d/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

/* ── Extract body text from object content ── */

function extractBody(obj: PodObject): string {
  if (!obj.content) return '';

  const content = obj.content as Record<string, unknown>;

  if (typeof content.text === 'string' && content.text.trim()) {
    return content.text;
  }

  if (typeof content.body === 'string' && content.body.trim()) {
    return content.body;
  }

  if (obj.kind === 'pdf' || obj.kind === 'document') {
    const meta = (obj.metadata ?? {}) as Record<string, unknown>;
    const lines = ['*No text content extracted from this file.*', ''];
    if (meta.mime_type) lines.push(`**Type**: ${meta.mime_type}`);
    if (typeof content.size === 'number') lines.push(`**Size**: ${(content.size / 1024).toFixed(1)} KB`);
    if (typeof meta.pages === 'number') lines.push(`**Pages**: ${meta.pages}`);
    return lines.join('\n');
  }

  return '';
}

/* ── Extract metadata for frontmatter ── */

function buildFrontmatter(obj: PodObject): VaultFrontmatter {
  const meta = (obj.metadata ?? {}) as Record<string, unknown>;
  const refs = (meta.references ?? {}) as Record<string, unknown>;

  const fm: VaultFrontmatter = {
    type: kindToType(obj.kind),
    smartware_id: obj.id,
    origin: obj.origin ?? undefined,
    created_origin: obj.created_origin ?? undefined,
    last_modified_by: obj.last_modified_by ?? undefined,
    sync_status: obj.sync_status ?? undefined,
    source: obj.source_app ?? undefined,
    source_external_id: obj.source_external_id ?? undefined,
    source_url: obj.source_url ?? undefined,
    processing_state: obj.processing_state ?? undefined,
    pod_object_version: obj.version,
    pod_object_hash: obj.sensitive ? undefined : `${obj.hash_algorithm}:${obj.hash_value}`,
    collection: obj.collection_id,
    created_at: obj.created_at,
    updated_at: obj.updated_at,
  };

  // Pull known fields from metadata
  if (typeof meta.scope === 'string') fm.scope = meta.scope;
  if (typeof meta.status === 'string') fm.status = meta.status;
  if (Array.isArray(meta.tags)) fm.tags = meta.tags as string[];
  if (Array.isArray(refs.belongs_to ?? meta.belongs_to)) fm.belongs_to = (refs.belongs_to ?? meta.belongs_to) as string[];
  if (Array.isArray(refs.related_to ?? meta.related_to)) fm.related_to = (refs.related_to ?? meta.related_to) as string[];
  if (Array.isArray(refs.derived_from ?? meta.derived_from)) fm.derived_from = (refs.derived_from ?? meta.derived_from) as string[];
  if (Array.isArray(refs.mentions ?? meta.mentions)) fm.mentions = (refs.mentions ?? meta.mentions) as string[];

  // Pass through frontmatter from imported markdown files
  if (meta.frontmatter && typeof meta.frontmatter === 'object') {
    const imported = meta.frontmatter as Record<string, unknown>;
    for (const [key, value] of Object.entries(imported)) {
      if (!(key in fm) && typeof value === 'string') {
        (fm as Record<string, unknown>)[key] = value;
      }
    }
  }

  return fm;
}

/* ── Kind → user-facing type name ── */

function kindToType(kind: string): string {
  const map: Record<string, string> = {
    page: 'Note',
    note: 'Note',
    markdown: 'Note',
    text: 'Note',
    html: 'Note',
    project: 'Project',
    decision: 'Decision',
    claim: 'Claim',
    topic: 'Topic',
    person: 'Person',
    company: 'Company',
    entity: 'Entity',
    skill: 'Skill',
    source: 'Source',
    observation: 'Observation',
    file: 'File',
    pdf: 'File',
    document: 'File',
    csv: 'File',
    json: 'File',
    yaml: 'File',
    'google_drive.file': 'File',
  };
  return map[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

/* ── Public API ── */

/**
 * Write a Pod object to the vault as a Markdown file.
 * Called as a side-effect of upsertObject — fire-and-forget, never blocks the DB write.
 */
export function writeObjectToVault(dataDir: string, obj: PodObject): void {
  try {
    const vaultDir = path.join(dataDir, 'vault');
    const subfolder = folderForKind(obj.kind);
    const dir = obj.collection_id && !['inbox', 'archive'].includes(obj.collection_id)
      ? path.join(vaultDir, subfolder, safeFilename(obj.collection_id, obj.collection_id))
      : path.join(vaultDir, subfolder);

    fs.mkdirSync(dir, { recursive: true });

    const filename = safeFilename(obj.title, obj.id) + '.md';
    const filePath = path.join(dir, filename);

    const frontmatter = buildFrontmatter(obj);
    const body = extractBody(obj);

    const content = [
      serializeFrontmatter(frontmatter),
      '',
      `# ${obj.title}`,
      '',
      body,
      '',
    ].join('\n');

    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (error) {
    // Never throw — vault write is best-effort
    console.warn('[vault-writer] Failed to write:', obj.id, error);
  }
}

/**
 * Delete a vault file for a Pod object.
 * Best-effort — if the file doesn't exist or can't be deleted, log and move on.
 */
export function deleteObjectFromVault(dataDir: string, obj: PodObject): void {
  try {
    const vaultDir = path.join(dataDir, 'vault');
    const subfolder = folderForKind(obj.kind);
    const dir = obj.collection_id && !['inbox', 'archive'].includes(obj.collection_id)
      ? path.join(vaultDir, subfolder, safeFilename(obj.collection_id, obj.collection_id))
      : path.join(vaultDir, subfolder);
    const filename = safeFilename(obj.title, obj.id) + '.md';
    const filePath = path.join(dir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn('[vault-writer] Failed to delete:', obj.id, error);
  }
}

/**
 * Ensure the vault directory structure exists.
 */
export function initVault(dataDir: string): void {
  const vaultDir = path.join(dataDir, 'vault');
  for (const sub of ['docs', 'files', 'observations', '.smartware']) {
    fs.mkdirSync(path.join(vaultDir, sub), { recursive: true });
  }
}
