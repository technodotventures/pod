import crypto from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  lstat,
  readFile,
  readdir,
  realpath,
  stat,
} from 'node:fs/promises';
import type Database from 'better-sqlite3';
import type { SmartwareCore } from 'smartware';

import {
  DEFAULT_WORKSPACE_ID,
  captureSkillRevision,
  createImport,
  deleteSkill,
  getAgent,
  getImport,
  listImports,
  patchObject,
  replaceSkillBindings,
  updateImport,
  upsertAgent,
  upsertCollection,
  upsertObject,
  upsertSkill,
  type PodAgent,
} from '../pod/db.js';
import { retireArtifactMemory, syncArtifactMemory } from './artifact-memory.js';

const PLAN_FORMAT = 'coffee-pod-openclaw-migration-plan/v1' as const;
const RECEIPT_FORMAT = 'coffee-pod-agent-migration-receipt/v1' as const;
const INSTRUCTION_SET_FORMAT = 'coffee-pod-instruction-set/v1' as const;
const SKILL_PACKAGE_FORMAT = 'coffee-pod-skill-package/v1' as const;
const MAX_TEXT_FILE_BYTES = 1024 * 1024;
const MAX_MEMORY_FILES = 500;
const MAX_SKILL_FILES = 100;
const MAX_SKILL_PACKAGE_BYTES = 2 * 1024 * 1024;
const TEXT_SKILL_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.yaml', '.yml', '.toml',
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.py',
  '.sh', '.bash', '.zsh', '.html', '.css', '.svg',
]);
const SKIPPED_DIRECTORY_NAMES = new Set([
  '.git', 'node_modules', '__pycache__', 'dist', 'build',
]);
const HIGH_CONFIDENCE_SECRET = [
  /\b(?:cpod_agent_|sk-(?:ant-|or-)?|gh[pousr]_|xox[baprs]-)[A-Za-z0-9._-]{8,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|refresh[_-]?token)\s*[:=]\s*["']?(?!\$\{|<|your-|replace-)[A-Za-z0-9_./+=-]{16,}/i,
];

type MigrationItemKind = 'instruction' | 'memory' | 'skill' | 'runtime';
type ConflictResolution = 'keep' | 'use_incoming';

export interface OpenClawMigrationSkipped {
  path: string;
  reason:
    | 'credential_or_runtime_state_excluded'
    | 'possible_secret'
    | 'unsupported_runtime_artifact'
    | 'unsupported_file_type'
    | 'unsafe_symlink'
    | 'size_limit'
    | 'unreadable';
  detail: string;
}

export interface OpenClawMigrationConflict {
  id: string;
  field: string;
  current: string;
  incoming: string;
  options: ConflictResolution[];
  default_resolution: 'keep';
}

export interface OpenClawMigrationItem {
  id: string;
  kind: MigrationItemKind;
  slot: string;
  source_path: string;
  title: string;
  bytes: number;
  digest: string;
  action: 'import' | 'no_change' | 'resolve_conflict' | 'review_before_enable';
  conflict_id?: string;
}

export interface OpenClawMigrationPlan {
  format: typeof PLAN_FORMAT;
  plan_id: string;
  plan_digest: string;
  source: {
    kind: 'openclaw';
    root_label: string;
    workspace: string;
  };
  target: {
    agent_id: string;
    harness: 'hermes';
    memory_scope: string;
  };
  items: OpenClawMigrationItem[];
  conflicts: OpenClawMigrationConflict[];
  skipped: OpenClawMigrationSkipped[];
  summary: {
    instructions: number;
    memories: number;
    skills: number;
    runtime_preferences: number;
    conflicts: number;
    skipped: number;
  };
  warnings: string[];
}

export interface PortableInstructionSlot {
  content: string;
  digest: string;
  source: {
    harness: 'openclaw';
    path: string;
  };
}

export interface PortableInstructionSet {
  format: typeof INSTRUCTION_SET_FORMAT;
  slots: Partial<Record<'soul' | 'agents' | 'identity', PortableInstructionSlot>>;
}

export interface PortableSkillPackageFile {
  path: string;
  encoding: 'utf8';
  digest: string;
  content: string;
}

export interface PortableSkillPackage {
  format: typeof SKILL_PACKAGE_FORMAT;
  entrypoint: 'SKILL.md';
  digest: string;
  files: PortableSkillPackageFile[];
}

interface DiscoveredDocument {
  item: OpenClawMigrationItem;
  content: string;
}

interface DiscoveredSkill {
  item: OpenClawMigrationItem;
  name: string;
  description: string;
  package: PortableSkillPackage;
}

interface Discovery {
  plan: OpenClawMigrationPlan;
  instructions: DiscoveredDocument[];
  memories: DiscoveredDocument[];
  skills: DiscoveredSkill[];
  runtime: {
    preferred_model?: string;
  };
}

interface ReceiptAgentValue {
  persona: string | null;
  model: string | null;
  portable_instructions?: unknown;
  runtime_preferences?: unknown;
}

export interface AgentMigrationReceipt {
  format: typeof RECEIPT_FORMAT;
  id: string;
  source: 'openclaw';
  target: 'pod+hermes';
  agent_id: string;
  workspace_id: string;
  memory_scope: string;
  plan_id: string;
  plan_digest: string;
  source_snapshot: {
    root_label: string;
    workspace: string;
  };
  resolutions: Record<string, ConflictResolution>;
  changed_profile_fields: string[];
  created_object_ids: string[];
  created_skill_ids: string[];
  observation_ids: string[];
  applied_at: string;
  rollback: {
    available: boolean;
    rolled_back_at: string | null;
    warnings: string[];
  };
}

interface ReceiptRollbackState {
  previous_agent: ReceiptAgentValue;
  applied_agent: ReceiptAgentValue;
}

export class OpenClawMigrationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'OpenClawMigrationError';
  }
}

