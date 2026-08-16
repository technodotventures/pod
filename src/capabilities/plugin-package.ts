import crypto from 'node:crypto';

import type {
  PodPluginPackageFile,
  PodPluginRevisionComponent,
} from '../pod/db.js';

export const AGENT_PLUGIN_SCHEMA_URI = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
export const AGENT_PLUGIN_MCP_SCHEMA_URI = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';

const MAX_PLUGIN_FILES = 256;
const MAX_PLUGIN_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PLUGIN_PACKAGE_BYTES = 10 * 1024 * 1024;
const PLUGIN_NAME_PATTERN = /^[a-z0-9](?:(?!\.\.|--)[a-z0-9.-]){0,62}[a-z0-9]$|^[a-z0-9]$/;
const EXTENSION_NAMESPACE_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export type PluginPackageFileInput = string | {
  encoding: 'utf8' | 'base64';
  content: string;
};

export interface AgentPluginIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path?: string;
}

export interface AgentPluginInspection {
  valid: boolean;
  specification: '1.0.0' | 'unsupported';
  manifest: Record<string, unknown> | null;
  issues: AgentPluginIssue[];
  components: {
    skills: Array<{
      key: string;
      path: string;
      name: string;
      description: string;
      status: 'valid' | 'invalid';
    }>;
    mcp_servers: Array<{
      key: string;
      transport: string;
      status: 'valid' | 'invalid';
      command?: string;
      url?: string;
      literal_header_keys: string[];
    }>;
    extensions: Array<{
      key: string;
      status: 'unsupported';
      file_count: number;
    }>;
  };
  risk: {
    local_executables: number;
    remote_connections: number;
    literal_header_keys: string[];
    binary_files: number;
    total_bytes: number;
  };
}

export interface InspectedAgentPluginPackage {
  files: Record<string, PodPluginPackageFile>;
  package_hash: string;
  inspection: AgentPluginInspection;
  components: PodPluginRevisionComponent[];
}

