export interface DetectedAgent {
  agent_id: string;
  name: string;
  installed: boolean;
  auto_configurable: boolean;
  config_path: string | null;
  cli_path: string | null;
}

export interface AgentMcpEntry {
  type: 'http';
  url: string;
  headers: { Authorization: string };
}

export type ReflectionCadence = 'every_15m' | 'hourly' | 'every_6h' | 'daily' | 'manual_only';
export type LlmProvider = 'anthropic' | 'openai' | 'codex' | 'none';
export type LlmAuthMethod = 'account' | 'api_key';

export interface ReflectionCycleOption {
  id: ReflectionCadence;
  label: string;
  detail: string;
  tokenUse: string;
}

export const REFLECTION_CYCLE_OPTIONS: readonly ReflectionCycleOption[] = [
  { id: 'every_15m', label: '15 min', detail: 'Very fresh', tokenUse: 'Highest' },
  { id: 'hourly', label: '1 hour', detail: 'Frequent', tokenUse: 'Higher' },
  { id: 'every_6h', label: '6 hours', detail: 'Balanced', tokenUse: 'Moderate' },
  { id: 'daily', label: 'Daily', detail: 'Quiet', tokenUse: 'Lower' },
  { id: 'manual_only', label: 'Manual', detail: 'On demand', tokenUse: 'Only when run' },
] as const;

const REFLECTION_INTERVAL_SECONDS: Record<ReflectionCadence, number | null> = {
  every_15m: 15 * 60,
  hourly: 60 * 60,
  every_6h: 6 * 60 * 60,
  daily: 24 * 60 * 60,
  manual_only: null,
};

export function reflectionIntervalSeconds(cadence: ReflectionCadence): number | null {
  return REFLECTION_INTERVAL_SECONDS[cadence];
}

export function reflectionCycleLabel(cadence: ReflectionCadence): string {
  return REFLECTION_CYCLE_OPTIONS.find(option => option.id === cadence)?.label ?? 'Manual';
}

export function modelSetupSummary(
  provider: LlmProvider,
  authMethod: LlmAuthMethod | undefined,
  hasApiKey: boolean,
  configured: boolean,
): string {
  if (provider === 'none') return 'Not connected';
  const providerName = provider === 'openai' ? 'OpenAI' : provider === 'codex' ? 'Codex' : 'Anthropic';
  if (configured) return `${providerName} · connected`;
  if (authMethod === 'api_key' && hasApiKey) return `${providerName} · API key`;
  if (authMethod === 'account') return `${providerName} · sign-in pending`;
  return `${providerName} · connect later`;
}

export function normalizeReflectionCadence(value: unknown): ReflectionCadence {
  if (REFLECTION_CYCLE_OPTIONS.some(option => option.id === value)) return value as ReflectionCadence;
  // Earlier beta builds exposed minute-scale demo intervals. Move those users
  // to the least aggressive automatic beta preset instead of increasing spend.
  if (value === 'every_60s' || value === 'every_2m' || value === 'every_5m') return 'every_15m';
  return 'every_6h';
}

export function identitySlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function installedAgentsFirst(agents: DetectedAgent[]): DetectedAgent[] {
  return [...agents].sort((a, b) => {
    if (a.installed !== b.installed) return a.installed ? -1 : 1;
    if (a.auto_configurable !== b.auto_configurable) return a.auto_configurable ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function agentMcpEntry(podUrl: string, token: string): AgentMcpEntry {
  return {
    type: 'http',
    url: `${podUrl.replace(/\/+$/, '')}/mcp`,
    headers: { Authorization: `Bearer ${token}` },
  };
}

export function manualAgentConfig(agentId: string, entry: AgentMcpEntry): string {
  if (agentId === 'codex') {
    return [
      '[mcp_servers.coffee-pod]',
      `url = ${JSON.stringify(entry.url)}`,
      `http_headers = { Authorization = ${JSON.stringify(entry.headers.Authorization)} }`,
    ].join('\n');
  }

  if (agentId === 'hermes') {
    return [
      'mcp_servers:',
      '  coffee-pod:',
      `    url: ${JSON.stringify(entry.url)}`,
      '    headers:',
      `      Authorization: ${JSON.stringify(entry.headers.Authorization)}`,
    ].join('\n');
  }

  if (agentId === 'openclaw') {
    return JSON.stringify({
      mcp: {
        servers: {
          'coffee-pod': {
            url: entry.url,
            transport: 'streamable-http',
            headers: entry.headers,
          },
        },
      },
    }, null, 2);
  }

  if (agentId === 'kimi-code') {
    return JSON.stringify({
      mcpServers: {
        'coffee-pod': {
          url: entry.url,
          headers: entry.headers,
        },
      },
    }, null, 2);
  }

  if (agentId === 'deerflow') {
    return JSON.stringify({
      mcpServers: {
        'coffee-pod': {
          enabled: true,
          type: 'http',
          url: entry.url,
          headers: entry.headers,
        },
      },
    }, null, 2);
  }

  return JSON.stringify({
    mcpServers: {
      'coffee-pod': agentId === 'claude-code'
        ? { ...entry, type: 'http' }
        : entry,
    },
  }, null, 2);
}
