import path from 'node:path';

import type { SmartwareCore } from 'smartware';

import type { CoffeePodEnv } from '../config/env.js';
import type { getDb } from '../pod/db.js';
import { getSettings } from '../pod/db.js';
import {
  resolveActiveAIProvider,
  resolveConfiguredAIProvider,
  type ActiveAIProvider,
} from './ai-provider.js';

export const RETRIEVAL_SETTINGS_NAMESPACE = 'pod.retrieval';

export interface RetrievalSettings extends Record<string, unknown> {
  semantic_mode: 'off' | 'shadow' | 'fallback';
  embedding_provider: 'active' | 'openai' | 'openrouter';
  embedding_model: string | null;
  embedding_timeout_ms: number;
  lexical_min_results: number;
  lexical_min_score: number;
  semantic_min_similarity: number;
  semantic_limit: number;
  max_index_claims: number;
}

export const DEFAULT_RETRIEVAL_SETTINGS: RetrievalSettings = {
  semantic_mode: 'off',
  embedding_provider: 'active',
  embedding_model: null,
  embedding_timeout_ms: 5_000,
  lexical_min_results: 2,
  lexical_min_score: 0.45,
  semantic_min_similarity: 0.4,
  semantic_limit: 8,
  max_index_claims: 5_000,
};

export function applyRetrievalSettingsDefaults(
  values: Record<string, unknown>,
): RetrievalSettings {
  return { ...DEFAULT_RETRIEVAL_SETTINGS, ...values } as RetrievalSettings;
}

export function validateRetrievalSettings(values: Record<string, unknown>): string | null {
  if (values['semantic_mode'] !== undefined
    && !['off', 'shadow', 'fallback'].includes(String(values['semantic_mode']))) {
    return 'pod.retrieval.semantic_mode must be off, shadow, or fallback';
  }
  if (values['embedding_provider'] !== undefined
    && !['active', 'openai', 'openrouter'].includes(String(values['embedding_provider']))) {
    return 'pod.retrieval.embedding_provider must be active, openai, or openrouter';
  }
  const boundedNumbers: Array<[keyof RetrievalSettings, number, number]> = [
    ['embedding_timeout_ms', 1_000, 30_000],
    ['lexical_min_results', 0, 20],
    ['lexical_min_score', 0, 1],
    ['semantic_min_similarity', -1, 1],
    ['semantic_limit', 1, 50],
    ['max_index_claims', 1, 50_000],
  ];
  for (const [key, min, max] of boundedNumbers) {
    const value = values[key];
    if (value !== undefined
      && (typeof value !== 'number'
        || !Number.isFinite(value)
        || value < min
        || value > max)) {
      return `pod.retrieval.${key} must be a number between ${min} and ${max}`;
    }
  }
  if (values['embedding_model'] !== undefined
    && values['embedding_model'] !== null
    && (typeof values['embedding_model'] !== 'string'
      || !values['embedding_model'].trim())) {
    return 'pod.retrieval.embedding_model must be a non-empty string or null';
  }
  return null;
}

export function readRetrievalSettings(db: ReturnType<typeof getDb>): RetrievalSettings {
  return applyRetrievalSettingsDefaults(
    getSettings(db, RETRIEVAL_SETTINGS_NAMESPACE),
  );
}

export function shouldUseSemanticFallback(
  lexical: Array<{ score: number }>,
  settings: RetrievalSettings,
): boolean {
  if (settings.semantic_mode !== 'fallback') return false;
  if (lexical.length < settings.lexical_min_results) return true;
  return (lexical[0]?.score ?? 0) < settings.lexical_min_score;
}

interface HybridActor {
  type: 'person' | 'agent' | 'system';
  id: string;
  display_name: string;
}

interface EmbeddingAdapter {
  provider: string;
  model: string;
  dimensions?: number;
  embed(texts: string[]): Promise<number[][]>;
}

interface SemanticStore {
  close(): void;
}

