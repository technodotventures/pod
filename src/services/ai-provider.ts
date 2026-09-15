import fs from 'node:fs/promises';
import path from 'node:path';

import type { SmartwareCore } from 'smartware';

import type { CoffeePodEnv } from '../config/env.js';
import { readIntegrationConfig, writeIntegrationConfig } from '@technodotventures/smartware-connectors';
import { codexAppServer } from './codex-app-server.js';

export type AIProviderId = 'anthropic' | 'openai' | 'openrouter' | 'codex';
export type AIModelMode = 'auto' | 'fast' | 'deep';
export type AIProviderFailureReason =
  | 'model_unavailable'
  | 'authentication_failed'
  | 'rate_limited'
  | 'provider_error';

export class AIProviderRequestError extends Error {
  constructor(
    readonly providerId: AIProviderId,
    readonly model: string,
    readonly status: number,
    readonly reason: AIProviderFailureReason,
  ) {
    const detail = reason === 'model_unavailable'
      ? `: selected model ${model} is unavailable`
      : '';
    super(`${providerId} request failed (${status})${detail}`);
    this.name = 'AIProviderRequestError';
  }
}

export interface ActiveAIProvider {
  id: AIProviderId;
  apiKey?: string;
  orgId?: string;
  model: string;
  mode: AIModelMode;
  selectedForAI: boolean;
  configuredAt?: string;
  connectedAt?: string;
}

interface StoredAIProviderConfig extends Record<string, unknown> {
  api_key?: string;
  org_id?: string;
  model?: string;
  selected_for_ai?: boolean;
  configured_at?: string;
  connected_at?: string;
  authenticated?: boolean;
}

const AI_PROVIDER_IDS: AIProviderId[] = ['anthropic', 'openai', 'openrouter', 'codex'];

const DEFAULT_MODELS: Record<AIProviderId, Record<AIModelMode, string>> = {
  anthropic: {
    auto: 'claude-sonnet-4-6',
    fast: 'claude-haiku-4-5-20251001',
    deep: 'claude-sonnet-4-6',
  },
  openai: {
    auto: 'gpt-4.1',
    fast: 'gpt-4.1-mini',
    deep: 'gpt-4.1',
  },
  openrouter: {
    auto: 'anthropic/claude-sonnet-4',
    fast: 'anthropic/claude-haiku-4',
    deep: 'anthropic/claude-sonnet-4',
  },
  codex: {
    auto: 'codex',
    fast: 'codex',
    deep: 'codex',
  },
};

