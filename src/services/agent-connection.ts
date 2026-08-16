import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export interface RemoteMcpServerEntry {
  type?: 'http' | 'streamable-http';
  url: string;
  headers: Record<string, string>;
}

type ApplySpec =
  | { strategy: 'json'; path: string }
  | { strategy: 'claude-code-cli' }
  | { strategy: 'codex-toml'; path: string }
  | { strategy: 'openclaw-cli' }
  | { strategy: 'kimi-json' }
  | { strategy: 'deerflow-json' };

const APPLY_SPECS: Record<string, ApplySpec> = {
  'claude-desktop': {
    strategy: 'json',
    path: '~/Library/Application Support/Claude/claude_desktop_config.json',
  },
  cursor: {
    strategy: 'json',
    path: '~/.cursor/mcp.json',
  },
  'claude-code': { strategy: 'claude-code-cli' },
  codex: { strategy: 'codex-toml', path: '~/.codex/config.toml' },
  openclaw: { strategy: 'openclaw-cli' },
  'kimi-code': { strategy: 'kimi-json' },
  deerflow: { strategy: 'deerflow-json' },
};

const COFFEE_POD_SERVER_KEY = 'coffee-pod';
// Persisted compatibility sentinels: changing these would strand existing
// managed blocks in users' agent configuration files.
const CODEX_MANAGED_START = '# >>> Coffee Pod managed MCP >>>';
const CODEX_MANAGED_END = '# <<< Coffee Pod managed MCP <<<';

export function canAutoConfigureAgent(agentId: string): boolean {
  return agentId in APPLY_SPECS;
}

/** DeerFlow intentionally has no global config directory. Only use an
 * operator-selected extensions file or project root for automatic writes. */
export function resolveDeerFlowExtensionsConfigPath(): string | null {
  const explicit = process.env['DEER_FLOW_EXTENSIONS_CONFIG_PATH']?.trim();
  if (explicit) return path.resolve(homePath(explicit));
  const projectRoot = process.env['DEER_FLOW_PROJECT_ROOT']?.trim();
  if (projectRoot) return path.resolve(homePath(projectRoot), 'extensions_config.json');
  return null;
}

function homePath(value: string): string {
  return value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value;
}

export function resolveKimiCodeMcpPath(): string {
  const home = process.env['KIMI_CODE_HOME']?.trim();
  return path.join(home ? path.resolve(homePath(home)) : path.join(os.homedir(), '.kimi-code'), 'mcp.json');
}

export function parseRemoteMcpServerEntry(value: unknown): RemoteMcpServerEntry | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== undefined && candidate.type !== 'http' && candidate.type !== 'streamable-http') return null;
  if (typeof candidate.url !== 'string') return null;

  let url: URL;
  try {
    url = new URL(candidate.url);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.pathname.endsWith('/mcp')) return null;

  if (!candidate.headers || typeof candidate.headers !== 'object' || Array.isArray(candidate.headers)) return null;
  const headers = candidate.headers as Record<string, unknown>;
  const authorization = headers.Authorization ?? headers.authorization;
  if (typeof authorization !== 'string' || !/^Bearer cpod_agent_[A-Za-z0-9_-]{32}$/.test(authorization)) return null;

  return {
    type: candidate.type as RemoteMcpServerEntry['type'],
    url: url.toString(),
    headers: { Authorization: authorization },
  };
}

export function mergeMcpServersObject(
  existing: Record<string, unknown>,
  serverEntry: RemoteMcpServerEntry | Record<string, unknown>,
): { config: Record<string, unknown>; replaced: boolean; siblings: string[] } {
  const prior = existing.mcpServers && typeof existing.mcpServers === 'object' && !Array.isArray(existing.mcpServers)
    ? existing.mcpServers as Record<string, unknown>
    : {};
  return {
    config: {
      ...existing,
      mcpServers: { ...prior, [COFFEE_POD_SERVER_KEY]: serverEntry },
    },
    replaced: COFFEE_POD_SERVER_KEY in prior,
    siblings: Object.keys(prior).filter(key => key !== COFFEE_POD_SERVER_KEY),
  };
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function codexManagedBlock(serverEntry: RemoteMcpServerEntry): string {
  const authorization = serverEntry.headers.Authorization;
  return [
    CODEX_MANAGED_START,
    '[mcp_servers.coffee-pod]',
    `url = ${tomlString(serverEntry.url)}`,
    `http_headers = { Authorization = ${tomlString(authorization)} }`,
    CODEX_MANAGED_END,
  ].join('\n');
}

export function upsertCodexMcpBlock(source: string, serverEntry: RemoteMcpServerEntry): { content: string; replaced: boolean } {
  const block = codexManagedBlock(serverEntry);
  const managedStart = source.indexOf(CODEX_MANAGED_START);
  const managedEnd = source.indexOf(CODEX_MANAGED_END);
  if (managedStart >= 0 && managedEnd >= managedStart) {
    const end = managedEnd + CODEX_MANAGED_END.length;
    return {
      content: `${source.slice(0, managedStart)}${block}${source.slice(end)}`.trimEnd() + '\n',
      replaced: true,
    };
  }

  const lines = source.split(/\r?\n/);
  const sectionStart = lines.findIndex(line => /^\s*\[mcp_servers\.(?:coffee-pod|"coffee-pod")\]\s*$/.test(line));
  if (sectionStart >= 0) {
    let sectionEnd = sectionStart + 1;
    while (sectionEnd < lines.length && !/^\s*\[/.test(lines[sectionEnd] ?? '')) sectionEnd += 1;
    lines.splice(sectionStart, sectionEnd - sectionStart, ...block.split('\n'));
    return { content: lines.join('\n').trimEnd() + '\n', replaced: true };
  }

  const prefix = source.trimEnd();
  return { content: `${prefix}${prefix ? '\n\n' : ''}${block}\n`, replaced: false };
}

export function buildClaudeCodeMcpArgs(serverEntry: RemoteMcpServerEntry): string[] {
  return [
    'mcp', 'add',
    '--transport', 'http',
    '--scope', 'user',
    '--header', `Authorization: ${serverEntry.headers.Authorization}`,
    COFFEE_POD_SERVER_KEY,
    serverEntry.url,
  ];
}

export function buildOpenClawMcpArgs(serverEntry: RemoteMcpServerEntry, profileId?: string): string[] {
  const profile = profileId?.trim();
  if (profile && profile !== 'default' && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(profile)) {
    const error = new Error('OpenClaw profile names may contain letters, numbers, dots, hyphens, and underscores.');
    (error as Error & { code?: string }).code = 'invalid_profile';
    throw error;
  }
  const definition = JSON.stringify({
    url: serverEntry.url,
    transport: 'streamable-http',
    headers: serverEntry.headers,
  });
  return [
    ...(profile && profile !== 'default' ? ['--profile', profile] : []),
    'mcp', 'set', COFFEE_POD_SERVER_KEY, definition,
  ];
}

export function deerFlowMcpServerEntry(serverEntry: RemoteMcpServerEntry): Record<string, unknown> {
  return {
    enabled: true,
    type: 'http',
    url: serverEntry.url,
    headers: serverEntry.headers,
  };
}

export function kimiCodeMcpServerEntry(serverEntry: RemoteMcpServerEntry): Record<string, unknown> {
  return {
    url: serverEntry.url,
    headers: serverEntry.headers,
  };
}

function runCommand(command: string, args: string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stderr: stderr.trim() });
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* best effort */ }
      finish(null);
    }, 12_000);
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', error => { stderr += error.message; finish(null); });
    child.on('close', code => finish(code));
  });
}