interface SmartwareHybridMatch {
  claim_id: string;
  entity_id: string;
  entity_name: string;
  predicate: string;
  text: string;
  scope: string;
  confidence: number;
  observation_ids: string[];
  rrf_score: number;
  lexical_rank: number | null;
  semantic_rank: number | null;
  semantic_relevance: number | null;
}

interface SmartwareHybridResult {
  canonical: {
    results: Array<{ claim?: { id: string } }>;
  };
  hybrid_results: SmartwareHybridMatch[];
  selected_channel: 'canonical' | 'hybrid';
  semantic_status: 'ok' | 'fallback' | 'unavailable' | 'skipped';
  semantic_index_status: 'ready' | 'missing' | 'degraded' | 'unavailable' | 'not_configured';
  semantic_error?: string;
  semantic_index_error?: string;
}

interface HybridSmartwareCore {
  syncSemanticIndex(
    params: {
      actor: HybridActor;
      scope: string;
      min_confidence?: number;
      epistemic?: string[];
      include_sensitive?: boolean;
      include_stale?: boolean;
    },
    options: {
      adapter: EmbeddingAdapter;
      store: SemanticStore;
      batch_size?: number;
      max_documents?: number;
    },
  ): Promise<unknown>;
  recallHybrid(
    params: {
      actor: HybridActor;
      query: string;
      scope: string;
      min_confidence?: number;
      epistemic?: string[];
      include_sensitive?: boolean;
      include_stale?: boolean;
      limit?: number;
      temporal?: {
        mode: 'range';
        axis: 'valid_time';
        from: string;
        to: string;
        relation?: 'overlaps' | 'starts_in';
      };
    },
    options: {
      adapter: EmbeddingAdapter;
      store: SemanticStore;
      min_similarity: number;
      limit: number;
      candidate_limit?: number;
    },
  ): Promise<SmartwareHybridResult>;
}

interface SmartwareRuntime {
  openSemanticRecordStore?: (dbPath: string) =>
    | { status: 'ready'; store: SemanticStore }
    | { status: 'unavailable'; store: null; error: string };
}

type EmbedTexts = (
  texts: string[],
  provider: ActiveAIProvider,
  model: string,
  timeoutMs: number,
) => Promise<number[][]>;

export interface HybridRecallRequest {
  actor: HybridActor;
  query: string;
  scope: string;
  min_confidence?: number;
  epistemic?: string[];
  include_stale?: boolean;
  temporal?: {
    mode: 'range';
    axis: 'valid_time';
    from: string;
    to: string;
    relation?: 'overlaps' | 'starts_in';
  };
}

export interface HybridClaimMatch {
  claim_id: string;
  entity_id: string;
  entity: string;
  predicate: string;
  text: string;
  scope: string;
  confidence: number;
  observation_ids: string[];
  rrf_score: number;
  lexical_rank: number | null;
  semantic_rank: number | null;
  similarity: number | null;
}

export interface HybridShadowComparison {
  canonical_count: number;
  hybrid_count: number;
  overlap_count: number;
  top1_agreement: boolean | null;
}

export interface HybridRecallEvaluation {
  status: 'disabled' | 'unavailable' | 'ok' | 'error';
  mode: RetrievalSettings['semantic_mode'];
  model?: string;
  selected_channel: 'canonical' | 'hybrid';
  semantic_status: SmartwareHybridResult['semantic_status'] | 'not_run';
  semantic_index_status: SmartwareHybridResult['semantic_index_status'];
  duration_ms: number;
  matches: HybridClaimMatch[];
  comparison: HybridShadowComparison;
  error?: string;
}

export interface HybridRetrievalDependencies {
  embedTexts?: EmbedTexts;
  runtime?: SmartwareRuntime;
  resolveProvider?: (
    env: CoffeePodEnv,
    settings: RetrievalSettings,
  ) => Promise<{ provider: ActiveAIProvider; model: string } | null>;
}

function modelDimensions(model: string): number | undefined {
  if (model === 'baai/bge-m3') return 1024;
  if (model.includes('text-embedding-3-small')) return 1536;
  if (model.includes('text-embedding-3-large')) return 3072;
  return undefined;
}

