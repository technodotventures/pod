import fs from 'node:fs/promises';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

import type { ConnectorEnv } from '../config.js';

export type ExternalMcpTransport = 'stdio' | 'http';

export interface ExternalMcpContextTool {
  name: string;
  query_arg?: string;
  arguments?: Record<string, unknown>;
}

export interface ExternalMcpServerConfig {
  id: string;
  name: string;
  enabled: boolean;
  transport: ExternalMcpTransport;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  allowed_tools?: string[];
  context_tools?: ExternalMcpContextTool[];
  timeout_ms?: number;
  created_at: string;
  updated_at: string;
}

export interface PublicExternalMcpServerConfig extends Omit<ExternalMcpServerConfig, 'env' | 'headers'> {
  env_keys: string[];
  header_keys: string[];
}

export interface ExternalMcpContextResult {
  server_id: string;
  server_name: string;
  tool_name: string;
  title: string;
  text: string;
  structured?: Record<string, unknown>;
  is_error?: boolean;
}

interface ExternalMcpStore {
  servers: ExternalMcpServerConfig[];
}

const SERVER_ID_PATTERN = /^[a-zA-Z0-9_.:-]{1,80}$/;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_CONTEXT_RESULTS = 4;
const QUERY_ARG_CANDIDATES = ['query', 'q', 'search', 'term', 'text'];

function storePath(env: ConnectorEnv): string {
  return path.join(env.dataDir, 'mcp-servers.json');
}

