import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { getDb, getSettings, insertEvent, setSettings } from '../pod/db.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { compileExperienceProjection } from './experience-memory.js';
import { compileConversationProjection } from './conversation-memory.js';

export const DREAM_CADENCE_NAMESPACE = 'pod.dream_cadence';
export const DREAM_CADENCE_MODES = ['manual_only', 'hourly', 'every_6h', 'daily'] as const;
export type DreamCadenceMode = typeof DREAM_CADENCE_MODES[number];

export interface DreamCadenceSettings extends Record<string, unknown> {
  mode: DreamCadenceMode;
  interval_seconds: number | null;
  last_dreamed_at: string | null;
  next_dream_after: string | null;
}

export const DEFAULT_DREAM_CADENCE: DreamCadenceSettings = {
  mode: 'daily',
  interval_seconds: 24 * 60 * 60,
  last_dreamed_at: null,
  next_dream_after: null,
};

const MODE_INTERVAL_SECONDS: Record<Exclude<DreamCadenceMode, 'manual_only'>, number> = {
  hourly: 60 * 60,
  every_6h: 6 * 60 * 60,
  daily: 24 * 60 * 60,
};

function boundedInterval(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : null;
}

export function applyDreamCadenceDefaults(values: Record<string, unknown>): DreamCadenceSettings {
  const mode = DREAM_CADENCE_MODES.includes(values['mode'] as DreamCadenceMode)
    ? values['mode'] as DreamCadenceMode
    : DEFAULT_DREAM_CADENCE.mode;
  const configuredInterval = boundedInterval(values['interval_seconds']);
  const interval = mode === 'manual_only'
    ? null
    : configuredInterval ?? MODE_INTERVAL_SECONDS[mode];
  return {
    mode,
    interval_seconds: interval,
    last_dreamed_at: typeof values['last_dreamed_at'] === 'string' ? values['last_dreamed_at'] : null,
    next_dream_after: typeof values['next_dream_after'] === 'string' ? values['next_dream_after'] : null,
  };
}

export function readDreamCadence(db: ReturnType<typeof getDb>): DreamCadenceSettings {
  return applyDreamCadenceDefaults(getSettings(db, DREAM_CADENCE_NAMESPACE));
}

export function validateDreamCadenceValues(values: Record<string, unknown>): string | null {
  const mode = values['mode'];
  if (mode !== undefined && !(typeof mode === 'string' && DREAM_CADENCE_MODES.includes(mode as DreamCadenceMode))) {
    return `pod.dream_cadence.mode must be one of ${DREAM_CADENCE_MODES.join(', ')}`;
  }
  const interval = values['interval_seconds'];
  if (interval !== undefined && interval !== null && boundedInterval(interval) === null) {
    return 'pod.dream_cadence.interval_seconds must be a positive number';
  }
  for (const key of ['last_dreamed_at', 'next_dream_after'] as const) {
    const value = values[key];
    if (value !== undefined && value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) {
      return `pod.dream_cadence.${key} must be an ISO date string or null`;
    }
  }
  return null;
}

export interface PodDreamCycleResult {
  run_id: string;
  phases: Array<{
    phase: string;
    op: string;
    operation_id: string;
    started_at: string;
    ended_at: string;
    outcome: 'clean' | 'findings' | 'error' | 'skipped';
    canonical_writes: string[];
    derived_writes: string[];
    errors: string[];
  }>;
  scope: string;
  started_at: string;
  ended_at: string;
  report_path?: string;
  mode: 'manual' | 'scheduled';
  scheduled: boolean;
  canonical_memory_writes_enabled: false;
  experience: {
    scopes_refreshed: number;
    lesson_count: number;
  };
  conversations: {
    scopes_refreshed: number;
    conversation_count: number;
  };
}

export async function runPodDreamCycle(
  env: CoffeePodEnv,
  input: {
    actorId: string;
    scope: string;
    mode: 'manual' | 'scheduled';
  },
): Promise<PodDreamCycleResult> {
  const core = await getSmartwareCore(env);
  const result = core.dream({
    actor: { type: 'person', id: input.actorId, display_name: input.actorId },
    scope: input.scope,
  });
  const experience = await compileExperienceProjection(env, input.scope);
  const conversations = await compileConversationProjection(env, input.scope);
  return {
    ...result,
    mode: input.mode,
    scheduled: input.mode === 'scheduled',
    canonical_memory_writes_enabled: false,
    experience: {
      scopes_refreshed: 1,
      lesson_count: experience.lessons.length,
    },
    conversations: {
      scopes_refreshed: 1,
      conversation_count: conversations.conversations.length,
    },
  };
}

export interface PodDreamAllScopesCycleResult {
  mode: 'manual' | 'scheduled';
  scheduled: boolean;
  runs: PodDreamCycleResult[];
  cadence: DreamCadenceSettings;
}