function normalizePackagePath(input: string): string {
  const candidate = input.replace(/\\/g, '/');
  if (!candidate || candidate.startsWith('/') || candidate.includes('\0')) {
    throw new Error(`Invalid package path: ${input}`);
  }
  const segments = candidate.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Package path escapes its root: ${input}`);
  }
  return segments.join('/');
}

function decodeFile(input: PluginPackageFileInput): { bytes: Buffer; preferredEncoding: 'utf8' | 'base64' } {
  if (typeof input === 'string') return { bytes: Buffer.from(input, 'utf8'), preferredEncoding: 'utf8' };
  if (!input || (input.encoding !== 'utf8' && input.encoding !== 'base64') || typeof input.content !== 'string') {
    throw new Error('Plugin files must contain utf8 or base64 content');
  }
  if (input.encoding === 'utf8') return { bytes: Buffer.from(input.content, 'utf8'), preferredEncoding: 'utf8' };
  const bytes = Buffer.from(input.content, 'base64');
  const supplied = input.content.replace(/\s/g, '').replace(/=+$/, '');
  const canonical = bytes.toString('base64').replace(/=+$/, '');
  if (canonical !== supplied) throw new Error('Plugin file contains invalid base64 content');
  return { bytes, preferredEncoding: 'base64' };
}

export function normalizePluginPackageFiles(
  input: Record<string, PluginPackageFileInput>,
): { files: Record<string, PodPluginPackageFile>; package_hash: string } {
  const entries = Object.entries(input);
  if (entries.length === 0) throw new Error('Plugin package is empty');
  if (entries.length > MAX_PLUGIN_FILES) throw new Error(`Plugin package exceeds ${MAX_PLUGIN_FILES} files`);

  const normalized = new Map<string, { bytes: Buffer; encoding: 'utf8' | 'base64' }>();
  let totalBytes = 0;
  for (const [rawPath, value] of entries) {
    const filePath = normalizePackagePath(rawPath);
    if (normalized.has(filePath)) throw new Error(`Duplicate plugin package path: ${filePath}`);
    const decoded = decodeFile(value);
    if (decoded.bytes.byteLength > MAX_PLUGIN_FILE_BYTES) {
      throw new Error(`Plugin file exceeds ${MAX_PLUGIN_FILE_BYTES} bytes: ${filePath}`);
    }
    totalBytes += decoded.bytes.byteLength;
    if (totalBytes > MAX_PLUGIN_PACKAGE_BYTES) {
      throw new Error(`Plugin package exceeds ${MAX_PLUGIN_PACKAGE_BYTES} bytes`);
    }
    normalized.set(filePath, { bytes: decoded.bytes, encoding: decoded.preferredEncoding });
  }

  const hash = crypto.createHash('sha256');
  const files: Record<string, PodPluginPackageFile> = {};
  for (const [filePath, file] of [...normalized.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const pathBytes = Buffer.from(filePath, 'utf8');
    hash.update(String(pathBytes.byteLength)).update(':').update(pathBytes);
    hash.update(String(file.bytes.byteLength)).update(':').update(file.bytes);
    files[filePath] = {
      encoding: file.encoding,
      content: file.encoding === 'utf8' ? file.bytes.toString('utf8') : file.bytes.toString('base64'),
      size: file.bytes.byteLength,
      sha256: crypto.createHash('sha256').update(file.bytes).digest('hex'),
    };
  }
  return { files, package_hash: hash.digest('hex') };
}

function textFile(files: Record<string, PodPluginPackageFile>, filePath: string): string | null {
  const file = files[filePath];
  return file?.encoding === 'utf8' ? file.content : null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function skillFrontmatter(markdown: string): { name: string; description: string } | null {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);
  if (!match) return null;
  const values = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    values.set(key, value);
  }
  const name = values.get('name') ?? '';
  const description = values.get('description') ?? '';
  return name && description ? { name, description } : null;
}

function authorName(author: unknown): string {
  const value = objectValue(author);
  return typeof value?.name === 'string' ? value.name : 'unknown';
}

export function inspectAgentPluginPackage(
  input: Record<string, PluginPackageFileInput>,
): InspectedAgentPluginPackage {
  const { files, package_hash } = normalizePluginPackageFiles(input);
  const issues: AgentPluginIssue[] = [];
  let manifest: Record<string, unknown> | null = null;
  let specification: AgentPluginInspection['specification'] = 'unsupported';

  const manifestText = textFile(files, 'plugin.json');
  if (manifestText === null) {
    issues.push({ severity: 'error', code: 'manifest_missing', message: 'A UTF-8 plugin.json is required.', path: 'plugin.json' });
  } else {
    try {
      manifest = objectValue(JSON.parse(manifestText));
      if (!manifest) throw new Error('plugin.json must contain an object');
    } catch (error) {
      issues.push({ severity: 'error', code: 'manifest_invalid_json', message: String(error), path: 'plugin.json' });
    }
  }

  if (manifest) {
    if (manifest.$schema !== AGENT_PLUGIN_SCHEMA_URI) {
      issues.push({ severity: 'error', code: 'schema_unsupported', message: 'Pod supports Agent Plugins schema 1.0.0.', path: 'plugin.json' });
    } else {
      specification = '1.0.0';
    }
    if (typeof manifest.name !== 'string' || !PLUGIN_NAME_PATTERN.test(manifest.name)) {
      issues.push({ severity: 'error', code: 'name_invalid', message: 'Plugin name does not meet the Agent Plugins 1.0.0 constraints.', path: 'plugin.json' });
    }
    const stringFields = ['version', 'description', 'homepage', 'repository', 'license'];
    for (const field of stringFields) {
      if (manifest[field] !== undefined && typeof manifest[field] !== 'string') {
        issues.push({ severity: 'error', code: `${field}_invalid`, message: `${field} must be a string.`, path: 'plugin.json' });
      }
    }
    if (manifest.author !== undefined && !objectValue(manifest.author)) {
      issues.push({ severity: 'error', code: 'author_invalid', message: 'author must be an object.', path: 'plugin.json' });
    }
    if (manifest.keywords !== undefined && (!Array.isArray(manifest.keywords) || manifest.keywords.some(value => typeof value !== 'string'))) {
      issues.push({ severity: 'error', code: 'keywords_invalid', message: 'keywords must be an array of strings.', path: 'plugin.json' });
    }
    if (manifest.extensions !== undefined && !objectValue(manifest.extensions)) {
      issues.push({ severity: 'warning', code: 'extensions_ignored', message: 'A non-object extensions field is ignored.', path: 'plugin.json' });
    }
    const known = new Set(['$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'extensions']);
    for (const field of Object.keys(manifest)) {
      if (!known.has(field)) {
        issues.push({ severity: 'warning', code: 'manifest_field_ignored', message: `Unknown manifest field “${field}” is ignored.`, path: 'plugin.json' });
      }
    }
  }

  const skills: AgentPluginInspection['components']['skills'] = [];
  for (const filePath of Object.keys(files).sort()) {
    const match = filePath.match(/^skills\/([^/]+)\/SKILL\.md$/);
    if (!match) continue;
    const markdown = textFile(files, filePath);
    const header = markdown === null ? null : skillFrontmatter(markdown);
    const status = header ? 'valid' : 'invalid';
    if (!header) {
      issues.push({ severity: 'warning', code: 'skill_skipped', message: 'Skill is missing valid name and description frontmatter.', path: filePath });
    }
    skills.push({
      key: match[1],
      path: filePath,
      name: header?.name ?? match[1],
      description: header?.description ?? '',
      status,
    });
  }

  const mcpServers: AgentPluginInspection['components']['mcp_servers'] = [];
  const mcpText = textFile(files, 'mcp.json');
  if (files['mcp.json'] && mcpText === null) {
    issues.push({ severity: 'warning', code: 'mcp_disabled', message: 'mcp.json must be UTF-8 JSON.', path: 'mcp.json' });
  } else if (mcpText !== null) {
    try {
      const document = objectValue(JSON.parse(mcpText));
      const servers = objectValue(document?.mcpServers);
      if (!document || document.$schema !== AGENT_PLUGIN_MCP_SCHEMA_URI || !servers) {
        throw new Error('mcp.json must use the Agent Plugins 1.0.0 MCP schema and contain mcpServers');
      }
      for (const [key, raw] of Object.entries(servers)) {
        const server = objectValue(raw);
        const transport = typeof server?.type === 'string' ? server.type : 'unknown';
        const headerObject = objectValue(server?.headers);
        const literalHeaderKeys = headerObject ? Object.keys(headerObject).sort() : [];
        let status: 'valid' | 'invalid' = 'valid';
        if (!server || !['stdio', 'streamable-http', 'sse'].includes(transport)) status = 'invalid';
        if (transport === 'stdio' && typeof server?.command !== 'string') status = 'invalid';
        if ((transport === 'streamable-http' || transport === 'sse') && typeof server?.url !== 'string') status = 'invalid';
        if (status === 'invalid') {
          issues.push({ severity: 'warning', code: 'mcp_entry_skipped', message: `MCP server “${key}” is invalid and will be skipped.`, path: 'mcp.json' });
        }
        mcpServers.push({
          key,
          transport,
          status,
          command: typeof server?.command === 'string' ? server.command : undefined,
          url: typeof server?.url === 'string' ? server.url : undefined,
          literal_header_keys: literalHeaderKeys,
        });
      }
    } catch (error) {
      issues.push({ severity: 'warning', code: 'mcp_disabled', message: String(error), path: 'mcp.json' });
    }
  }

  const topLevelCounts = new Map<string, number>();
  for (const filePath of Object.keys(files)) {
    const [root, rest] = filePath.split('/', 2);
    if (!rest || root === 'skills') continue;
    topLevelCounts.set(root, (topLevelCounts.get(root) ?? 0) + 1);
  }
  const extensions = [...topLevelCounts.entries()]
    .filter(([root]) => EXTENSION_NAMESPACE_PATTERN.test(root))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, file_count]) => ({ key, status: 'unsupported' as const, file_count }));

  const literalHeaderKeys = [...new Set(mcpServers.flatMap(server => server.literal_header_keys))].sort();
  const inspection: AgentPluginInspection = {
    valid: !issues.some(issue => issue.severity === 'error'),
    specification,
    manifest,
    issues,
    components: { skills, mcp_servers: mcpServers, extensions },
    risk: {
      local_executables: mcpServers.filter(server => server.transport === 'stdio' && server.status === 'valid').length,
      remote_connections: mcpServers.filter(server => ['streamable-http', 'sse'].includes(server.transport) && server.status === 'valid').length,
      literal_header_keys: literalHeaderKeys,
      binary_files: Object.values(files).filter(file => file.encoding === 'base64').length,
      total_bytes: Object.values(files).reduce((sum, file) => sum + file.size, 0),
    },
  };

  const components: PodPluginRevisionComponent[] = [
    ...skills.map(skill => ({
      revision_id: '',
      component_type: 'skill' as const,
      component_key: skill.key,
      status: skill.status,
      detail: { path: skill.path, name: skill.name, description: skill.description },
    })),
    ...mcpServers.map(server => ({
      revision_id: '',
      component_type: 'mcp_server' as const,
      component_key: server.key,
      status: server.status,
      detail: {
        transport: server.transport,
        command: server.command,
        url: server.url,
        literal_header_keys: server.literal_header_keys,
      },
    })),
    ...extensions.map(extension => ({
      revision_id: '',
      component_type: 'extension' as const,
      component_key: extension.key,
      status: extension.status,
      detail: { file_count: extension.file_count },
    })),
  ];

  return { files, package_hash, inspection, components };
}

export function pluginManifestSummary(manifest: Record<string, unknown>): {
  name: string;
  version: string;
  description: string;
  author: string;
} {
  return {
    name: String(manifest.name),
    version: typeof manifest.version === 'string' ? manifest.version : '0.0.0',
    description: typeof manifest.description === 'string' ? manifest.description : '',
    author: authorName(manifest.author),
  };
}