async function readStore(env: ConnectorEnv): Promise<ExternalMcpStore> {
  try {
    const parsed = JSON.parse(await fs.readFile(storePath(env), 'utf8')) as Partial<ExternalMcpStore>;
    return { servers: Array.isArray(parsed.servers) ? parsed.servers : [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { servers: [] };
    throw error;
  }
}

async function writeStore(env: ConnectorEnv, store: ExternalMcpStore): Promise<void> {
  await fs.mkdir(env.dataDir, { recursive: true });
  const file = storePath(env);
  await fs.writeFile(file, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(file, 0o600);
}

function publicServer(config: ExternalMcpServerConfig): PublicExternalMcpServerConfig {
  const { env, headers, ...rest } = config;
  return {
    ...rest,
    env_keys: Object.keys(env ?? {}),
    header_keys: Object.keys(headers ?? {}),
  };
}

function validateServerConfig(input: Partial<ExternalMcpServerConfig>): void {
  if (!input.id || !SERVER_ID_PATTERN.test(input.id)) {
    throw new Error('MCP server id must match /^[a-zA-Z0-9_.:-]{1,80}$/');
  }
  if (!input.name?.trim()) {
    throw new Error('MCP server name is required');
  }
  if (input.transport !== 'stdio' && input.transport !== 'http') {
    throw new Error('MCP server transport must be stdio or http');
  }
  if (input.transport === 'stdio' && !input.command?.trim()) {
    throw new Error('stdio MCP servers require a command');
  }
  if (input.transport === 'http' && !input.url?.trim()) {
    throw new Error('HTTP MCP servers require a url');
  }
}

export async function listExternalMcpServers(env: ConnectorEnv): Promise<PublicExternalMcpServerConfig[]> {
  const store = await readStore(env);
  return store.servers.map(publicServer);
}

export async function getExternalMcpServer(env: ConnectorEnv, id: string): Promise<ExternalMcpServerConfig | null> {
  const store = await readStore(env);
  return store.servers.find(server => server.id === id) ?? null;
}

export async function upsertExternalMcpServer(
  env: ConnectorEnv,
  input: Partial<ExternalMcpServerConfig>,
): Promise<PublicExternalMcpServerConfig> {
  validateServerConfig(input);
  const now = new Date().toISOString();
  const store = await readStore(env);
  const existing = store.servers.find(server => server.id === input.id);
  const next: ExternalMcpServerConfig = {
    id: input.id!,
    name: input.name!.trim(),
    enabled: input.enabled === true,
    transport: input.transport!,
    command: input.command?.trim() || undefined,
    args: input.args?.filter(arg => typeof arg === 'string') ?? [],
    cwd: input.cwd?.trim() || undefined,
    env: input.env ?? existing?.env ?? {},
    url: input.url?.trim() || undefined,
    headers: input.headers ?? existing?.headers ?? {},
    allowed_tools: input.allowed_tools?.filter(Boolean) ?? [],
    context_tools: input.context_tools?.filter(tool => Boolean(tool.name)) ?? [],
    timeout_ms: input.timeout_ms ?? existing?.timeout_ms ?? DEFAULT_TIMEOUT_MS,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  store.servers = [
    ...store.servers.filter(server => server.id !== next.id),
    next,
  ].sort((left, right) => left.name.localeCompare(right.name));
  await writeStore(env, store);
  return publicServer(next);
}

export async function deleteExternalMcpServer(env: ConnectorEnv, id: string): Promise<boolean> {
  const store = await readStore(env);
  const next = store.servers.filter(server => server.id !== id);
  if (next.length === store.servers.length) return false;
  await writeStore(env, { servers: next });
  return true;
}

function toolIsReadOnly(config: ExternalMcpServerConfig, tool: Pick<Tool, 'name' | 'annotations'>): boolean {
  return tool.annotations?.readOnlyHint === true || (config.allowed_tools ?? []).includes(tool.name);
}

async function withExternalMcpClient<T>(
  config: ExternalMcpServerConfig,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ name: 'smartware-connectors', version: '0.1.0' }, { capabilities: {} });
  const timeout = config.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const transport = config.transport === 'stdio'
    ? new StdioClientTransport({
        command: config.command!,
        args: config.args ?? [],
        cwd: config.cwd,
        env: { ...getDefaultEnvironment(), ...(config.env ?? {}) },
        stderr: 'pipe',
      })
    : new StreamableHTTPClientTransport(new URL(config.url!), {
        requestInit: { headers: config.headers ?? {} },
      });

  try {
    await client.connect(transport, { timeout });
    return await fn(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function listExternalMcpTools(env: ConnectorEnv, serverId: string): Promise<{
  server: PublicExternalMcpServerConfig;
  tools: Array<Tool & { read_only_allowed: boolean }>;
}> {
  const config = await getExternalMcpServer(env, serverId);
  if (!config) throw new Error('MCP server not found');
  const result = await withExternalMcpClient(config, client => client.listTools(undefined, { timeout: config.timeout_ms ?? DEFAULT_TIMEOUT_MS }));
  return {
    server: publicServer(config),
    tools: result.tools.map(tool => ({ ...tool, read_only_allowed: toolIsReadOnly(config, tool) })),
  };
}

export async function callExternalMcpReadOnlyTool(
  env: ConnectorEnv,
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const config = await getExternalMcpServer(env, serverId);
  if (!config) throw new Error('MCP server not found');
  const tools = await withExternalMcpClient(config, client => client.listTools(undefined, { timeout: config.timeout_ms ?? DEFAULT_TIMEOUT_MS }));
  const tool = tools.tools.find(candidate => candidate.name === toolName);
  if (!tool) throw new Error('MCP tool not found');
  if (!toolIsReadOnly(config, tool)) {
    throw new Error('MCP tool is not marked read-only or allowlisted');
  }
  return withExternalMcpClient(config, client => client.callTool(
    { name: toolName, arguments: args },
    undefined,
    { timeout: config.timeout_ms ?? DEFAULT_TIMEOUT_MS },
  ) as Promise<CallToolResult>);
}

function inferQueryArg(tool: Tool): string | null {
  const properties = tool.inputSchema.properties ?? {};
  return QUERY_ARG_CANDIDATES.find(key => Object.prototype.hasOwnProperty.call(properties, key)) ?? null;
}

function inferContextTools(config: ExternalMcpServerConfig, tools: Tool[]): ExternalMcpContextTool[] {
  if (config.context_tools?.length) return config.context_tools;
  const candidates = tools
    .filter(tool => toolIsReadOnly(config, tool))
    .filter(tool => /\b(search|query|find|lookup|list|read|get)\b/i.test(`${tool.name} ${tool.description ?? ''}`))
    .map(tool => ({ tool, queryArg: inferQueryArg(tool) }))
    .filter(candidate => candidate.queryArg);
  return candidates.slice(0, 2).map(candidate => ({
    name: candidate.tool.name,
    query_arg: candidate.queryArg!,
  }));
}

function stringifyToolResult(result: CallToolResult): string {
  const blocks = result.content
    .map(block => {
      if (block.type === 'text') return block.text;
      if (block.type === 'resource' && 'text' in block.resource) return block.resource.text;
      if (block.type === 'resource_link') return `${block.name}: ${block.uri}`;
      return '';
    })
    .filter(Boolean);
  if (blocks.length > 0) return blocks.join('\n\n');
  if (result.structuredContent) return JSON.stringify(result.structuredContent);
  return '';
}

export async function searchExternalMcpContext(
  env: ConnectorEnv,
  query: string,
  options: { limit?: number } = {},
): Promise<ExternalMcpContextResult[]> {
  const store = await readStore(env);
  const servers = store.servers.filter(server => server.enabled).slice(0, 4);
  const results: ExternalMcpContextResult[] = [];
  const limit = options.limit ?? MAX_CONTEXT_RESULTS;

  for (const config of servers) {
    if (results.length >= limit) break;
    try {
      const tools = await withExternalMcpClient(config, client => client.listTools(undefined, { timeout: config.timeout_ms ?? DEFAULT_TIMEOUT_MS }));
      const contextTools = inferContextTools(config, tools.tools);
      for (const contextTool of contextTools) {
        if (results.length >= limit) break;
        const tool = tools.tools.find(candidate => candidate.name === contextTool.name);
        if (!tool || !toolIsReadOnly(config, tool)) continue;
        const queryArg = contextTool.query_arg ?? inferQueryArg(tool) ?? 'query';
        const toolResult = await withExternalMcpClient(config, client => client.callTool(
          {
            name: tool.name,
            arguments: {
              ...(contextTool.arguments ?? {}),
              [queryArg]: query,
            },
          },
          undefined,
          { timeout: config.timeout_ms ?? DEFAULT_TIMEOUT_MS },
        ) as Promise<CallToolResult>);
        const text = stringifyToolResult(toolResult).slice(0, 4000);
        if (!text.trim()) continue;
        results.push({
          server_id: config.id,
          server_name: config.name,
          tool_name: tool.name,
          title: tool.title ?? tool.annotations?.title ?? tool.name,
          text,
          structured: toolResult.structuredContent,
          is_error: toolResult.isError,
        });
      }
    } catch {
      continue;
    }
  }

  return results;
}
