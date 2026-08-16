import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import type { ConnectorEnv } from '../config.js';
import { getFreshAccessToken } from '../connections/oauth-refresh.js';
import { ensureContainerRunning, stopContainer } from './docker-runtime.js';
import { getMcpProvider, listMcpProviders, type McpProviderDef } from './registry.js';

export interface McpToolSummary {
  name: string;
  description: string | undefined;
  inputSchema: Record<string, unknown>;
}

export interface McpCallResult {
  content: unknown;
  isError: boolean;
}

export class McpClientError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'McpClientError';
  }
}

/** Caller asked for a tool the server doesn't expose. Maps to HTTP 404. */
export class McpToolNotFoundError extends Error {
  constructor(readonly providerId: string, readonly toolName: string) {
    super(`Tool "${toolName}" is not exposed by the ${providerId} MCP server.`);
    this.name = 'McpToolNotFoundError';
  }
}

/** Server reported isError=true (typically arg-validation or provider API failure). Maps to HTTP 422. */
export class McpToolExecutionError extends Error {
  constructor(readonly providerId: string, readonly toolName: string, message: string) {
    super(`Tool ${providerId}/${toolName} reported an error: ${message}`);
    this.name = 'McpToolExecutionError';
  }
}

interface PooledEntry {
  url: string;
}

const POOL = new Map<string, PooledEntry>();

function providerIndex(provider: McpProviderDef): number {
  return listMcpProviders().findIndex(p => p.id === provider.id);
}

async function ensureProviderUrl(env: ConnectorEnv, provider: McpProviderDef): Promise<string> {
  const existing = POOL.get(provider.id);
  if (existing) return existing.url;
  const url = await ensureContainerRunning(env, provider, providerIndex(provider));
  POOL.set(provider.id, { url });
  return url;
}

async function withClient<T>(
  env: ConnectorEnv,
  providerId: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  if (!env.mcpClientEnabled) {
    throw new McpClientError('MCP client backend is disabled (set mcpClientEnabled=true)');
  }
  const provider = getMcpProvider(providerId);
  if (!provider) {
    throw new McpClientError(`No MCP provider registered for id: ${providerId}`);
  }

  const url = await ensureProviderUrl(env, provider);
  const accessToken = await getFreshAccessToken(env, provider.id);
  const authDataB64 = Buffer.from(JSON.stringify({ access_token: accessToken })).toString('base64');

  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { 'x-auth-data': authDataB64 } },
  });
  const client = new Client({ name: 'smartware-connectors', version: '0.1.0' });

  try {
    await client.connect(transport);
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

export async function listMcpTools(env: ConnectorEnv, providerId: string): Promise<McpToolSummary[]> {
  return withClient(env, providerId, async client => {
    const resp = await client.listTools();
    return resp.tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
    }));
  });
}

/** Extract the first text block from an MCP tool result, if any. */
function firstTextBlock(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && typeof block === 'object' && (block as { type?: unknown }).type === 'text') {
      const text = (block as { text?: unknown }).text;
      if (typeof text === 'string') return text;
    }
  }
  return null;
}

export async function callMcpTool(
  env: ConnectorEnv,
  providerId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<McpCallResult> {
  return withClient(env, providerId, async client => {
    const result = await client.callTool({ name: toolName, arguments: args });
    const text = firstTextBlock(result.content);

    // Klavis servers return isError=false with body "Unknown tool: <name>" for unknown tools.
    if (text && /^Unknown tool:/i.test(text)) {
      throw new McpToolNotFoundError(providerId, toolName);
    }

    if (result.isError === true) {
      throw new McpToolExecutionError(providerId, toolName, text ?? 'unknown error');
    }

    return {
      content: result.content,
      isError: false,
    };
  });
}

/** Stop every container we've started. Called from app shutdown. */
export async function shutdownMcpClients(env: ConnectorEnv): Promise<void> {
  for (const provider of listMcpProviders()) {
    if (POOL.has(provider.id)) {
      await stopContainer(env, provider).catch(() => {});
    }
  }
  POOL.clear();
}
