import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';

import type { CoffeePodEnv } from '../config/env.js';
import { getSettings, setSettings } from './db.js';

export const POD_RUNTIME_IDENTITY_NAMESPACE = 'pod.runtime_identity';

interface SmartwareConfigShape {
  scopes?: Array<{ id?: unknown }>;
}

interface PodIdentitySelection {
  requestedId: string;
  explicit: boolean;
  persistedId?: unknown;
  scopeIds: readonly string[];
}

function validPodId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(trimmed) ? trimmed : undefined;
}

export function inferPodIdFromScopes(scopeIds: readonly string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const scope of scopeIds) {
    const match = /^pod\/([^/]+)\/(?:personal|workspace|workspaces\/|apps\/|meetings$|documents$|tasks$|agents$)/.exec(scope);
    if (!match?.[1]) continue;
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (ranked.length === 0) return undefined;
  if (ranked.length > 1 && ranked[0]![1] === ranked[1]![1]) return undefined;
  return ranked[0]![0];
}

export function selectPodId(input: PodIdentitySelection): string {
  const requested = validPodId(input.requestedId) ?? 'founder';
  if (input.explicit) return requested;
  return validPodId(input.persistedId)
    ?? inferPodIdFromScopes(input.scopeIds)
    ?? requested;
}

function smartwareScopeIds(dataDir: string): string[] {
  const configPath = path.join(dataDir, 'config.json');
  if (!fs.existsSync(configPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as SmartwareConfigShape;
    return (parsed.scopes ?? [])
      .map(scope => scope.id)
      .filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

/**
 * Resolve the Pod identity before Smartware opens.
 *
 * New Pods persist the requested identity. Restored Pods reuse that persisted
 * identity, while older backups infer it from their existing Smartware scopes.
 * An explicitly supplied COFFEE_POD_ID remains an operator override.
 */
export function reconcilePodIdentity(
  db: Database.Database,
  env: CoffeePodEnv,
): { podId: string; source: 'explicit' | 'persisted' | 'inferred' | 'default' } {
  const persisted = getSettings(db, POD_RUNTIME_IDENTITY_NAMESPACE)['pod_id'];
  const scopeIds = smartwareScopeIds(env.dataDir);
  const inferred = inferPodIdFromScopes(scopeIds);
  const podId = selectPodId({
    requestedId: env.podId,
    explicit: env.podIdExplicit === true,
    persistedId: persisted,
    scopeIds,
  });

  const source = env.podIdExplicit === true
    ? 'explicit'
    : validPodId(persisted)
      ? 'persisted'
      : inferred
        ? 'inferred'
        : 'default';

  env.podId = podId;
  setSettings(db, POD_RUNTIME_IDENTITY_NAMESPACE, { pod_id: podId });
  return { podId, source };
}