function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cloneValue<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

function equalValue(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function expandSourcePath(sourcePath?: string): string {
  const selected = sourcePath?.trim() || path.join(homedir(), '.openclaw');
  if (selected.includes('\0')) {
    throw new OpenClawMigrationError('invalid_source_path', 'The OpenClaw source path is invalid.');
  }
  if (selected === '~') return homedir();
  if (selected.startsWith('~/')) return path.join(homedir(), selected.slice(2));
  return path.resolve(selected);
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function isDirectory(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}

function relativeLabel(root: string, candidate: string): string {
  const relative = path.relative(root, candidate);
  return relative.split(path.sep).join('/');
}

function containsSecret(content: string): boolean {
  return HIGH_CONFIDENCE_SECRET.some(pattern => pattern.test(content));
}

async function readSafeText(
  root: string,
  filePath: string,
  skipped: OpenClawMigrationSkipped[],
): Promise<string | null> {
  const label = relativeLabel(root, filePath);
  try {
    const fileStat = await lstat(filePath);
    if (fileStat.isSymbolicLink()) {
      skipped.push({
        path: label,
        reason: 'unsafe_symlink',
        detail: 'Symbolic links are not followed during migration.',
      });
      return null;
    }
    if (!fileStat.isFile()) return null;
    if (fileStat.size > MAX_TEXT_FILE_BYTES) {
      skipped.push({
        path: label,
        reason: 'size_limit',
        detail: `Text files must be ${MAX_TEXT_FILE_BYTES} bytes or smaller.`,
      });
      return null;
    }
    const resolved = await realpath(filePath);
    if (!inside(root, resolved)) {
      skipped.push({
        path: label,
        reason: 'unsafe_symlink',
        detail: 'The resolved file path leaves the selected OpenClaw directory.',
      });
      return null;
    }
    const buffer = await readFile(resolved);
    if (buffer.includes(0)) {
      skipped.push({
        path: label,
        reason: 'unsupported_file_type',
        detail: 'Binary files are not imported by this migration version.',
      });
      return null;
    }
    const content = buffer.toString('utf8');
    if (containsSecret(content)) {
      skipped.push({
        path: label,
        reason: 'possible_secret',
        detail: 'The file may contain a credential, so its content was not read into the plan.',
      });
      return null;
    }
    return content;
  } catch {
    skipped.push({
      path: label,
      reason: 'unreadable',
      detail: 'The file could not be read safely.',
    });
    return null;
  }
}

async function readSafeConfig(
  root: string,
  filePath: string,
  skipped: OpenClawMigrationSkipped[],
): Promise<Record<string, unknown> | null> {
  const label = relativeLabel(root, filePath);
  try {
    const fileStat = await lstat(filePath);
    if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
      skipped.push({
        path: label,
        reason: 'unsafe_symlink',
        detail: 'Configuration symbolic links are not followed during migration.',
      });
      return null;
    }
    if (fileStat.size > MAX_TEXT_FILE_BYTES) {
      skipped.push({
        path: label,
        reason: 'size_limit',
        detail: `Configuration files must be ${MAX_TEXT_FILE_BYTES} bytes or smaller.`,
      });
      return null;
    }
    const resolved = await realpath(filePath);
    if (!inside(root, resolved)) {
      skipped.push({
        path: label,
        reason: 'unsafe_symlink',
        detail: 'The resolved configuration path leaves the selected OpenClaw directory.',
      });
      return null;
    }
    const parsed = JSON.parse(await readFile(resolved, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('configuration root is not an object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    skipped.push({
      path: label,
      reason: 'unreadable',
      detail: 'The OpenClaw configuration was not valid JSON.',
    });
    return null;
  }
}

function instructionSlot(fileName: string): 'soul' | 'agents' | 'identity' {
  if (fileName === 'SOUL.md') return 'soul';
  if (fileName === 'AGENTS.md') return 'agents';
  return 'identity';
}

function memorySlot(fileName: string): string {
  if (fileName === 'USER.md') return 'user_profile';
  if (fileName === 'MEMORY.md') return 'long_term';
  return 'daily_memory';
}

function item(
  kind: MigrationItemKind,
  slot: string,
  sourcePath: string,
  title: string,
  content: string,
  action: OpenClawMigrationItem['action'],
): OpenClawMigrationItem {
  const digest = sha256(content);
  return {
    id: `migitem_${digest.slice(0, 24)}`,
    kind,
    slot,
    source_path: sourcePath,
    title,
    bytes: Buffer.byteLength(content),
    digest,
    action,
  };
}

async function resolveWorkspace(
  root: string,
  requestedWorkspace?: string,
): Promise<{ workspaceRoot: string; workspaceLabel: string }> {
  const rootLooksLikeWorkspace = await Promise.all([
    'SOUL.md', 'AGENTS.md', 'MEMORY.md', 'USER.md',
  ].map(name => isFile(path.join(root, name))));
  if (rootLooksLikeWorkspace.some(Boolean)) {
    return { workspaceRoot: root, workspaceLabel: path.basename(root) };
  }

  if (requestedWorkspace) {
    if (!/^[A-Za-z0-9._-]+$/.test(requestedWorkspace)) {
      throw new OpenClawMigrationError(
        'invalid_workspace',
        'workspace must be a single OpenClaw workspace name, not a path.',
      );
    }
    const names = requestedWorkspace.startsWith('workspace')
      ? [requestedWorkspace]
      : requestedWorkspace === 'default'
        ? ['workspace']
        : [`workspace-${requestedWorkspace}`, requestedWorkspace];
    for (const name of names) {
      const candidate = path.join(root, name);
      if (await isDirectory(candidate)) {
        return { workspaceRoot: await realpath(candidate), workspaceLabel: name };
      }
    }
    throw new OpenClawMigrationError(
      'workspace_not_found',
      `OpenClaw workspace "${requestedWorkspace}" was not found under the selected source.`,
      404,
    );
  }

  const defaultWorkspace = path.join(root, 'workspace');
  if (await isDirectory(defaultWorkspace)) {
    return { workspaceRoot: await realpath(defaultWorkspace), workspaceLabel: 'workspace' };
  }
  const candidates = (await readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && entry.name.startsWith('workspace-'))
    .map(entry => entry.name)
    .sort();
  if (candidates.length === 1) {
    return {
      workspaceRoot: await realpath(path.join(root, candidates[0]!)),
      workspaceLabel: candidates[0]!,
    };
  }
  if (candidates.length > 1) {
    throw new OpenClawMigrationError(
      'workspace_required',
      `Multiple OpenClaw workspaces were found (${candidates.join(', ')}). Choose one explicitly.`,
      409,
    );
  }
  throw new OpenClawMigrationError(
    'workspace_not_found',
    'No OpenClaw workspace was found in the selected source directory.',
    404,
  );
}

async function walkTextFiles(
  root: string,
  directory: string,
  skipped: OpenClawMigrationSkipped[],
  limit: number,
): Promise<string[]> {
  const files: string[] = [];
  async function visit(current: string): Promise<void> {
    if (files.length >= limit) return;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      skipped.push({
        path: relativeLabel(root, current),
        reason: 'unreadable',
        detail: 'The directory could not be inspected safely.',
      });
      return;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (files.length >= limit) break;
      const candidate = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        skipped.push({
          path: relativeLabel(root, candidate),
          reason: 'unsafe_symlink',
          detail: 'Symbolic links are not followed during migration.',
        });
      } else if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORY_NAMES.has(entry.name)) await visit(candidate);
      } else if (entry.isFile()) {
        files.push(candidate);
      }
    }
  }
  if (await isDirectory(directory)) await visit(directory);
  return files;
}

