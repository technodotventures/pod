import type { SmartwareCore } from 'smartware';

import type { PodObject } from '../pod/db.js';
import {
  listObjectMemoryObservations,
  recordObjectMemoryObservation,
  retireObjectMemoryObservation,
  type getDb,
} from '../pod/db.js';
import {
  isExternalIntegrationApp,
  protectIntegrationMemoryContent,
} from './integration-content-boundary.js';

type PodDb = ReturnType<typeof getDb>;

export interface LegacyObservationSource {
  app: string;
  source_id: string;
}

export interface ArtifactMemorySyncInput {
  db: PodDb;
  core: SmartwareCore;
  object: PodObject;
  actor: { type: 'person' | 'agent' | 'system'; id: string; display_name: string };
  scope: string;
  app: string;
  type: Parameters<SmartwareCore['observe']>[0]['type'];
  content: Parameters<SmartwareCore['observe']>[0]['content'];
  visibility: Parameters<SmartwareCore['observe']>[0]['visibility'];
  sensitive: boolean;
  observed_at?: string;
  legacy_sources?: LegacyObservationSource[];
}

export interface ArtifactMemorySyncResult {
  status: 'created' | 'unchanged';
  observation_id: string;
  source_id: string;
  retired_observation_ids: string[];
  retirement_failures: Array<{ observation_id: string; message: string }>;
}

export interface ArtifactMemoryRetireResult {
  retired_observation_ids: string[];
  retirement_failures: Array<{ observation_id: string; message: string }>;
}

export interface ObservedArtifactChunk {
  observation_id: string;
  source_id: string;
}

export function artifactObservationSourceId(object: PodObject): string {
  return `pod-object:${object.id}:v${object.version}:${object.hash_value.slice(0, 16)}`;
}

