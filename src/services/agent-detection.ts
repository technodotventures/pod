import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

import {
  canAutoConfigureAgent,
  resolveDeerFlowExtensionsConfigPath,
  resolveKimiCodeMcpPath,
} from './agent-connection.js';

export interface AgentDetectionResult {
  /** Catalog entry id from ui AGENT_CATALOG. */
  agent_id: string;
  /** True if any of the install markers (config file or CLI binary) is present. */
  installed: boolean;
  /** Filesystem path to the agent's config file, if it exists. */
  config_path: string | null;
  /** PATH location of the agent's CLI, if present. */
  cli_path: string | null;
  /** Friendly client name for setup surfaces. */
  name: string;
  /** True when Coffee can safely install the MCP entry for this client. */
  auto_configurable: boolean;
}

interface AgentProbe {
  agent_id: string;
  name: string;
  /** Filesystem paths to check (first one that exists is reported). */
  config_paths?: string[] | (() => string[]);
  /** CLI executable names to look up on PATH. */
  cli_names?: string[];
}

function homePath(p: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function openClawConfigPaths(): string[] {
  const explicit = process.env['OPENCLAW_CONFIG_PATH']?.trim();
  if (explicit) return [explicit];
  const stateDir = process.env['OPENCLAW_STATE_DIR']?.trim();
  if (stateDir) return [path.join(stateDir, 'openclaw.json')];
  const profile = process.env['OPENCLAW_PROFILE']?.trim();
  if (profile && profile !== 'default') return [`~/.openclaw-${profile}/openclaw.json`];
  return ['~/.openclaw/openclaw.json'];
}

function hermesConfigPaths(): string[] {
  const home = process.env['HERMES_HOME']?.trim();
  return home ? [path.join(home, 'config.yaml')] : ['~/.hermes/config.yaml'];
}

function deerFlowConfigPaths(): string[] {
  const resolved = resolveDeerFlowExtensionsConfigPath();
  return resolved ? [resolved] : [];
}

const PROBES: AgentProbe[] = [
  {
    agent_id: 'claude-code',
    name: 'Claude Code',
    cli_names: ['claude'],
  },
  {
    agent_id: 'codex',
    name: 'Codex',
    config_paths: ['~/.codex/config.toml'],
    cli_names: ['codex'],
  },
  {
    agent_id: 'hermes',
    name: 'Hermes Agent',
    config_paths: hermesConfigPaths,
    cli_names: ['hermes'],
  },
  {
    agent_id: 'openclaw',
    name: 'OpenClaw',
    config_paths: openClawConfigPaths,
    cli_names: ['openclaw'],
  },
  {
    agent_id: 'kimi-code',
    name: 'Kimi Code',
    config_paths: () => [
      resolveKimiCodeMcpPath(),
      path.join(path.dirname(resolveKimiCodeMcpPath()), 'config.toml'),
    ],
    cli_names: ['kimi'],
  },
  {
    agent_id: 'deerflow',
    name: 'DeerFlow',
    config_paths: deerFlowConfigPaths,
  },
  {
    agent_id: 'cursor',
    name: 'Cursor',
    config_paths: ['~/.cursor/mcp.json'],
    cli_names: ['cursor'],
  },
  {
    agent_id: 'claude-desktop',
    name: 'Claude Desktop',
    config_paths: [
      '~/Library/Application Support/Claude/claude_desktop_config.json',
      '~/.config/Claude/claude_desktop_config.json',
      '%APPDATA%/Claude/claude_desktop_config.json', // Windows; not resolved on darwin/linux
    ],
  },
  {
    agent_id: 'continue',
    name: 'Continue',
    config_paths: ['~/.continue/config.json', '~/.continue/config.yaml'],
  },
  {
    agent_id: 'zed',
    name: 'Zed',
    config_paths: ['~/.config/zed/settings.json', '~/Library/Application Support/Zed/settings.json'],
    cli_names: ['zed'],
  },
  {
    agent_id: 'gemini-cli', name: 'Gemini CLI', cli_names: ['gemini'],
  },
  {
    agent_id: 'opencode', name: 'OpenCode', cli_names: ['opencode'],
  },
  {
    agent_id: 'auggie', name: 'Auggie', cli_names: ['auggie'],
  },
  {
    agent_id: 'langchain', name: 'LangChain', cli_names: ['langchain'],
  },
];

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

function which(cmd: string): Promise<string | null> {
  return new Promise(resolve => {
    const child = spawn('which', [cmd], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const timer = setTimeout(() => { try { child.kill(); } catch {/* */} }, 2_000);
    child.stdout.on('data', d => { out += d; });
    child.on('error', () => { clearTimeout(timer); resolve(null); });
    child.on('close', code => { clearTimeout(timer); resolve(code === 0 ? out.trim() : null); });
  });
}

async function probe(p: AgentProbe): Promise<AgentDetectionResult> {
  const configResult = await (async () => {
    const candidates = typeof p.config_paths === 'function' ? p.config_paths() : (p.config_paths ?? []);
    for (const candidate of candidates) {
      if (candidate.includes('%APPDATA%')) continue; // skip Windows paths on macOS/Linux
      const resolved = homePath(candidate);
      if (await fileExists(resolved)) return resolved;
    }
    return null;
  })();
  const cliResult = await (async () => {
    for (const name of p.cli_names ?? []) {
      const found = await which(name);
      if (found) return found;
    }
    return null;
  })();
  return {
    agent_id: p.agent_id,
    installed: Boolean(configResult || cliResult),
    config_path: configResult,
    cli_path: cliResult,
    name: p.name,
    auto_configurable: canAutoConfigureAgent(p.agent_id) && (p.agent_id !== 'deerflow' || Boolean(configResult)),
  };
}

export async function detectInstalledAgents(): Promise<AgentDetectionResult[]> {
  return Promise.all(PROBES.map(probe));
}
