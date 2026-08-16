import type Database from 'better-sqlite3';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';

import {
  captureSkillRevision,
  getSkill,
  getSkillByName,
  getSkillByPackageHash,
  getSkillBySource,
  getSkillRevision,
  hashSkillPackage,
  upsertSkill,
  upsertSkillDeployment,
  type PodSkill,
  type PodSkillDeployment,
  type PodSkillRevision,
} from '../pod/db.js';

export type SkillHarness = 'codex' | 'claude-code';

export interface SkillPackage {
  name: string;
  slug: string;
  description: string;
  version: string;
  author: string;
  files: Record<string, string>;
  package_digest: string;
  source_harness: SkillHarness;
  source_path: string;
}

export interface CapturedSkillPackage {
  skill: PodSkill;
  revision: PodSkillRevision;
  created_skill: boolean;
  created_revision: boolean;
}

export interface SkillDeploymentPreview {
  skill_id: string;
  revision_id: string;
  agent_id: string;
  target: SkillHarness;
  target_path: string;
  desired_digest: string;
  observed_digest: string | null;
  action: 'create' | 'none' | 'conflict' | 'blocked';
  can_apply: boolean;
  message: string;
}

const MAX_PACKAGE_FILES = 64;
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
const MAX_FILE_BYTES = 256 * 1024;
const SECRET_FILE = /(^|\/)(\.env($|\.)|credentials?|secrets?|.*\.(pem|p12|pfx|key))$/i;
const SKIPPED_DIRECTORY = new Set(['.git', 'node_modules', '__pycache__', '.venv']);

export function defaultSkillRoot(target: SkillHarness): string {
  if (target === 'codex') {
    const codexHome = process.env['CODEX_HOME']?.trim() || path.join(homedir(), '.codex');
    return path.join(codexHome, 'skills');
  }
  return path.join(homedir(), '.claude', 'skills');
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'skill';
}

function frontmatterValue(markdown: string, key: string): string | undefined {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return undefined;
  const line = match[1].split('\n').find(candidate => candidate.trimStart().startsWith(`${key}:`));
  if (!line) return undefined;
  const value = line.slice(line.indexOf(':') + 1).trim();
  return value.replace(/^['"]|['"]$/g, '').trim() || undefined;
}

function isSafeRelativeFile(filePath: string): boolean {
  if (!filePath || path.isAbsolute(filePath) || filePath.includes('\0')) return false;
  const normalized = filePath.split(path.sep).join('/');
  return !normalized.split('/').some(part => part === '..' || part === '');
}

async function collectPackageFiles(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  let totalBytes = 0;

  async function walk(directory: string, relative = ''): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (Object.keys(files).length >= MAX_PACKAGE_FILES) return;
      if (entry.isSymbolicLink()) continue;
      const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORY.has(entry.name)) await walk(path.join(directory, entry.name), nextRelative);
        continue;
      }
      if (!entry.isFile() || SECRET_FILE.test(nextRelative) || !isSafeRelativeFile(nextRelative)) continue;
      const absolute = path.join(directory, entry.name);
      const stat = await lstat(absolute);
      if (stat.size > MAX_FILE_BYTES || totalBytes + stat.size > MAX_PACKAGE_BYTES) continue;
      const buffer = await readFile(absolute);
      if (buffer.includes(0)) continue;
      totalBytes += buffer.length;
      files[nextRelative] = buffer.toString('utf-8').replace(/\r\n/g, '\n');
    }
  }

  await walk(root);
  return files;
}

async function readPackageDirectory(sourceHarness: SkillHarness, directory: string): Promise<SkillPackage | null> {
  const files = await collectPackageFiles(directory);
  const primary = files['SKILL.md'];
  if (!primary) return null;
  const directoryName = path.basename(directory);
  const name = frontmatterValue(primary, 'name') ?? directoryName;
  const description = frontmatterValue(primary, 'description') ?? '';
  const version = frontmatterValue(primary, 'version') ?? '0.1.0';
  const author = frontmatterValue(primary, 'author') ?? sourceHarness;
  return {
    name,
    slug: slug(name),
    description,
    version,
    author,
    files,
    package_digest: hashSkillPackage({ files }),
    source_harness: sourceHarness,
    source_path: directory,
  };
}