async function requestEmbeddings(
  texts: string[],
  provider: ActiveAIProvider,
  model: string,
  timeoutMs: number,
): Promise<number[][]> {
  const base = provider.id === 'openrouter'
    ? 'https://openrouter.ai/api/v1'
    : 'https://api.openai.com/v1';
  const headers: Record<string, string> = {
    authorization: `Bearer ${provider.apiKey}`,
    'content-type': 'application/json',
  };
  if (provider.id === 'openai' && provider.orgId) {
    headers['OpenAI-Organization'] = provider.orgId;
  }
  if (provider.id === 'openrouter') {
    headers['HTTP-Referer'] = 'https://meetcoffee.dev';
    headers['X-Title'] = 'Pod by Coffee';
  }
  const response = await fetch(`${base}/embeddings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, input: texts, encoding_format: 'float' }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Embedding request failed (${response.status})`);
  const data = await response.json() as {
    data?: Array<{ index?: number; embedding?: number[] }>;
  };
  const rows = [...(data.data ?? [])]
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
  if (rows.length !== texts.length
    || rows.some(row => !Array.isArray(row.embedding))) {
    throw new Error('Embedding provider returned an incomplete batch');
  }
  return rows.map(row => row.embedding!);
}

async function resolveEmbeddingProvider(
  env: CoffeePodEnv,
  settings: RetrievalSettings,
): Promise<{ provider: ActiveAIProvider; model: string } | null> {
  const provider = settings.embedding_provider === 'active'
    ? await resolveActiveAIProvider(env, 'fast')
    : await resolveConfiguredAIProvider(env, settings.embedding_provider, 'fast');
  if (!provider || provider.id === 'anthropic' || provider.id === 'codex') return null;
  const model = settings.embedding_model?.trim()
    || (provider.id === 'openrouter'
      ? 'baai/bge-m3'
      : 'text-embedding-3-small');
  return { provider, model };
}