async function retireObservation(
  db: PodDb,
  core: SmartwareCore,
  observationId: string,
  reason: string,
): Promise<{ retired: boolean; message?: string }> {
  try {
    await core.forget({
      actor: {
        type: 'person',
        id: core.getConfig().owner_id,
        display_name: 'Owner',
      },
      target_obs_id: observationId,
      mode: 'tombstone',
      reason,
    });
    retireObjectMemoryObservation(db, observationId);
    return { retired: true };
  } catch (error) {
    return {
      retired: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function retireLegacySources(
  db: PodDb,
  core: SmartwareCore,
  sources: readonly LegacyObservationSource[],
  reason: string,
  excludeObservationId?: string,
): Promise<ArtifactMemoryRetireResult> {
  const retired_observation_ids: string[] = [];
  const retirement_failures: ArtifactMemoryRetireResult['retirement_failures'] = [];
  for (const source of sources) {
    const observationId = core.findObservationBySource(source.app, source.source_id);
    if (!observationId || observationId === excludeObservationId) continue;
    const result = await retireObservation(db, core, observationId, reason);
    if (result.retired) retired_observation_ids.push(observationId);
    else retirement_failures.push({ observation_id: observationId, message: result.message ?? 'retirement failed' });
  }
  return { retired_observation_ids, retirement_failures };
}

/**
 * Materialize one artifact version into Smartware and retire prior versions.
 *
 * The new observation is committed first. If retirement then fails, the old
 * lineage remains active and visible for retry rather than being hidden.
 */
export async function syncArtifactMemory(
  input: ArtifactMemorySyncInput,
): Promise<ArtifactMemorySyncResult> {
  const active = listObjectMemoryObservations(input.db, input.object.id, 'active');
  const current = active.find(entry => entry.object_hash === input.object.hash_value);
  if (current) {
    return {
      status: 'unchanged',
      observation_id: current.observation_id,
      source_id: current.source_id,
      retired_observation_ids: [],
      retirement_failures: [],
    };
  }

  const sourceId = artifactObservationSourceId(input.object);
  const protectedContent = isExternalIntegrationApp(input.app)
    ? protectIntegrationMemoryContent(input.app, sourceId, input.content).content
    : input.content;
  const observed = await input.core.observe({
    actor: input.actor,
    type: input.type,
    scope: input.scope,
    source_id: sourceId,
    content: protectedContent,
    visibility: input.visibility,
    sensitive: input.sensitive,
    observed_at: input.observed_at,
    app: input.app,
  });
  const observationId = observed.existing_id ?? observed.id;
  recordObjectMemoryObservation(input.db, {
    observation_id: observationId,
    object_id: input.object.id,
    object_version: input.object.version,
    object_hash: input.object.hash_value,
    source_app: input.app,
    source_id: sourceId,
    scope: input.scope,
  });

  const retired_observation_ids: string[] = [];
  const retirement_failures: ArtifactMemorySyncResult['retirement_failures'] = [];
  for (const previous of active) {
    if (previous.observation_id === observationId) continue;
    const result = await retireObservation(
      input.db,
      input.core,
      previous.observation_id,
      `Artifact ${input.object.id} advanced to version ${input.object.version}`,
    );
    if (result.retired) retired_observation_ids.push(previous.observation_id);
    else retirement_failures.push({
      observation_id: previous.observation_id,
      message: result.message ?? 'retirement failed',
    });
  }

  const legacy = await retireLegacySources(
    input.db,
    input.core,
    input.legacy_sources ?? [],
    `Artifact ${input.object.id} adopted versioned memory lineage`,
    observationId,
  );
  retired_observation_ids.push(...legacy.retired_observation_ids);
  retirement_failures.push(...legacy.retirement_failures);

  return {
    status: 'created',
    observation_id: observationId,
    source_id: sourceId,
    retired_observation_ids,
    retirement_failures,
  };
}

export async function retireArtifactMemory(
  db: PodDb,
  core: SmartwareCore,
  objectId: string,
  reason: string,
  legacySources: readonly LegacyObservationSource[] = [],
): Promise<ArtifactMemoryRetireResult> {
  const retired_observation_ids: string[] = [];
  const retirement_failures: ArtifactMemoryRetireResult['retirement_failures'] = [];
  for (const active of listObjectMemoryObservations(db, objectId, 'active')) {
    const result = await retireObservation(db, core, active.observation_id, reason);
    if (result.retired) retired_observation_ids.push(active.observation_id);
    else retirement_failures.push({
      observation_id: active.observation_id,
      message: result.message ?? 'retirement failed',
    });
  }
  const legacy = await retireLegacySources(db, core, legacySources, reason);
  retired_observation_ids.push(...legacy.retired_observation_ids);
  retirement_failures.push(...legacy.retirement_failures);
  return { retired_observation_ids, retirement_failures };
}

/**
 * Adopt observations created by a specialised importer (for example located
 * file chunks) into the same artifact lifecycle used by ordinary Pod objects.
 */
export async function adoptArtifactMemoryObservations(input: {
  db: PodDb;
  core: SmartwareCore;
  object: PodObject;
  source_app: string;
  scope: string;
  observations: readonly ObservedArtifactChunk[];
}): Promise<ArtifactMemoryRetireResult> {
  const currentIds = new Set(input.observations.map(observation => observation.observation_id));
  const active = listObjectMemoryObservations(input.db, input.object.id, 'active');
  for (const observation of input.observations) {
    recordObjectMemoryObservation(input.db, {
      observation_id: observation.observation_id,
      object_id: input.object.id,
      object_version: input.object.version,
      object_hash: input.object.hash_value,
      source_app: input.source_app,
      source_id: observation.source_id,
      scope: input.scope,
    });
  }

  const retired_observation_ids: string[] = [];
  const retirement_failures: ArtifactMemoryRetireResult['retirement_failures'] = [];
  for (const previous of active) {
    if (currentIds.has(previous.observation_id)) continue;
    const result = await retireObservation(
      input.db,
      input.core,
      previous.observation_id,
      `Artifact ${input.object.id} imported a replacement version`,
    );
    if (result.retired) retired_observation_ids.push(previous.observation_id);
    else retirement_failures.push({
      observation_id: previous.observation_id,
      message: result.message ?? 'retirement failed',
    });
  }
  return { retired_observation_ids, retirement_failures };
}
