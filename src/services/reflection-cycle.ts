import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { getDb, getSettings, insertEvent, setSettings } from '../pod/db.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { resolveReflectionModelUse } from './memory-settings.js';

export const REFLECTION_CADENCE_NAMESPACE = 'pod.reflect_cadence';
export const REFLECTION_CADENCE_MODES = ['manual_only', 'every_15m', 'hourly', 'every_6h', 'daily'] as const;
export type ReflectionCadenceMode = typeof REFLECTION_CADENCE_MODES[number];
const LEGACY_REFLECTION_CADENCE_MODES = ['every_60s', 'every_2m', 'every_5m'] as const;

export interface ReflectionCadenceSettings extends Record<string, unknown> {
  mode: ReflectionCadenceMode;
  interval_seconds: number | null;
  last_reflected_at: string | null;
  next_reflect_after: string | null;
}

export const DEFAULT_REFLECTION_CADENCE: ReflectionCadenceSettings = {
  mode: 'manual_only',
  interval_seconds: null,
  last_reflected_at: null,
  next_reflect_after: null,
};

const MODE_INTERVAL_SECONDS: Record<Exclude<ReflectionCadenceMode, 'manual_only'>, number> = {
  every_15m: 15 * 60,
  hourly: 60 * 60,
  every_6h: 6 * 60 * 60,
  daily: 24 * 60 * 60,
};

function boundedInterval(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : null;
}