export async function scanSkillSource(sourceHarness: SkillHarness, root = defaultSkillRoot(sourceHarness)): Promise<SkillPackage[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const packages: SkillPackage[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const skillPackage = await readPackageDirectory(sourceHarness, path.join(root, entry.name));
    if (skillPackage) packages.push(skillPackage);
  }
  return packages;
}

export function captureSkillPackage(
  db: Database.Database,
  skillPackage: SkillPackage,
  actorId = 'person-local',
): CapturedSkillPackage {
  const sourceRef = `${skillPackage.source_harness}:${skillPackage.slug}`;
  const exactOrigin = getSkillBySource(db, 'local', sourceRef);
  const samePackage = getSkillByPackageHash(db, skillPackage.package_digest);
  const sameName = getSkillByName(db, skillPackage.name);
  const existing = exactOrigin ?? samePackage ?? sameName;
  const origins = new Set<string>([
    ...((existing?.metadata?.origins as string[] | undefined) ?? []),
    sourceRef,
  ]);
  const canUpdateDraft = !existing || existing.status === 'review' || existing.status === 'possible';
  const skill = upsertSkill(db, {
    id: existing?.id,
    name: existing && !canUpdateDraft ? existing.name : skillPackage.name,
    description: existing && !canUpdateDraft ? existing.description : skillPackage.description,
    version: existing && !canUpdateDraft ? existing.version : skillPackage.version,
    author: existing && !canUpdateDraft ? existing.author : skillPackage.author,
    source: existing?.source ?? 'local',
    source_slug: existing?.source_slug ?? sourceRef,
    scope: existing?.scope ?? 'personal',
    status: existing?.status ?? 'review',
    trust_score: existing?.trust_score ?? 0,
    trust_level: existing?.trust_level ?? 'blocked',
    permissions: existing?.permissions ?? [],
    equipped_to: existing?.equipped_to ?? [],
    portability: existing?.portability ?? 'exportable',
    metadata: {
      ...(existing?.metadata ?? {}),
      origins: [...origins].sort(),
      latest_source_path: skillPackage.source_path,
      latest_source_harness: skillPackage.source_harness,
    },
  });
  const captured = captureSkillRevision(db, {
    skill_id: skill.id,
    version: skillPackage.version,
    files: skillPackage.files,
    origin: 'local',
    source_ref: sourceRef,
    created_by: actorId,
    summary: skillPackage.description,
    status: 'draft',
    metadata: {
      source_harness: skillPackage.source_harness,
      source_path: skillPackage.source_path,
    },
  });
  return {
    skill: getSkill(db, skill.id)!,
    revision: captured.revision,
    created_skill: !existing,
    created_revision: captured.created,
  };
}

function revisionFiles(revision: PodSkillRevision): Record<string, string> | null {
  if (revision.files && Object.keys(revision.files).length > 0) return revision.files;
  if (revision.content?.trim()) return { 'SKILL.md': revision.content };
  return null;
}