async function writeAtomic(target: string, content: string): Promise<void> {
  const temp = `${target}.coffee-tmp-${process.pid}`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    await fs.writeFile(temp, content, { mode: 0o600 });
    await fs.rename(temp, target);
  } catch (error) {
    try { await fs.unlink(temp); } catch { /* best effort */ }
    throw error;
  }
}

export async function applyAgentMcpConfig(
  agentId: string,
  serverEntry: RemoteMcpServerEntry,
  options: { profileId?: string } = {},
): Promise<Record<string, unknown>> {
  const spec = APPLY_SPECS[agentId];
  if (!spec) {
    const error = new Error(`Automatic setup is not supported for ${agentId} yet.`);
    (error as Error & { code?: string }).code = 'not_supported';
    throw error;
  }

  if (spec.strategy === 'claude-code-cli') {
    const result = await runCommand('claude', buildClaudeCodeMcpArgs(serverEntry));
    if (result.code === 0) {
      return { ok: true, strategy: spec.strategy, scope: 'user', server_key: COFFEE_POD_SERVER_KEY };
    }
    if (/already exists/i.test(result.stderr)) {
      throw new Error('Claude Code already has a coffee-pod entry. Pod left it unchanged so you can replace it manually.');
    }
    throw new Error(result.stderr || 'Claude Code did not accept the MCP configuration.');
  }

  if (spec.strategy === 'openclaw-cli') {
    const result = await runCommand('openclaw', buildOpenClawMcpArgs(serverEntry, options.profileId));
    if (result.code === 0) {
      return {
        ok: true,
        strategy: spec.strategy,
        profile_id: options.profileId?.trim() || 'default',
        server_key: COFFEE_POD_SERVER_KEY,
      };
    }
    throw new Error(result.stderr || 'OpenClaw did not accept the MCP configuration.');
  }

  const target = spec.strategy === 'deerflow-json'
    ? resolveDeerFlowExtensionsConfigPath()
    : spec.strategy === 'kimi-json'
      ? resolveKimiCodeMcpPath()
      : homePath(spec.path);
  if (!target) {
    const error = new Error('Set DEER_FLOW_EXTENSIONS_CONFIG_PATH or DEER_FLOW_PROJECT_ROOT before using one-click DeerFlow setup.');
    (error as Error & { code?: string }).code = 'config_path_required';
    throw error;
  }
  let raw = '';
  let created = false;
  try {
    raw = await fs.readFile(target, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    created = true;
  }

  if (spec.strategy === 'codex-toml') {
    const next = upsertCodexMcpBlock(raw, serverEntry);
    await writeAtomic(target, next.content);
    return {
      ok: true,
      strategy: spec.strategy,
      path: target,
      created,
      replaced_existing_entry: next.replaced,
      server_key: COFFEE_POD_SERVER_KEY,
    };
  }

  let existing: Record<string, unknown> = {};
  if (raw.trim()) {
    try {
      existing = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      const error = new Error(`${target} exists but is not valid JSON. Pod left it unchanged.`);
      (error as Error & { code?: string }).code = 'malformed_existing_config';
      throw error;
    }
  }
  const storedEntry = spec.strategy === 'deerflow-json'
    ? deerFlowMcpServerEntry(serverEntry)
    : spec.strategy === 'kimi-json'
      ? kimiCodeMcpServerEntry(serverEntry)
      : serverEntry;
  const next = mergeMcpServersObject(existing, storedEntry);
  await writeAtomic(target, JSON.stringify(next.config, null, 2) + '\n');
  return {
    ok: true,
    strategy: spec.strategy,
    path: target,
    created,
    replaced_existing_entry: next.replaced,
    sibling_servers: next.siblings,
    server_key: COFFEE_POD_SERVER_KEY,
  };
}