function timestampOrNull(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

export function reflectionIntervalSeconds(mode: ReflectionCadenceMode): number | null {
  return mode === 'manual_only' ? null : MODE_INTERVAL_SECONDS[mode];
}

export function applyReflectionCadenceDefaults(values: Record<string, unknown>): ReflectionCadenceSettings {
  const rawMode = values['mode'];
  const legacyMode = typeof rawMode === 'string'
    && LEGACY_REFLECTION_CADENCE_MODES.includes(rawMode as typeof LEGACY_REFLECTION_CADENCE_MODES[number]);
  const mode = legacyMode
    ? 'every_15m'
    : REFLECTION_CADENCE_MODES.includes(rawMode as ReflectionCadenceMode)
      ? rawMode as ReflectionCadenceMode
      : DEFAULT_REFLECTION_CADENCE.mode;
  const configuredInterval = legacyMode ? null : boundedInterval(values['interval_seconds']);
  return {
    mode,
    interval_seconds: mode === 'manual_only'
      ? null
      : configuredInterval ?? MODE_INTERVAL_SECONDS[mode],
    last_reflected_at: timestampOrNull(values['last_reflected_at']),
    next_reflect_after: mode === 'manual_only' ? null : timestampOrNull(values['next_reflect_after']),
  };
}

export function validateReflectionCadenceValues(values: Record<string, unknown>): string | null {
  const mode = values['mode'];
  if (mode !== undefined
    && !(typeof mode === 'string'
      && (REFLECTION_CADENCE_MODES.includes(mode as ReflectionCadenceMode)
        || LEGACY_REFLECTION_CADENCE_MODES.includes(mode as typeof LEGACY_REFLECTION_CADENCE_MODES[number])))) {
    return `pod.reflect_cadence.mode must be one of ${REFLECTION_CADENCE_MODES.join(', ')}`;
  }
  const interval = values['interval_seconds'];
  if (interval !== undefined && interval !== null && boundedInterval(interval) === null) {
    return 'pod.reflect_cadence.interval_seconds must be a positive number';
  }
  for (const key of ['last_reflected_at', 'next_reflect_after'] as const) {
    const value = values[key];
    if (value !== undefined && value !== null && timestampOrNull(value) === null) {
      return `pod.reflect_cadence.${key} must be an ISO date string or null`;
    }
  }
  return null;
}

export function readReflectionCadence(db: ReturnType<typeof getDb>): ReflectionCadenceSettings {
  return applyReflectionCadenceDefaults(getSettings(db, REFLECTION_CADENCE_NAMESPACE));
}

export function initializeReflectionCadence(
  env: CoffeePodEnv,
  now = new Date(),
): ReflectionCadenceSettings {
  const db = getDb(env);
  const cadence = readReflectionCadence(db);
  if (cadence.mode === 'manual_only' || cadence.next_reflect_after) return cadence;
  const initialized = {
    ...cadence,
    next_reflect_after: new Date(now.getTime() + (cadence.interval_seconds ?? 0) * 1000).toISOString(),
  };
  setSettings(db, REFLECTION_CADENCE_NAMESPACE, initialized);
  return initialized;
}

export function updateReflectionCadenceAfterRun(
  db: ReturnType<typeof getDb>,
  cadence: ReflectionCadenceSettings,
  now = new Date(),
): ReflectionCadenceSettings {
  const intervalSeconds = cadence.interval_seconds ?? reflectionIntervalSeconds(cadence.mode);
  const next = intervalSeconds ? new Date(now.getTime() + intervalSeconds * 1000).toISOString() : null;
  return setSettings(db, REFLECTION_CADENCE_NAMESPACE, {
    ...cadence,
    interval_seconds: intervalSeconds,
    last_reflected_at: now.toISOString(),
    next_reflect_after: next,
  }) as unknown as ReflectionCadenceSettings;
}

export interface PodReflectionCycleResult {
  mode: 'manual' | 'scheduled';
  use_llm: boolean;
  scopes: Array<{
    scope: string;
    claims_created: number;
    pages_compiled: number;
  }>;
  claims_created: number;
  pages_compiled: number;
  cadence: ReflectionCadenceSettings;
}

export async function runPodReflectionCycle(
  env: CoffeePodEnv,
  input: { actorId: string; mode: 'manual' | 'scheduled'; useLlm?: boolean; now?: Date },
): Promise<PodReflectionCycleResult> {
  const db = getDb(env);
  const core = await getSmartwareCore(env);
  const profile = getPodProfile(core, env);
  const scopes = [...new Set(Object.values(profile.scopes))];
  const useLlm = resolveReflectionModelUse(db, input.useLlm);
  const runs: PodReflectionCycleResult['scopes'] = [];
  const eventResults: Array<{
    scope: string;
    claims_created: number;
    pages_compiled: number;
    pages: Array<{ id: string; title: string; entity_id: string; path: string }>;
  }> = [];

  for (const scope of scopes) {
    const result = await core.compile({
      actor: { type: 'person', id: input.actorId, display_name: 'Pod owner' },
      scope,
      use_llm: useLlm,
    });
    runs.push({
      scope,
      claims_created: result.claims_created,
      pages_compiled: result.pages_compiled,
    });
    eventResults.push({
      scope,
      claims_created: result.claims_created,
      pages_compiled: result.pages_compiled,
      pages: result.audit.map(page => {
        const normalizedPath = page.path.replaceAll('\\', '/');
        const relativePath = normalizedPath.includes('/wiki/')
          ? normalizedPath.slice(normalizedPath.lastIndexOf('/wiki/') + '/wiki/'.length)
          : normalizedPath.split('/').slice(-2).join('/');
        return {
          id: `wiki:${relativePath.replace(/\.md$/i, '')}`,
          title: page.entity_name,
          entity_id: page.entity_id,
          path: relativePath,
        };
      }),
    });
  }

  const cadence = updateReflectionCadenceAfterRun(db, readReflectionCadence(db), input.now);
  const claimsCreated = runs.reduce((total, run) => total + run.claims_created, 0);
  const pagesCompiled = runs.reduce((total, run) => total + run.pages_compiled, 0);
  insertEvent(db, {
    type: 'reflect',
    process: 'reflect',
    actor_id: input.mode === 'scheduled' ? 'system:reflect' : input.actorId,
    scope: 'all',
    title: input.mode === 'scheduled' ? 'Scheduled reflection completed' : 'Reflection completed',
    detail: `${runs.length} data spaces · ${claimsCreated} claims · ${pagesCompiled} pages`,
    content: {
      mode: input.mode,
      use_llm: useLlm,
      claims_created: claimsCreated,
      pages_compiled: pagesCompiled,
      scopes: runs.map(run => run.scope),
      results: eventResults,
    },
  });
  return {
    mode: input.mode,
    use_llm: useLlm,
    scopes: runs,
    claims_created: claimsCreated,
    pages_compiled: pagesCompiled,
    cadence,
  };
}

export type DueReflectionCycleResult =
  | { status: 'skipped'; reason: string; cadence: ReflectionCadenceSettings }
  | { status: 'completed'; result: PodReflectionCycleResult };

export async function runDueReflectionCycle(
  env: CoffeePodEnv,
  now = new Date(),
): Promise<DueReflectionCycleResult> {
  const db = getDb(env);
  const cadence = readReflectionCadence(db);
  if (cadence.mode === 'manual_only') {
    return { status: 'skipped', reason: 'Scheduled reflection is manual_only.', cadence };
  }
  if (!cadence.next_reflect_after) {
    const initialized = initializeReflectionCadence(env, now);
    return { status: 'skipped', reason: 'Scheduled reflection cadence initialized.', cadence: initialized };
  }
  if (now.getTime() < Date.parse(cadence.next_reflect_after)) {
    return { status: 'skipped', reason: 'Scheduled reflection is not due yet.', cadence };
  }
  const core = await getSmartwareCore(env);
  const profile = getPodProfile(core, env);
  return {
    status: 'completed',
    result: await runPodReflectionCycle(env, {
      actorId: profile.owner_id,
      mode: 'scheduled',
      now,
    }),
  };
}

export function startReflectionScheduler(
  app: FastifyInstance,
  env: CoffeePodEnv,
  pollIntervalMs = 60_000,
): () => void {
  initializeReflectionCadence(env);
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void runDueReflectionCycle(env)
      .catch(error => {
        const db = getDb(env);
        const cadence = readReflectionCadence(db);
        const retrySeconds = Math.min(cadence.interval_seconds ?? 300, 300);
        setSettings(db, REFLECTION_CADENCE_NAMESPACE, {
          ...cadence,
          next_reflect_after: new Date(Date.now() + retrySeconds * 1000).toISOString(),
        });
        insertEvent(db, {
          type: 'reflect_failed',
          process: 'reflect',
          actor_id: 'system:reflect',
          scope: 'all',
          title: 'Scheduled reflection could not finish',
          detail: `Pod will retry in ${Math.ceil(retrySeconds / 60)} minute${retrySeconds === 60 ? '' : 's'}.`,
        });
        app.log.error({ error }, 'scheduled reflection failed');
      })
      .finally(() => { running = false; });
  }, pollIntervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