export async function runPodDreamCycleAcrossScopes(
  env: CoffeePodEnv,
  input: { actorId: string; mode: 'manual' | 'scheduled'; now?: Date },
): Promise<PodDreamAllScopesCycleResult> {
  const db = getDb(env);
  const core = await getSmartwareCore(env);
  const profile = getPodProfile(core, env);
  const scopes = [...new Set(Object.values(profile.scopes))];
  const runs: PodDreamCycleResult[] = [];
  for (const scope of scopes) {
    runs.push(await runPodDreamCycle(env, {
      actorId: input.actorId,
      scope,
      mode: input.mode,
    }));
  }

  const now = input.now ?? new Date();
  const cadence = readDreamCadence(db);
  const updated = {
    ...cadence,
    last_dreamed_at: now.toISOString(),
    next_dream_after: cadence.interval_seconds
      ? new Date(now.getTime() + cadence.interval_seconds * 1000).toISOString()
      : null,
  };
  setSettings(db, DREAM_CADENCE_NAMESPACE, updated);
  insertEvent(db, {
    type: 'dream_completed',
    process: 'dream',
    actor_id: input.mode === 'scheduled' ? 'system:dream' : input.actorId,
    scope: 'all',
    title: input.mode === 'scheduled' ? 'Scheduled Dream completed' : 'Dream completed',
    detail: `${runs.length} data spaces · ${runs.reduce((count, run) => count + run.experience.lesson_count, 0)} lessons · ${runs.reduce((count, run) => count + run.conversations.conversation_count, 0)} conversations refreshed`,
    content: {
      mode: input.mode,
      run_ids: runs.map(run => run.run_id),
      scopes: runs.map(run => run.scope),
    },
  });
  return {
    mode: input.mode,
    scheduled: input.mode === 'scheduled',
    runs,
    cadence: updated,
  };
}

export type DueDreamCycleResult =
  | { status: 'skipped'; reason: string; cadence: DreamCadenceSettings }
  | { status: 'completed'; runs: PodDreamCycleResult[]; cadence: DreamCadenceSettings };

export function initializeDreamCadence(env: CoffeePodEnv, now = new Date()): DreamCadenceSettings {
  const db = getDb(env);
  const cadence = readDreamCadence(db);
  if (cadence.mode === 'manual_only' || cadence.next_dream_after) return cadence;
  const initialized = {
    ...cadence,
    next_dream_after: new Date(now.getTime() + (cadence.interval_seconds ?? 0) * 1000).toISOString(),
  };
  setSettings(db, DREAM_CADENCE_NAMESPACE, initialized);
  return initialized;
}

export async function runDueDreamCycle(env: CoffeePodEnv, now = new Date()): Promise<DueDreamCycleResult> {
  const db = getDb(env);
  const cadence = readDreamCadence(db);
  if (cadence.mode === 'manual_only') {
    return { status: 'skipped', reason: 'Scheduled Dream cadence is manual_only.', cadence };
  }
  if (!cadence.next_dream_after) {
    const initialized = initializeDreamCadence(env, now);
    return { status: 'skipped', reason: 'Scheduled Dream cadence initialized.', cadence: initialized };
  }
  if (now.getTime() < Date.parse(cadence.next_dream_after)) {
    return { status: 'skipped', reason: 'Scheduled Dream cycle is not due yet.', cadence };
  }

  const core = await getSmartwareCore(env);
  const profile = getPodProfile(core, env);
  const result = await runPodDreamCycleAcrossScopes(env, {
    actorId: profile.owner_id,
    mode: 'scheduled',
    now,
  });
  return { status: 'completed', runs: result.runs, cadence: result.cadence };
}

export function startDreamScheduler(
  app: FastifyInstance,
  env: CoffeePodEnv,
  pollIntervalMs = 60_000,
): () => void {
  initializeDreamCadence(env);
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void runDueDreamCycle(env)
      .catch(error => {
        const db = getDb(env);
        const cadence = readDreamCadence(db);
        const retrySeconds = Math.min(cadence.interval_seconds ?? 300, 300);
        const retryMinutes = Math.ceil(retrySeconds / 60);
        setSettings(db, DREAM_CADENCE_NAMESPACE, {
          ...cadence,
          next_dream_after: new Date(Date.now() + retrySeconds * 1000).toISOString(),
        });
        insertEvent(db, {
          type: 'dream_failed',
          process: 'dream',
          actor_id: 'system:dream',
          scope: 'all',
          title: 'Scheduled Dream cycle could not finish',
          detail: `Pod will retry in ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'}.`,
        });
        app.log.error({ error }, 'scheduled Dream cycle failed');
      })
      .finally(() => { running = false; });
  }, pollIntervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