function emptyComparison(): HybridShadowComparison {
  return {
    canonical_count: 0,
    hybrid_count: 0,
    overlap_count: 0,
    top1_agreement: null,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function evaluateSmartwareHybridRecall(
  env: CoffeePodEnv,
  db: ReturnType<typeof getDb>,
  core: SmartwareCore,
  request: HybridRecallRequest,
  dependencies: HybridRetrievalDependencies = {},
): Promise<HybridRecallEvaluation> {
  const startedAt = performance.now();
  const settings = readRetrievalSettings(db);
  const base = {
    mode: settings.semantic_mode,
    selected_channel: 'canonical' as const,
    semantic_status: 'not_run' as const,
    semantic_index_status: 'not_configured' as const,
    duration_ms: 0,
    matches: [] as HybridClaimMatch[],
    comparison: emptyComparison(),
  };
  if (settings.semantic_mode === 'off' || !request.query.trim()) {
    return { ...base, status: 'disabled' };
  }

  const hybridCore = core as unknown as Partial<HybridSmartwareCore>;
  if (typeof hybridCore.syncSemanticIndex !== 'function'
    || typeof hybridCore.recallHybrid !== 'function') {
    return { ...base, status: 'unavailable' };
  }

  let resolved: { provider: ActiveAIProvider; model: string } | null;
  try {
    resolved = await (dependencies.resolveProvider ?? resolveEmbeddingProvider)(
      env,
      settings,
    );
  } catch (error) {
    return {
      ...base,
      status: 'error',
      duration_ms: performance.now() - startedAt,
      error: errorMessage(error),
    };
  }
  if (!resolved) return { ...base, status: 'unavailable' };

  let runtime: SmartwareRuntime;
  try {
    runtime = dependencies.runtime
      ?? await import('smartware') as unknown as SmartwareRuntime;
  } catch (error) {
    return {
      ...base,
      status: 'error',
      model: resolved.model,
      duration_ms: performance.now() - startedAt,
      error: errorMessage(error),
    };
  }
  if (typeof runtime.openSemanticRecordStore !== 'function') {
    return {
      ...base,
      status: 'unavailable',
      model: resolved.model,
    };
  }
  let opened: ReturnType<NonNullable<SmartwareRuntime['openSemanticRecordStore']>>;
  try {
    opened = runtime.openSemanticRecordStore(
      path.join(env.dataDir, 'indices', 'semantic.db'),
    );
  } catch (error) {
    return {
      ...base,
      status: 'error',
      model: resolved.model,
      semantic_index_status: 'unavailable',
      duration_ms: performance.now() - startedAt,
      error: errorMessage(error),
    };
  }
  if (opened.status !== 'ready') {
    return {
      ...base,
      status: 'unavailable',
      model: resolved.model,
      semantic_index_status: 'unavailable',
      error: opened.error,
    };
  }

  const embedTexts = dependencies.embedTexts ?? requestEmbeddings;
  const adapter: EmbeddingAdapter = {
    provider: resolved.provider.id,
    model: resolved.model,
    dimensions: modelDimensions(resolved.model),
    embed: texts => embedTexts(
      texts,
      resolved.provider,
      resolved.model,
      settings.embedding_timeout_ms,
    ),
  };

  try {
    await hybridCore.syncSemanticIndex(
      {
        actor: request.actor,
        scope: request.scope,
        min_confidence: request.min_confidence,
        epistemic: request.epistemic,
        include_sensitive: false,
        include_stale: request.include_stale,
      },
      {
        adapter,
        store: opened.store,
        batch_size: 64,
        max_documents: settings.max_index_claims,
      },
    );
    const result = await hybridCore.recallHybrid(
      {
        actor: request.actor,
        query: request.query,
        scope: request.scope,
        min_confidence: request.min_confidence,
        epistemic: request.epistemic,
        include_sensitive: false,
        include_stale: request.include_stale,
        limit: settings.semantic_limit,
        temporal: request.temporal,
      },
      {
        adapter,
        store: opened.store,
        min_similarity: settings.semantic_min_similarity,
        limit: settings.semantic_limit,
        candidate_limit: Math.max(settings.semantic_limit, 20),
      },
    );
    const canonicalIds = result.canonical.results
      .flatMap(candidate => candidate.claim ? [candidate.claim.id] : []);
    const hybridIds = result.hybrid_results.map(candidate => candidate.claim_id);
    const canonicalSet = new Set(canonicalIds);
    const matches = result.hybrid_results.map(candidate => ({
      claim_id: candidate.claim_id,
      entity_id: candidate.entity_id,
      entity: candidate.entity_name,
      predicate: candidate.predicate,
      text: candidate.text,
      scope: candidate.scope,
      confidence: candidate.confidence,
      observation_ids: candidate.observation_ids,
      rrf_score: candidate.rrf_score,
      lexical_rank: candidate.lexical_rank,
      semantic_rank: candidate.semantic_rank,
      similarity: candidate.semantic_relevance,
    }));
    return {
      status: 'ok',
      mode: settings.semantic_mode,
      model: resolved.model,
      selected_channel: result.selected_channel,
      semantic_status: result.semantic_status,
      semantic_index_status: result.semantic_index_status,
      duration_ms: performance.now() - startedAt,
      matches,
      comparison: {
        canonical_count: canonicalIds.length,
        hybrid_count: hybridIds.length,
        overlap_count: hybridIds.filter(id => canonicalSet.has(id)).length,
        top1_agreement: canonicalIds.length > 0 && hybridIds.length > 0
          ? canonicalIds[0] === hybridIds[0]
          : null,
      },
      ...(result.semantic_error === undefined
        ? {}
        : { error: result.semantic_error }),
    };
  } catch (error) {
    return {
      ...base,
      status: 'error',
      model: resolved.model,
      duration_ms: performance.now() - startedAt,
      error: errorMessage(error),
    };
  } finally {
    opened.store.close();
  }
}
