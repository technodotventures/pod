import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type Database from 'better-sqlite3';

import type { CoffeePodEnv } from '../config/env.js';
import { getDb, getSettings } from '../pod/db.js';

/** True when the local device PIN is configured. */
export function hasPinConfiguredSync(env: CoffeePodEnv): boolean {
  return existsSync(join(env.dataDir, 'pin.json'));
}

/**
 * 'strict'      — default when any auth is configured (apiToken or PIN). Every non-public route requires auth.
 * 'local-trust' — read-only GETs pass without auth; non-GETs still require auth. For dev/exploration.
 * 'open'        — no auth enforced anywhere (auth context is implicit owner). Use with caution.
 */
export type TrustMode = 'strict' | 'local-trust' | 'open';

export const TRUST_MODE_VALUES: readonly TrustMode[] = ['strict', 'local-trust', 'open'] as const;

// Cache by env *identity* (reference equality) so a process serving one env
// hits cache 99% of requests, while tests that build many apps with different
// envs each get their own cache slot and don't pollute each other.
let cache: { env: CoffeePodEnv; mode: TrustMode; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export function defaultTrustMode(env: CoffeePodEnv): TrustMode {
  return env.apiToken || hasPinConfiguredSync(env) ? 'strict' : 'open';
}

function readSettingMode(db: Database.Database): TrustMode | null {
  const values = getSettings(db, 'pod.trust_mode');
  const mode = (values['mode'] ?? '') as string;
  return TRUST_MODE_VALUES.includes(mode as TrustMode) ? (mode as TrustMode) : null;
}

export function resolveTrustMode(env: CoffeePodEnv): TrustMode {
  if (cache && cache.env === env && cache.expiresAt > Date.now()) return cache.mode;
  let mode: TrustMode;
  try {
    const db = getDb(env);
    mode = readSettingMode(db) ?? defaultTrustMode(env);
  } catch {
    mode = defaultTrustMode(env);
  }
  cache = { env, mode, expiresAt: Date.now() + CACHE_TTL_MS };
  return mode;
}

/** Call when the pod.trust_mode setting is mutated so the next request sees the new value. */
export function invalidateTrustModeCache(): void {
  cache = null;
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export function isReadOnly(method: string): boolean {
  return READ_METHODS.has(method.toUpperCase());
}