function parseTimestamp(value: unknown): number {
  if (typeof value !== 'string' || value.trim().length === 0) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function clearProviderEnv(): void {
  delete process.env['ANTHROPIC_API_KEY'];
  delete process.env['OPENAI_API_KEY'];
  delete process.env['OPENAI_ORG_ID'];
  delete process.env['OPENROUTER_API_KEY'];
}

function providerRequestError(
  provider: ActiveAIProvider,
  status: number,
): AIProviderRequestError {
  const reason: AIProviderFailureReason = status === 404
    ? 'model_unavailable'
    : status === 401 || status === 403
      ? 'authentication_failed'
      : status === 429
        ? 'rate_limited'
        : 'provider_error';
  return new AIProviderRequestError(provider.id, provider.model, status, reason);
}

function hasUsableKey(config: StoredAIProviderConfig): config is StoredAIProviderConfig & { api_key: string } {
  return typeof config.api_key === 'string' && config.api_key.trim().length > 0;
}

function resolveModel(providerId: AIProviderId, config: StoredAIProviderConfig, mode: AIModelMode): string {
  if (typeof config.model === 'string' && config.model.trim().length > 0) {
    return config.model.trim();
  }
  return DEFAULT_MODELS[providerId][mode];
}

function buildProviderFromConfig(providerId: AIProviderId, config: StoredAIProviderConfig, mode: AIModelMode): ActiveAIProvider | null {
  if (providerId === 'codex') {
    if (config.authenticated !== true) return null;
    return {
      id: providerId,
      model: resolveModel(providerId, config, mode),
      mode,
      selectedForAI: config.selected_for_ai === true,
      configuredAt: typeof config.configured_at === 'string' ? config.configured_at : undefined,
      connectedAt: typeof config.connected_at === 'string' ? config.connected_at : undefined,
    };
  }
  if (!hasUsableKey(config)) return null;
  return {
    id: providerId,
    apiKey: config.api_key.trim(),
    orgId: typeof config.org_id === 'string' && config.org_id.trim().length > 0 ? config.org_id.trim() : undefined,
    model: resolveModel(providerId, config, mode),
    mode,
    selectedForAI: config.selected_for_ai === true,
    configuredAt: typeof config.configured_at === 'string' ? config.configured_at : undefined,
    connectedAt: typeof config.connected_at === 'string' ? config.connected_at : undefined,
  };
}

async function loadProviderConfig(
  env: CoffeePodEnv,
  providerId: AIProviderId,
  mode: AIModelMode,
): Promise<{ providerId: AIProviderId; config: StoredAIProviderConfig; provider: ActiveAIProvider | null }> {
  const config = await readIntegrationConfig(env, providerId) as StoredAIProviderConfig;
  return { providerId, config, provider: buildProviderFromConfig(providerId, config, mode) };
}

export function isAIProviderId(serviceId: string): serviceId is AIProviderId {
  return AI_PROVIDER_IDS.includes(serviceId as AIProviderId);
}

export async function resolveConfiguredAIProvider(
  env: CoffeePodEnv,
  providerId: AIProviderId,
  mode: AIModelMode = 'auto',
): Promise<ActiveAIProvider | null> {
  const config = await readIntegrationConfig(env, providerId) as StoredAIProviderConfig;
  return buildProviderFromConfig(providerId, config, mode);
}

export async function resolveActiveAIProvider(env: CoffeePodEnv, mode: AIModelMode = 'auto'): Promise<ActiveAIProvider | null> {
  const candidates = await Promise.all(AI_PROVIDER_IDS.map(providerId => loadProviderConfig(env, providerId, mode)));
  const active = candidates
    .filter((entry): entry is typeof entry & { provider: ActiveAIProvider } => entry.provider !== null)
    .sort((left, right) => {
      const selectedDelta = Number(right.provider.selectedForAI) - Number(left.provider.selectedForAI);
      if (selectedDelta !== 0) return selectedDelta;
      const rightTime = parseTimestamp(right.provider.connectedAt) || parseTimestamp(right.provider.configuredAt);
      const leftTime = parseTimestamp(left.provider.connectedAt) || parseTimestamp(left.provider.configuredAt);
      return rightTime - leftTime;
    })[0];
  return active?.provider ?? null;
}

export async function setPreferredAIProvider(env: CoffeePodEnv, preferredId: AIProviderId): Promise<void> {
  const now = new Date().toISOString();
  const configs = await Promise.all(AI_PROVIDER_IDS.map(async providerId => ({
    providerId,
    config: await readIntegrationConfig(env, providerId) as StoredAIProviderConfig,
  })));

  await Promise.all(configs.map(async ({ providerId, config }) => {
    const nextConfig: StoredAIProviderConfig = { ...config };
    if (providerId === preferredId && (hasUsableKey(config) || (providerId === 'codex' && config.authenticated === true))) {
      nextConfig.selected_for_ai = true;
      nextConfig.configured_at = now;
    } else if (config.selected_for_ai) {
      nextConfig.selected_for_ai = false;
    }
    if (JSON.stringify(nextConfig) !== JSON.stringify(config)) {
      await writeIntegrationConfig(env, providerId, nextConfig);
    }
  }));
}

export async function reassignPreferredAIProvider(env: CoffeePodEnv): Promise<void> {
  const candidates = await Promise.all(AI_PROVIDER_IDS.map(async providerId => ({
    providerId,
    config: await readIntegrationConfig(env, providerId) as StoredAIProviderConfig,
  })));

  const winner = candidates
    .filter(entry => hasUsableKey(entry.config) || (entry.providerId === 'codex' && entry.config.authenticated === true))
    .sort((left, right) => {
      const rightTime = parseTimestamp(right.config.connected_at) || parseTimestamp(right.config.configured_at);
      const leftTime = parseTimestamp(left.config.connected_at) || parseTimestamp(left.config.configured_at);
      return rightTime - leftTime;
    })[0];

  await Promise.all(candidates.map(async ({ providerId, config }) => {
    if (Object.keys(config).length === 0) return;
    const nextConfig: StoredAIProviderConfig = { ...config, selected_for_ai: winner?.providerId === providerId };
    if (JSON.stringify(nextConfig) !== JSON.stringify(config)) {
      await writeIntegrationConfig(env, providerId, nextConfig);
    }
  }));
}

export async function syncSmartwareLLMConfig(env: CoffeePodEnv, core: SmartwareCore): Promise<ActiveAIProvider | null> {
  const active = await resolveActiveAIProvider(env, 'auto');
  clearProviderEnv();

  if (active?.id === 'anthropic') {
    process.env['ANTHROPIC_API_KEY'] = active.apiKey;
  } else if (active?.id === 'openai') {
    process.env['OPENAI_API_KEY'] = active.apiKey;
    if (active.orgId) process.env['OPENAI_ORG_ID'] = active.orgId;
  } else if (active?.id === 'openrouter') {
    process.env['OPENROUTER_API_KEY'] = active.apiKey;
  }

  const config = core.getConfig();
  // Smartware's embedded extractor does not speak the Codex app-server
  // protocol. Pod-level Ask/reflection can still use Codex; the substrate
  // remains model-free rather than receiving an invalid provider value.
  let nextProvider = active?.id === 'codex' ? 'none' : active?.id ?? 'none';
  let nextModel = active?.id === 'codex' ? '' : active?.model ?? '';
  // DeepSeek: the substrate extractor speaks DeepSeek natively (OpenAI-
  // compatible at api.deepseek.com), but DeepSeek is not one of the Pod UI's
  // provider integrations. Source it from the environment and use it only
  // when no Pod-level provider is selected for AI, so an explicit UI choice
  // still wins.
  const deepseekKey = process.env['DEEPSEEK_API_KEY']?.trim();
  if (nextProvider === 'none' && deepseekKey) {
    nextProvider = 'deepseek';
    nextModel = process.env['DEEPSEEK_MODEL']?.trim() || 'deepseek-chat';
  }
  if (config.llm.provider === nextProvider && config.llm.model === nextModel) {
    return active;
  }

  const configPath = path.join(env.dataDir, 'config.json');
  const nextConfig = {
    ...(config as unknown as Record<string, unknown>),
    llm: {
      ...(config.llm as Record<string, unknown>),
      provider: nextProvider,
      model: nextModel,
    },
  };
  await fs.writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');
  return active;
}

async function requestAnthropicText(
  provider: ActiveAIProvider,
  system: string | undefined,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': provider.apiKey!,
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw providerRequestError(provider, response.status);
  }

  const data = await response.json() as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = data.content?.find(item => item.type === 'text')?.text?.trim();
  if (!text) throw new Error('Anthropic returned no text');
  return text;
}