function parseSkillHeader(content: string, fallbackName: string): { name: string; description: string } {
  const header = content.startsWith('---\n')
    ? content.slice(4, content.indexOf('\n---', 4) >= 0 ? content.indexOf('\n---', 4) : 4)
    : '';
  const fields = new Map<string, string>();
  for (const line of header.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (match) fields.set(match[1]!.toLowerCase(), match[2]!.trim().replace(/^["']|["']$/g, ''));
  }
  return {
    name: fields.get('name') || fallbackName,
    description: fields.get('description') || 'Imported OpenClaw skill. Review before enabling.',
  };
}

async function discoverSkillRoot(
  root: string,
  skillRoot: string,
  skipped: OpenClawMigrationSkipped[],
): Promise<DiscoveredSkill[]> {
  if (!await isDirectory(skillRoot)) return [];
  const entries = (await readdir(skillRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && !entry.isSymbolicLink())
    .sort((left, right) => left.name.localeCompare(right.name));
  const discovered: DiscoveredSkill[] = [];
  for (const entry of entries) {
    const directory = path.join(skillRoot, entry.name);
    const entrypoint = path.join(directory, 'SKILL.md');
    if (!await isFile(entrypoint)) continue;
    const packagePaths = await walkTextFiles(root, directory, skipped, MAX_SKILL_FILES + 1);
    if (packagePaths.length > MAX_SKILL_FILES) {
      skipped.push({
        path: relativeLabel(root, directory),
        reason: 'size_limit',
        detail: `Skill packages may contain at most ${MAX_SKILL_FILES} text files.`,
      });
      continue;
    }
    const files: PortableSkillPackageFile[] = [];
    let totalBytes = 0;
    let unsafe = false;
    for (const filePath of packagePaths) {
      if (!TEXT_SKILL_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
        skipped.push({
          path: relativeLabel(root, filePath),
          reason: 'unsupported_file_type',
          detail: 'The whole skill was skipped because this package file type is not portable in migration version 1.',
        });
        unsafe = true;
        break;
      }
      const content = await readSafeText(root, filePath, skipped);
      if (content === null) {
        unsafe = true;
        break;
      }
      totalBytes += Buffer.byteLength(content);
      if (totalBytes > MAX_SKILL_PACKAGE_BYTES) {
        skipped.push({
          path: relativeLabel(root, directory),
          reason: 'size_limit',
          detail: `Skill packages must be ${MAX_SKILL_PACKAGE_BYTES} bytes or smaller.`,
        });
        unsafe = true;
        break;
      }
      files.push({
        path: relativeLabel(directory, filePath),
        encoding: 'utf8',
        digest: sha256(content),
        content,
      });
    }
    if (unsafe) continue;
    const skillMarkdown = files.find(file => file.path === 'SKILL.md');
    if (!skillMarkdown) continue;
    const packageDigest = sha256(stableJson(files.map(file => ({
      path: file.path,
      digest: file.digest,
    }))));
    const sourcePath = relativeLabel(root, directory);
    const parsed = parseSkillHeader(skillMarkdown.content, entry.name);
    discovered.push({
      item: item(
        'skill',
        entry.name,
        sourcePath,
        parsed.name,
        packageDigest,
        'review_before_enable',
      ),
      name: parsed.name,
      description: parsed.description,
      package: {
        format: SKILL_PACKAGE_FORMAT,
        entrypoint: 'SKILL.md',
        digest: packageDigest,
        files,
      },
    });
  }
  return discovered;
}

function nestedString(record: Record<string, unknown>, keys: string[]): string | undefined {
  let current: unknown = record;
  for (const key of keys) current = asRecord(current)[key];
  return typeof current === 'string' && current.trim() ? current.trim() : undefined;
}

function extractPreferredModel(config: Record<string, unknown>): string | undefined {
  return nestedString(config, ['agents', 'defaults', 'model', 'primary'])
    ?? nestedString(config, ['agents', 'defaults', 'model'])
    ?? nestedString(config, ['model', 'primary'])
    ?? nestedString(config, ['model']);
}

function conflictFor(
  id: string,
  field: string,
  current: unknown,
  incoming: unknown,
  incomingLabel: string,
): OpenClawMigrationConflict | null {
  if (current === undefined || current === null || current === '' || equalValue(current, incoming)) return null;
  return {
    id,
    field,
    current: 'Existing Pod value',
    incoming: incomingLabel,
    options: ['keep', 'use_incoming'],
    default_resolution: 'keep',
  };
}

export function readPortableInstructionSet(agent: PodAgent): PortableInstructionSet {
  const candidate = asRecord(agent.metadata)?.['portable_instructions'];
  const record = asRecord(candidate);
  const slots = asRecord(record['slots']);
  const normalised: PortableInstructionSet['slots'] = {};
  for (const slot of ['soul', 'agents', 'identity'] as const) {
    const value = asRecord(slots[slot]);
    if (typeof value['content'] !== 'string' || typeof value['digest'] !== 'string') continue;
    normalised[slot] = value as unknown as PortableInstructionSlot;
  }
  return { format: INSTRUCTION_SET_FORMAT, slots: normalised };
}

async function markExcludedPaths(
  root: string,
  skipped: OpenClawMigrationSkipped[],
): Promise<void> {
  const excluded = [
    '.env', 'credentials', 'auth-profiles.json', 'sessions', 'cookies',
    'agents', 'logs',
  ];
  for (const name of excluded) {
    const candidate = path.join(root, name);
    try {
      await lstat(candidate);
      skipped.push({
        path: name,
        reason: 'credential_or_runtime_state_excluded',
        detail: 'Credentials, sessions, cookies, logs, and native runtime databases never enter a migration plan.',
      });
    } catch { /* absent */ }
  }
  for (const name of ['plugins', 'extensions', 'hooks', 'cron']) {
    const candidate = path.join(root, name);
    try {
      await lstat(candidate);
      skipped.push({
        path: name,
        reason: 'unsupported_runtime_artifact',
        detail: 'Native runtime extensions and schedules require a reviewed capability or automation adapter.',
      });
    } catch { /* absent */ }
  }
}

export async function discoverOpenClawMigration(input: {
  agent: PodAgent;
  source_path?: string;
  workspace?: string;
  memory_scope: string;
}): Promise<Discovery> {
  const selectedRoot = expandSourcePath(input.source_path);
  if (!await isDirectory(selectedRoot)) {
    throw new OpenClawMigrationError(
      'source_not_found',
      'The selected OpenClaw source directory was not found.',
      404,
    );
  }
  const root = await realpath(selectedRoot);
  const { workspaceRoot, workspaceLabel } = await resolveWorkspace(root, input.workspace);
  if (!inside(root, workspaceRoot) && root !== workspaceRoot) {
    throw new OpenClawMigrationError('unsafe_workspace', 'The selected workspace leaves the OpenClaw source directory.');
  }

  const skipped: OpenClawMigrationSkipped[] = [];
  await markExcludedPaths(root, skipped);
  const instructions: DiscoveredDocument[] = [];
  for (const fileName of ['SOUL.md', 'AGENTS.md', 'IDENTITY.md']) {
    const filePath = path.join(workspaceRoot, fileName);
    if (!await isFile(filePath)) continue;
    const content = await readSafeText(root, filePath, skipped);
    if (content === null) continue;
    instructions.push({
      item: item(
        'instruction',
        instructionSlot(fileName),
        relativeLabel(root, filePath),
        fileName,
        content,
        'import',
      ),
      content,
    });
  }

  const memories: DiscoveredDocument[] = [];
  for (const fileName of ['USER.md', 'MEMORY.md']) {
    const filePath = path.join(workspaceRoot, fileName);
    if (!await isFile(filePath)) continue;
    const content = await readSafeText(root, filePath, skipped);
    if (content === null) continue;
    memories.push({
      item: item(
        'memory',
        memorySlot(fileName),
        relativeLabel(root, filePath),
        fileName,
        content,
        'import',
      ),
      content,
    });
  }
  const dailyPaths = await walkTextFiles(root, path.join(workspaceRoot, 'memory'), skipped, MAX_MEMORY_FILES + 1);
  if (dailyPaths.length > MAX_MEMORY_FILES) {
    skipped.push({
      path: relativeLabel(root, path.join(workspaceRoot, 'memory')),
      reason: 'size_limit',
      detail: `At most ${MAX_MEMORY_FILES} daily memory files can be imported in one operation.`,
    });
  }
  for (const filePath of dailyPaths.slice(0, MAX_MEMORY_FILES)) {
    if (path.extname(filePath).toLowerCase() !== '.md') {
      skipped.push({
        path: relativeLabel(root, filePath),
        reason: 'unsupported_file_type',
        detail: 'Only Markdown files are imported as OpenClaw memory.',
      });
      continue;
    }
    const content = await readSafeText(root, filePath, skipped);
    if (content === null) continue;
    memories.push({
      item: item(
        'memory',
        'daily_memory',
        relativeLabel(root, filePath),
        path.basename(filePath),
        content,
        'import',
      ),
      content,
    });
  }

  for (const fileName of ['TOOLS.md', 'HEARTBEAT.md', 'BOOTSTRAP.md', 'DREAMS.md']) {
    const filePath = path.join(workspaceRoot, fileName);
    if (!await isFile(filePath)) continue;
    skipped.push({
      path: relativeLabel(root, filePath),
      reason: 'unsupported_runtime_artifact',
      detail: 'This OpenClaw runtime artifact has no safe Hermes-equivalent mapping in migration version 1.',
    });
  }

  const skillRoots = [
    path.join(workspaceRoot, 'skills'),
    path.join(workspaceRoot, '.agents', 'skills'),
    ...(root === workspaceRoot ? [] : [path.join(root, 'skills')]),
  ];
  const seenSkillRoots = new Set<string>();
  const skills: DiscoveredSkill[] = [];
  for (const skillRoot of skillRoots) {
    if (!await isDirectory(skillRoot)) continue;
    const resolved = await realpath(skillRoot);
    if (seenSkillRoots.has(resolved)) continue;
    seenSkillRoots.add(resolved);
    skills.push(...await discoverSkillRoot(root, resolved, skipped));
  }

  const runtime: Discovery['runtime'] = {};
  const configPath = path.join(root, 'openclaw.json');
  if (await isFile(configPath)) {
    const config = await readSafeConfig(root, configPath, skipped);
    if (config) runtime.preferred_model = extractPreferredModel(config);
  }

  const existingInstructions = readPortableInstructionSet(input.agent);
  const conflicts: OpenClawMigrationConflict[] = [];
  for (const document of instructions) {
    const slot = document.item.slot as keyof PortableInstructionSet['slots'];
    const current = slot === 'soul'
      ? input.agent.persona ?? existingInstructions.slots.soul?.content
      : existingInstructions.slots[slot]?.content;
    const conflict = conflictFor(
      `conflict_instruction_${slot}`,
      `instructions.${slot}`,
      current,
      document.content,
      document.item.source_path,
    );
    if (conflict) {
      conflicts.push(conflict);
      document.item.action = 'resolve_conflict';
      document.item.conflict_id = conflict.id;
    } else if (current && equalValue(current, document.content)) {
      document.item.action = 'no_change';
    }
  }
  if (runtime.preferred_model) {
    const conflict = conflictFor(
      'conflict_preferred_model',
      'profile.preferred_model',
      input.agent.model,
      runtime.preferred_model,
      'OpenClaw preferred model',
    );
    if (conflict) conflicts.push(conflict);
  }

  const runtimeItems: OpenClawMigrationItem[] = runtime.preferred_model
    ? [{
        ...item(
          'runtime',
          'preferred_model',
          'openclaw.json',
          'Preferred model',
          runtime.preferred_model,
          conflicts.some(conflict => conflict.id === 'conflict_preferred_model')
            ? 'resolve_conflict'
            : input.agent.model === runtime.preferred_model ? 'no_change' : 'import',
        ),
        ...(conflicts.some(conflict => conflict.id === 'conflict_preferred_model')
          ? { conflict_id: 'conflict_preferred_model' }
          : {}),
      }]
    : [];

  const planItems = [
    ...instructions.map(document => document.item),
    ...memories.map(document => document.item),
    ...skills.map(skill => skill.item),
    ...runtimeItems,
  ].sort((left, right) =>
    left.kind.localeCompare(right.kind)
    || left.source_path.localeCompare(right.source_path));
  const fingerprint = {
    agent_id: input.agent.id,
    memory_scope: input.memory_scope,
    source: { root, workspace: workspaceLabel },
    items: planItems.map(candidate => ({
      kind: candidate.kind,
      slot: candidate.slot,
      path: candidate.source_path,
      digest: candidate.digest,
      action: candidate.action,
      conflict_id: candidate.conflict_id,
    })),
    conflicts: conflicts.map(conflict => ({
      id: conflict.id,
      current_digest: conflict.id === 'conflict_preferred_model'
        ? sha256(input.agent.model ?? '')
        : sha256(String(
            conflict.id === 'conflict_instruction_soul'
              ? input.agent.persona ?? ''
              : existingInstructions.slots[
                  conflict.id.replace('conflict_instruction_', '') as keyof PortableInstructionSet['slots']
                ]?.content ?? '',
          )),
    })),
  };
  const planDigest = sha256(stableJson(fingerprint));
  const plan: OpenClawMigrationPlan = {
    format: PLAN_FORMAT,
    plan_id: `migplan_${planDigest.slice(0, 24)}`,
    plan_digest: planDigest,
    source: {
      kind: 'openclaw',
      root_label: path.basename(root),
      workspace: workspaceLabel,
    },
    target: {
      agent_id: input.agent.id,
      harness: 'hermes',
      memory_scope: input.memory_scope,
    },
    items: planItems,
    conflicts,
    skipped,
    summary: {
      instructions: instructions.length,
      memories: memories.length,
      skills: skills.length,
      runtime_preferences: runtimeItems.length,
      conflicts: conflicts.length,
      skipped: skipped.length,
    },
    warnings: [
      'Preview only. No Pod or harness state has changed.',
      'Imported skills remain blocked and pending review; migration never executes package code.',
      'Credentials, OAuth state, cookies, sessions, logs, caches, and native runtime databases are excluded.',
      'The Hermes projection is generated after import but is not written to the Hermes home directory.',
    ],
  };
  return { plan, instructions, memories, skills, runtime };
}

function resolvedConflictMap(
  plan: OpenClawMigrationPlan,
  provided: Record<string, ConflictResolution> | undefined,
): Record<string, ConflictResolution> {
  const result: Record<string, ConflictResolution> = {};
  const known = new Set(plan.conflicts.map(conflict => conflict.id));
  for (const key of Object.keys(provided ?? {})) {
    if (!known.has(key)) {
      throw new OpenClawMigrationError('unknown_conflict', `Unknown migration conflict "${key}".`);
    }
  }
  for (const conflict of plan.conflicts) {
    const resolution = provided?.[conflict.id] ?? conflict.default_resolution;
    if (!conflict.options.includes(resolution)) {
      throw new OpenClawMigrationError(
        'invalid_resolution',
        `Resolution for "${conflict.id}" must be keep or use_incoming.`,
      );
    }
    result[conflict.id] = resolution;
  }
  return result;
}

function useIncoming(
  candidate: OpenClawMigrationItem,
  resolutions: Record<string, ConflictResolution>,
): boolean {
  if (candidate.action === 'no_change') return false;
  if (!candidate.conflict_id) return true;
  return resolutions[candidate.conflict_id] === 'use_incoming';
}

function receiptFromImport(row: ReturnType<typeof getImport>): AgentMigrationReceipt | null {
  const receipt = asRecord(row?.metadata)?.['migration_receipt'];
  const value = asRecord(receipt);
  return value['format'] === RECEIPT_FORMAT ? value as unknown as AgentMigrationReceipt : null;
}

function rollbackStateFromImport(row: ReturnType<typeof getImport>): ReceiptRollbackState | null {
  const value = asRecord(asRecord(row?.metadata)?.['rollback_state']);
  const previous = asRecord(value['previous_agent']);
  const applied = asRecord(value['applied_agent']);
  if (!('persona' in previous) || !('model' in previous) || !('persona' in applied) || !('model' in applied)) {
    return null;
  }
  return value as unknown as ReceiptRollbackState;
}

function migrationMetadata(
  receipt: AgentMigrationReceipt,
  rollbackState: ReceiptRollbackState,
): Record<string, unknown> {
  return {
    migration_receipt: receipt,
    rollback_state: rollbackState,
  };
}

export async function applyOpenClawMigration(input: {
  db: Database.Database;
  core: SmartwareCore;
  agent: PodAgent;
  source_path?: string;
  workspace?: string;
  memory_scope_name: string;
  memory_scope_id: string;
  expected_plan_digest: string;
  resolutions?: Record<string, ConflictResolution>;
}): Promise<{ receipt: AgentMigrationReceipt; idempotent: boolean }> {
  const priorRows = listImports(input.db, 1000)
    .map(row => ({ row, receipt: receiptFromImport(row) }))
    .filter((entry): entry is { row: NonNullable<typeof entry.row>; receipt: AgentMigrationReceipt } =>
      Boolean(entry.receipt && entry.receipt.agent_id === input.agent.id));
  const priorActive = priorRows.find(({ row, receipt }) =>
    row.status === 'completed'
    && receipt.plan_digest === input.expected_plan_digest
    && !receipt.rollback.rolled_back_at
    && (
      input.resolutions === undefined
      || equalValue(receipt.resolutions, input.resolutions)
    ));
  if (priorActive) return { receipt: priorActive.receipt, idempotent: true };

  const discovery = await discoverOpenClawMigration({
    agent: input.agent,
    source_path: input.source_path,
    workspace: input.workspace,
    memory_scope: input.memory_scope_name,
  });
  if (!input.expected_plan_digest || input.expected_plan_digest !== discovery.plan.plan_digest) {
    throw new OpenClawMigrationError(
      'plan_changed',
      'The OpenClaw source or Pod agent changed after preview. Preview again before importing.',
      409,
    );
  }
  const resolutions = resolvedConflictMap(discovery.plan, input.resolutions);
  const attempt = priorRows.filter(({ receipt }) =>
    receipt.plan_digest === discovery.plan.plan_digest
    && equalValue(receipt.resolutions, resolutions)).length;
  const receiptHash = sha256(stableJson({
    plan_digest: discovery.plan.plan_digest,
    resolutions,
    attempt,
  }));
  const receiptId = `imp_migration_${receiptHash.slice(0, 24)}`;
  const existingImport = getImport(input.db, receiptId);
  if (existingImport) {
    const existingReceipt = receiptFromImport(existingImport);
    if (existingReceipt && existingImport.status === 'completed' && !existingReceipt.rollback.rolled_back_at) {
      return { receipt: existingReceipt, idempotent: true };
    }
    throw new OpenClawMigrationError(
      'migration_incomplete',
      `Migration receipt "${receiptId}" already exists but is not in an active completed state.`,
      409,
    );
  }

  const workspaceId = input.agent.workspace_id ?? DEFAULT_WORKSPACE_ID;
  const previousInstructions = asRecord(input.agent.metadata)?.['portable_instructions'];
  const previousRuntime = asRecord(input.agent.metadata)?.['runtime_preferences'];
  const previousAgent: ReceiptAgentValue = {
    persona: input.agent.persona,
    model: input.agent.model,
    ...(previousInstructions !== undefined ? { portable_instructions: cloneValue(previousInstructions) } : {}),
    ...(previousRuntime !== undefined ? { runtime_preferences: cloneValue(previousRuntime) } : {}),
  };
  const rollbackState: ReceiptRollbackState = {
    previous_agent: previousAgent,
    applied_agent: cloneValue(previousAgent),
  };
  const receipt: AgentMigrationReceipt = {
    format: RECEIPT_FORMAT,
    id: receiptId,
    source: 'openclaw',
    target: 'pod+hermes',
    agent_id: input.agent.id,
    workspace_id: workspaceId,
    memory_scope: input.memory_scope_name,
    plan_id: discovery.plan.plan_id,
    plan_digest: discovery.plan.plan_digest,
    source_snapshot: {
      root_label: discovery.plan.source.root_label,
      workspace: discovery.plan.source.workspace,
    },
    resolutions,
    changed_profile_fields: [],
    created_object_ids: [],
    created_skill_ids: [],
    observation_ids: [],
    applied_at: new Date().toISOString(),
    rollback: {
      available: true,
      rolled_back_at: null,
      warnings: [],
    },
  };
  createImport(input.db, {
    id: receiptId,
    workspace_id: workspaceId,
    source: 'openclaw-migration',
    file_count: discovery.plan.items.length,
    destination: `agent:${input.agent.id}`,
    metadata: migrationMetadata(receipt, rollbackState),
  });
  updateImport(input.db, receiptId, { status: 'importing' });

  try {
    const slots = readPortableInstructionSet(input.agent).slots;
    let persona = input.agent.persona;
    for (const document of discovery.instructions) {
      if (!useIncoming(document.item, resolutions)) continue;
      const slot = document.item.slot as keyof PortableInstructionSet['slots'];
      slots[slot] = {
        content: document.content,
        digest: document.item.digest,
        source: {
          harness: 'openclaw',
          path: document.item.source_path,
        },
      };
      if (slot === 'soul') persona = document.content;
    }
    let model = input.agent.model;
    const modelItem = discovery.plan.items.find(candidate =>
      candidate.kind === 'runtime' && candidate.slot === 'preferred_model');
    const adoptRuntime = Boolean(
      discovery.runtime.preferred_model
      && modelItem
      && useIncoming(modelItem, resolutions),
    );
    if (discovery.runtime.preferred_model && adoptRuntime) {
      model = discovery.runtime.preferred_model;
    }
    const metadata = {
      ...(input.agent.metadata ?? {}),
      ...(discovery.instructions.length > 0 ? {
        portable_instructions: {
          format: INSTRUCTION_SET_FORMAT,
          slots,
        } satisfies PortableInstructionSet,
      } : {}),
      ...(adoptRuntime ? {
        runtime_preferences: {
          ...asRecord(previousRuntime),
          source_harness: 'openclaw',
          preferred_model: discovery.runtime.preferred_model,
        },
      } : {}),
      latest_migration_receipt: receiptId,
    };
    const updatedAgent = upsertAgent(input.db, {
      id: input.agent.id,
      name: input.agent.name,
      description: input.agent.description,
      role: input.agent.role,
      workspace_id: input.agent.workspace_id,
      model,
      status: input.agent.status,
      created_by: input.agent.created_by,
      metadata,
      persona,
      access_mode: input.agent.access_mode,
      scopes: input.agent.scopes,
      context_budget: input.agent.context_budget,
    });
    rollbackState.applied_agent = {
      persona: updatedAgent.persona,
      model: updatedAgent.model,
      portable_instructions: cloneValue(asRecord(updatedAgent.metadata)['portable_instructions']),
      runtime_preferences: cloneValue(asRecord(updatedAgent.metadata)['runtime_preferences']),
    };
    receipt.changed_profile_fields = (
      ['persona', 'model', 'portable_instructions', 'runtime_preferences'] as const
    ).filter(key => !equalValue(rollbackState.previous_agent[key], rollbackState.applied_agent[key]));
    updateImport(input.db, receiptId, { metadata: migrationMetadata(receipt, rollbackState) });

    const collectionId = `agent-migrations-${workspaceId.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
    upsertCollection(input.db, {
      id: collectionId,
      workspace_id: workspaceId,
      name: 'Agent migrations',
      description: 'Durable artifacts imported from agent runtimes.',
      metadata: { system: true, artifact_family: 'agent-migration' },
    });

    let objectIndex = 0;
    for (const document of discovery.memories) {
      if (!useIncoming(document.item, resolutions)) continue;
      const objectId = `obj_migration_${receiptHash.slice(0, 12)}_${String(objectIndex++).padStart(4, '0')}`;
      const object = upsertObject(input.db, {
        id: objectId,
        workspace_id: workspaceId,
        collection_id: collectionId,
        kind: 'agent_memory',
        title: `${input.agent.name} · ${document.item.title}`,
        content: {
          text: document.content,
          memory_slot: document.item.slot,
          source_format: 'markdown',
        },
        origin: 'openclaw',
        created_origin: 'imported',
        last_modified_by: input.agent.id,
        source: {
          app: 'openclaw',
          external_id: document.item.source_path,
        },
        tags: ['agent-memory', 'openclaw', document.item.slot],
        metadata: {
          migration_receipt: receiptId,
          source_digest: document.item.digest,
          source_path: document.item.source_path,
          source_harness: 'openclaw',
          target_agent_id: input.agent.id,
        },
      });
      receipt.created_object_ids.push(object.id);
      const memory = await syncArtifactMemory({
        db: input.db,
        core: input.core,
        object,
        actor: {
          type: 'agent',
          id: input.agent.id,
          display_name: input.agent.name,
        },
        scope: input.memory_scope_id,
        app: 'openclaw-migration',
        type: 'file',
        content: {
          format: 'text/markdown',
          body: document.content,
        },
        visibility: 'scope',
        sensitive: false,
      });
      receipt.observation_ids.push(memory.observation_id);
      updateImport(input.db, receiptId, { metadata: migrationMetadata(receipt, rollbackState) });
    }

    for (const skill of discovery.skills) {
      if (!useIncoming(skill.item, resolutions)) continue;
      const skillObjectId = `obj_migration_${receiptHash.slice(0, 12)}_${String(objectIndex++).padStart(4, '0')}`;
      const skillObject = upsertObject(input.db, {
        id: skillObjectId,
        workspace_id: workspaceId,
        collection_id: collectionId,
        kind: 'skill_package',
        title: skill.name,
        content: skill.package,
        origin: 'openclaw',
        created_origin: 'imported',
        last_modified_by: input.agent.id,
        source: {
          app: 'openclaw',
          external_id: skill.item.source_path,
        },
        tags: ['skill', 'openclaw', 'review-required'],
        needs_review: true,
        metadata: {
          migration_receipt: receiptId,
          package_digest: skill.package.digest,
          target_agent_id: input.agent.id,
        },
      });
      receipt.created_object_ids.push(skillObject.id);
      const skillId = `sk_migration_${receiptHash.slice(0, 12)}_${receipt.created_skill_ids.length.toString().padStart(4, '0')}`;
      upsertSkill(input.db, {
        id: skillId,
        name: skill.name,
        description: skill.description,
        source: 'local',
        source_slug: `openclaw/${skill.item.source_path}`,
        scope: input.memory_scope_name,
        status: 'review',
        trust_score: 0,
        trust_level: 'blocked',
        permissions: [],
        portability: 'exportable',
        metadata: {
          migration_receipt: receiptId,
          source_object_id: skillObject.id,
          package: skill.package,
        },
      });
      captureSkillRevision(input.db, {
        skill_id: skillId,
        version: '0.1.0',
        files: Object.fromEntries(skill.package.files.map(file => [file.path, file.content])),
        origin: 'local',
        source_ref: `openclaw/${skill.item.source_path}`,
        created_by: input.agent.id,
        summary: skill.description,
        status: 'draft',
        metadata: {
          migration_receipt: receiptId,
          source_object_id: skillObject.id,
          source_harness: 'openclaw',
        },
      });
      replaceSkillBindings(input.db, skillId, [input.agent.id], 'pending');
      receipt.created_skill_ids.push(skillId);
      updateImport(input.db, receiptId, { metadata: migrationMetadata(receipt, rollbackState) });
    }

    updateImport(input.db, receiptId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      metadata: migrationMetadata(receipt, rollbackState),
    });
    return { receipt, idempotent: false };
  } catch (error) {
    receipt.rollback.warnings.push(
      `Apply stopped before completion: ${error instanceof Error ? error.message : String(error)}`,
    );
    updateImport(input.db, receiptId, {
      status: receipt.created_object_ids.length > 0 ? 'partial' : 'failed',
      errors: 1,
      completed_at: new Date().toISOString(),
      metadata: migrationMetadata(receipt, rollbackState),
    });
    throw error;
  }
}

export function listAgentMigrationReceipts(
  db: Database.Database,
  agentId: string,
  limit = 50,
): AgentMigrationReceipt[] {
  return listImports(db, 1000)
    .filter(row => row.source === 'openclaw-migration')
    .map(receiptFromImport)
    .filter((receipt): receipt is AgentMigrationReceipt => Boolean(receipt && receipt.agent_id === agentId))
    .slice(0, Math.max(1, Math.min(limit, 200)));
}

export async function rollbackAgentMigration(input: {
  db: Database.Database;
  core: SmartwareCore;
  agent_id: string;
  receipt_id: string;
}): Promise<AgentMigrationReceipt> {
  const row = getImport(input.db, input.receipt_id);
  const receipt = receiptFromImport(row);
  const rollbackState = rollbackStateFromImport(row);
  if (!row || !receipt || !rollbackState || receipt.agent_id !== input.agent_id) {
    throw new OpenClawMigrationError('receipt_not_found', 'Migration receipt not found.', 404);
  }
  if (receipt.rollback.rolled_back_at) return receipt;

  const warnings: string[] = [];
  for (const objectId of receipt.created_object_ids) {
    const retired = await retireArtifactMemory(
      input.db,
      input.core,
      objectId,
      `Rollback of migration ${receipt.id}`,
    );
    for (const failure of retired.retirement_failures) {
      warnings.push(`Could not retire observation ${failure.observation_id}: ${failure.message}`);
    }
    patchObject(input.db, objectId, {
      deleted_at: new Date().toISOString(),
      metadata: {
        migration_rolled_back_at: new Date().toISOString(),
      },
    });
  }
  for (const skillId of receipt.created_skill_ids) {
    if (!deleteSkill(input.db, skillId)) warnings.push(`Imported skill ${skillId} was already absent.`);
  }

  const current = getAgent(input.db, input.agent_id);
  if (!current) {
    warnings.push('The target agent no longer exists, so its previous profile values were not restored.');
  } else {
    let persona = current.persona;
    let model = current.model;
    if (current.persona === rollbackState.applied_agent.persona) persona = rollbackState.previous_agent.persona;
    else warnings.push('Persona changed after migration and was left untouched.');
    if (current.model === rollbackState.applied_agent.model) model = rollbackState.previous_agent.model;
    else warnings.push('Preferred model changed after migration and was left untouched.');

    const metadata = { ...(current.metadata ?? {}) };
    for (const key of ['portable_instructions', 'runtime_preferences'] as const) {
      const applied = rollbackState.applied_agent[key];
      if (equalValue(metadata[key], applied)) {
        const previous = rollbackState.previous_agent[key];
        if (previous === undefined) delete metadata[key];
        else metadata[key] = cloneValue(previous);
      } else {
        warnings.push(`${key} changed after migration and was left untouched.`);
      }
    }
    if (metadata['latest_migration_receipt'] === receipt.id) delete metadata['latest_migration_receipt'];
    upsertAgent(input.db, {
      id: current.id,
      name: current.name,
      description: current.description,
      role: current.role,
      workspace_id: current.workspace_id,
      model,
      status: current.status,
      created_by: current.created_by,
      metadata,
      persona,
      access_mode: current.access_mode,
      scopes: current.scopes,
      context_budget: current.context_budget,
    });
  }

  receipt.rollback = {
    available: false,
    rolled_back_at: new Date().toISOString(),
    warnings,
  };
  updateImport(input.db, receipt.id, {
    completed_at: new Date().toISOString(),
    metadata: migrationMetadata(receipt, rollbackState),
  });
  return receipt;
}