async function observedPackageDigest(targetPath: string): Promise<string | null> {
  try {
    const stat = await lstat(targetPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  const files = await collectPackageFiles(targetPath);
  return files['SKILL.md'] ? hashSkillPackage({ files }) : null;
}

export async function previewSkillDeployment(input: {
  db: Database.Database;
  skill_id: string;
  revision_id: string;
  agent_id: string;
  target: SkillHarness;
  target_root?: string;
}): Promise<SkillDeploymentPreview> {
  const skill = getSkill(input.db, input.skill_id);
  const revision = getSkillRevision(input.db, input.skill_id, input.revision_id);
  if (!skill || !revision) throw new Error('skill_revision_not_found');
  if (revision.status !== 'approved') throw new Error('revision_not_approved');
  const files = revisionFiles(revision);
  const targetPath = path.join(input.target_root ?? defaultSkillRoot(input.target), slug(skill.name));
  if (!files) {
    return {
      skill_id: skill.id,
      revision_id: revision.id,
      agent_id: input.agent_id,
      target: input.target,
      target_path: targetPath,
      desired_digest: revision.content_hash,
      observed_digest: null,
      action: 'blocked',
      can_apply: false,
      message: 'The approved revision has no reviewed package files.',
    };
  }
  const observed = await observedPackageDigest(targetPath);
  if (!observed) {
    return {
      skill_id: skill.id,
      revision_id: revision.id,
      agent_id: input.agent_id,
      target: input.target,
      target_path: targetPath,
      desired_digest: revision.content_hash,
      observed_digest: null,
      action: 'create',
      can_apply: true,
      message: 'Ready to create this Skill package.',
    };
  }
  if (observed === revision.content_hash) {
    return {
      skill_id: skill.id,
      revision_id: revision.id,
      agent_id: input.agent_id,
      target: input.target,
      target_path: targetPath,
      desired_digest: revision.content_hash,
      observed_digest: observed,
      action: 'none',
      can_apply: true,
      message: 'The target already has this exact revision.',
    };
  }
  return {
    skill_id: skill.id,
    revision_id: revision.id,
    agent_id: input.agent_id,
    target: input.target,
    target_path: targetPath,
    desired_digest: revision.content_hash,
    observed_digest: observed,
    action: 'conflict',
    can_apply: false,
    message: 'The target contains a different package. Pod will not overwrite it.',
  };
}

export async function applySkillDeployment(input: {
  db: Database.Database;
  skill_id: string;
  revision_id: string;
  agent_id: string;
  target: SkillHarness;
  target_root?: string;
}): Promise<{ preview: SkillDeploymentPreview; deployment: PodSkillDeployment; files_written: string[] }> {
  const preview = await previewSkillDeployment(input);
  if (!preview.can_apply || preview.action === 'blocked' || preview.action === 'conflict') {
    const deployment = upsertSkillDeployment(input.db, {
      skill_id: input.skill_id,
      agent_id: input.agent_id,
      desired_revision_id: input.revision_id,
      status: preview.action === 'conflict' ? 'drifted' : 'blocked',
      adapter: input.target,
      target_path: preview.target_path,
      installed_hash: preview.observed_digest,
      last_error: preview.message,
      checked: true,
    });
    return { preview, deployment, files_written: [] };
  }

  const revision = getSkillRevision(input.db, input.skill_id, input.revision_id)!;
  const files = revisionFiles(revision)!;
  const filesWritten: string[] = [];
  if (preview.action === 'create') {
    const root = path.dirname(preview.target_path);
    await mkdir(root, { recursive: true });
    const temporary = path.join(root, `.pod-deploy-${path.basename(preview.target_path)}-${Date.now()}`);
    try {
      await mkdir(temporary, { recursive: false });
      for (const [relativePath, content] of Object.entries(files)) {
        if (!isSafeRelativeFile(relativePath)) throw new Error(`unsafe_skill_path:${relativePath}`);
        const destination = path.join(temporary, relativePath);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, content, 'utf-8');
        filesWritten.push(relativePath);
      }
      await rename(temporary, preview.target_path);
    } catch (error) {
      await rm(temporary, { recursive: true, force: true });
      throw error;
    }
  }

  const installedHash = await observedPackageDigest(preview.target_path);
  const synced = installedHash === revision.content_hash;
  const deployment = upsertSkillDeployment(input.db, {
    skill_id: input.skill_id,
    agent_id: input.agent_id,
    desired_revision_id: input.revision_id,
    installed_revision_id: synced ? input.revision_id : null,
    status: synced ? 'synced' : 'drifted',
    adapter: input.target,
    target_path: preview.target_path,
    installed_hash: installedHash,
    last_error: synced ? null : 'Deployment verification did not match the approved package digest.',
    checked: true,
  });
  return { preview, deployment, files_written: filesWritten };
}