async function requestOpenAIText(
  provider: ActiveAIProvider,
  system: string | undefined,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${provider.apiKey!}`,
    'content-type': 'application/json',
  };
  if (provider.orgId) headers['OpenAI-Organization'] = provider.orgId;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.model,
      temperature: provider.mode === 'deep' ? 0.2 : 0,
      max_tokens: maxTokens,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw providerRequestError(provider, response.status);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  const text = typeof content === 'string'
    ? content.trim()
    : Array.isArray(content)
      ? content.map(part => typeof part.text === 'string' ? part.text : '').join('').trim()
      : '';
  if (!text) throw new Error('OpenAI returned no text');
  return text;
}

async function requestOpenRouterText(
  provider: ActiveAIProvider,
  system: string | undefined,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${provider.apiKey!}`,
      'content-type': 'application/json',
      'HTTP-Referer': 'https://meetcoffee.dev',
      'X-Title': 'Pod by Coffee',
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: provider.mode === 'deep' ? 0.2 : 0,
      max_tokens: maxTokens,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw providerRequestError(provider, response.status);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenRouter returned no text');
  return text;
}

export async function requestProviderText(
  provider: ActiveAIProvider,
  options: { system?: string; prompt: string; maxTokens?: number },
): Promise<string> {
  const maxTokens = options.maxTokens ?? 800;
  if (provider.id === 'anthropic') {
    return requestAnthropicText(provider, options.system, options.prompt, maxTokens);
  }
  if (provider.id === 'openrouter') {
    return requestOpenRouterText(provider, options.system, options.prompt, maxTokens);
  }
  if (provider.id === 'codex') {
    return codexAppServer.generateText({ ...options, maxTokens });
  }
  return requestOpenAIText(provider, options.system, options.prompt, maxTokens);
}
