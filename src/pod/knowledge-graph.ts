import type { SmartwareKnowledgeGraphSnapshot } from 'smartware';

import type { CoffeePodEnv } from '../config/env.js';
import { podObjectTemporalInterval } from '../services/ask-pod-search.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import {
  countObjects,
  getObject,
  type getDb,
  listAllObjectReferences,
  listActiveObjectMemoryObservations,
  listCollections,
  listGraphAnnotations,
  listObjects,
  type PodGraphAnnotation,
} from './db.js';

export const DEFAULT_GRAPH_OBJECT_LIMIT = 1_000;
export const MAX_GRAPH_OBJECT_LIMIT = 6_000;
export type KnowledgeGraphProjectionMode = 'overview' | 'complete' | 'neighborhood';

export type KnowledgeGraphEdgeLayer = 'structural' | 'canonical' | 'derived' | 'annotation';
export type KnowledgeGraphNodeRole = 'artifact' | 'semantic_entity' | 'collection' | 'derived_view';

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: string;
  role: KnowledgeGraphNodeRole;
  semantic_type?: string;
  artifact_kind?: string;
  group: string;
  properties?: Array<{ key: string; value: string }>;
  epistemic?: 'fact' | 'inference' | 'opinion' | 'stale' | 'contested' | 'mixed';
  created_at?: string;
  valid_at?: string;
  invalid_at?: string | null;
  recorded_at?: string;
  updated_at?: string;
  temporal_basis?: 'valid_time' | 'observed_time' | 'recorded_time';
  valid_intervals?: Array<{ from: string; to: string | null }>;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: 'solid' | 'dashed';
  layer: KnowledgeGraphEdgeLayer;
  provenance?: unknown;
  valid_at?: string;
  invalid_at?: string | null;
  direction?: 'directed' | 'undirected';
  note?: string;
}

export interface KnowledgeGraphProjection {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  meta: {
    object_count: number;
    object_total: number;
    object_limit: number;
    truncated: boolean;
    projection_mode: KnowledgeGraphProjectionMode;
    selection_strategy: 'representative_stratified' | 'complete_recency' | 'neighborhood';
    available_node_count: number;
    projected_node_count: number;
    root_node_id?: string;
    depth?: number;
    source_errors: Array<{ source: string; message: string }>;
  };
}

type PodDb = ReturnType<typeof getDb>;

const SMARTWARE_TYPE_TO_NODE_TYPE: Record<string, string> = {
  person: 'person',
  tool: 'tool',
  project: 'project',
  concept: 'concept',
  decision: 'decision',
  event: 'event',
  organisation: 'organisation',
  organization: 'organisation',
  company: 'organisation',
  agent: 'agent',
  preference: 'preference',
  manifest: 'artifact',
};

const SYNTHETIC_MAP_NODE_TYPES = new Set([
  'entity',
  'concept',
  'decision',
  'project',
  'person',
  'tool',
  'organisation',
  'event',
  'agent',
  'preference',
]);

const REFERENCE_LABELS: Record<string, string> = {
  belongs_to: 'belongs to',
  related_to: 'related to',
  derived_from: 'derived from',
  mentions: 'mentions',
  other_links: 'links to',
};

type CanonicalEpistemicTag = Exclude<NonNullable<KnowledgeGraphNode['epistemic']>, 'mixed'>;

export function parseGraphObjectLimit(value: unknown): number | null {
  if (value === undefined) return DEFAULT_GRAPH_OBJECT_LIMIT;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, MAX_GRAPH_OBJECT_LIMIT);
}

export function parseGraphProjectionMode(value: unknown): KnowledgeGraphProjectionMode | null {
  if (value === undefined) return 'overview';
  return value === 'overview' || value === 'complete' || value === 'neighborhood'
    ? value
    : null;
}

function graphObjectPriority(
  object: ReturnType<typeof listObjects>[number],
  degreeByObjectId: ReadonlyMap<string, number>,
): [number, string, number, string] {
  return [
    -(degreeByObjectId.get(object.id) ?? 0),
    object.created_at,
    -object.sort_order,
    object.id,
  ];
}

function compareGraphObjectPriority(
  left: ReturnType<typeof listObjects>[number],
  right: ReturnType<typeof listObjects>[number],
  degreeByObjectId: ReadonlyMap<string, number>,
): number {
  const a = graphObjectPriority(left, degreeByObjectId);
  const b = graphObjectPriority(right, degreeByObjectId);
  return a[0] - b[0]
    || b[1].localeCompare(a[1])
    || b[2] - a[2]
    || a[3].localeCompare(b[3]);
}

/**
 * Produce a deterministic overview that covers collections, artifact kinds,
 * source apps, and time buckets before filling by structural importance.
 * This is a projection policy only; it never deletes or caps stored memory.
 */
export function selectRepresentativeGraphObjects(
  objects: ReturnType<typeof listObjects>,
  limit: number,
  degreeByObjectId: ReadonlyMap<string, number> = new Map(),
): ReturnType<typeof listObjects> {
  if (objects.length <= limit) return objects.slice(0, limit);
  const dimensions = [
    (object: typeof objects[number]) => `collection:${object.collection_id || 'inbox'}`,
    (object: typeof objects[number]) => `kind:${object.kind || 'unknown'}`,
    (object: typeof objects[number]) => `source:${object.source_app || object.origin || 'pod'}`,
    (object: typeof objects[number]) => {
      const instant = podObjectTemporalInterval(object)?.start ?? object.created_at;
      return `time:${instant.slice(0, 7)}`;
    },
  ];
  const grouped = dimensions.map(dimension => {
    const groups = new Map<string, typeof objects>();
    for (const object of objects) {
      const key = dimension(object);
      const group = groups.get(key) ?? [];
      group.push(object);
      groups.set(key, group);
    }
    return [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, group]) => group.sort((left, right) =>
        compareGraphObjectPriority(left, right, degreeByObjectId)));
  });
  const cursors = grouped.map(groups => groups.map(() => 0));
  const selected: typeof objects = [];
  const selectedIds = new Set<string>();
  let progressed = true;
  while (selected.length < limit && progressed) {
    progressed = false;
    grouped.forEach((groups, dimensionIndex) => {
      groups.forEach((group, groupIndex) => {
        if (selected.length >= limit) return;
        let cursor = cursors[dimensionIndex]![groupIndex]!;
        while (cursor < group.length && selectedIds.has(group[cursor]!.id)) cursor += 1;
        cursors[dimensionIndex]![groupIndex] = cursor + 1;
        const candidate = group[cursor];
        if (!candidate) return;
        selected.push(candidate);
        selectedIds.add(candidate.id);
        progressed = true;
      });
    });
  }
  if (selected.length < limit) {
    const remainder = objects
      .filter(object => !selectedIds.has(object.id))
      .sort((left, right) => compareGraphObjectPriority(left, right, degreeByObjectId));
    selected.push(...remainder.slice(0, limit - selected.length));
  }
  return selected;
}

function selectRepresentativeSmartwareSnapshot(
  snapshot: SmartwareKnowledgeGraphSnapshot,
  limit: number,
  selectedObservationIds: ReadonlySet<string>,
  pinnedEntityIds: ReadonlySet<string> = new Set(),
): SmartwareKnowledgeGraphSnapshot {
  if (snapshot.entities.length <= limit) return snapshot;
  const claimsByEntity = new Map<string, SmartwareKnowledgeGraphSnapshot['claims']>();
  for (const claim of snapshot.claims) {
    const claims = claimsByEntity.get(claim.subject_id) ?? [];
    claims.push(claim);
    claimsByEntity.set(claim.subject_id, claims);
  }
  const linkedToSelectedArtifact = (entityId: string) =>
    (claimsByEntity.get(entityId) ?? []).some(claim =>
      claim.provenance.observation_ids.some(observationId =>
        selectedObservationIds.has(observationId)));
  const priority = (left: typeof snapshot.entities[number], right: typeof snapshot.entities[number]) =>
    Number(linkedToSelectedArtifact(right.entity_id)) - Number(linkedToSelectedArtifact(left.entity_id))
    || (claimsByEntity.get(right.entity_id)?.length ?? 0) - (claimsByEntity.get(left.entity_id)?.length ?? 0)
    || right.created_at.localeCompare(left.created_at)
    || left.entity_id.localeCompare(right.entity_id);
  const dimensions = [
    (entity: typeof snapshot.entities[number]) => `type:${entity.type || 'entity'}`,
    (entity: typeof snapshot.entities[number]) => `scope:${entity.scope}`,
    (entity: typeof snapshot.entities[number]) => `time:${entity.created_at.slice(0, 7)}`,
  ];
  const selectedIds = new Set<string>();
  const selected: typeof snapshot.entities = [];
  for (const entityId of pinnedEntityIds) {
    const entity = snapshot.entities.find(candidate => candidate.entity_id === entityId);
    if (!entity || selectedIds.has(entity.entity_id) || selected.length >= limit) continue;
    selected.push(entity);
    selectedIds.add(entity.entity_id);
  }
  const grouped = dimensions.map(dimension => {
    const groups = new Map<string, typeof snapshot.entities>();
    for (const entity of snapshot.entities) {
      const key = dimension(entity);
      const group = groups.get(key) ?? [];
      group.push(entity);
      groups.set(key, group);
    }
    return [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, group]) => group.sort(priority));
  });
  const cursors = grouped.map(groups => groups.map(() => 0));
  let progressed = true;
  while (selected.length < limit && progressed) {
    progressed = false;
    grouped.forEach((groups, dimensionIndex) => {
      groups.forEach((group, groupIndex) => {
        if (selected.length >= limit) return;
        let cursor = cursors[dimensionIndex]![groupIndex]!;
        while (cursor < group.length && selectedIds.has(group[cursor]!.entity_id)) cursor += 1;
        cursors[dimensionIndex]![groupIndex] = cursor + 1;
        const candidate = group[cursor];
        if (!candidate) return;
        selected.push(candidate);
        selectedIds.add(candidate.entity_id);
        progressed = true;
      });
    });
  }
  if (selected.length < limit) {
    const remainder = snapshot.entities
      .filter(entity => !selectedIds.has(entity.entity_id))
      .sort(priority);
    for (const entity of remainder.slice(0, limit - selected.length)) {
      selected.push(entity);
      selectedIds.add(entity.entity_id);
    }
  }
  const claims = snapshot.claims.filter(claim => selectedIds.has(claim.subject_id));
  return { entities: selected, claims };
}

function semanticNeighborhoodEntityIds(
  snapshot: SmartwareKnowledgeGraphSnapshot,
  rootNodeId: string | undefined,
  depth: number,
): Set<string> {
  if (!rootNodeId?.startsWith('sw:')) return new Set();
  const root = rootNodeId.slice(3);
  const claimById = new Map(snapshot.claims.map(claim => [claim.claim_id, claim]));
  const entityByScopedName = new Map(snapshot.entities.map(entity =>
    [`${entity.scope}\u0000${normalizeExactTitle(entity.entity_name)}`, entity.entity_id]));
  const adjacency = new Map<string, Set<string>>();
  const connect = (left: string, right: string) => {
    if (left === right) return;
    const leftNeighbors = adjacency.get(left) ?? new Set<string>();
    leftNeighbors.add(right);
    adjacency.set(left, leftNeighbors);
    const rightNeighbors = adjacency.get(right) ?? new Set<string>();
    rightNeighbors.add(left);
    adjacency.set(right, rightNeighbors);
  };
  for (const claim of snapshot.claims) {
    for (const relation of claim.relations) {
      const target = claimById.get(relation.target)?.subject_id;
      if (target) connect(claim.subject_id, target);
    }
    if (claim.object.type === 'entity_ref' && typeof claim.object.value === 'string') {
      const target = snapshot.entities.find(entity => entity.entity_id === claim.object.value)?.entity_id
        ?? entityByScopedName.get(`${claim.scope}\u0000${normalizeExactTitle(claim.object.value)}`);
      if (target) connect(claim.subject_id, target);
    }
  }
  const reachable = new Set<string>([root]);
  let frontier = new Set<string>([root]);
  for (let hop = 0; hop < depth && frontier.size > 0; hop += 1) {
    const next = new Set<string>();
    for (const entityId of frontier) {
      for (const neighbor of adjacency.get(entityId) ?? []) {
        if (!reachable.has(neighbor)) next.add(neighbor);
      }
    }
    for (const entityId of next) reachable.add(entityId);
    frontier = next;
  }
  return reachable;
}

function selectObjectNeighborhood(
  objects: ReturnType<typeof listObjects>,
  references: ReturnType<typeof listAllObjectReferences>,
  rootNodeId: string | undefined,
  depth: number,
  limit: number,
): ReturnType<typeof listObjects> | null {
  if (!rootNodeId?.startsWith('obj:')) return null;
  const rootId = rootNodeId.slice(4);
  const reachable = new Set<string>([rootId]);
  let frontier = new Set<string>([rootId]);
  for (let hop = 0; hop < depth && frontier.size > 0; hop += 1) {
    const next = new Set<string>();
    for (const reference of references) {
      if (frontier.has(reference.source_object_id)
        && !reachable.has(reference.target_object_id)) next.add(reference.target_object_id);
      if (frontier.has(reference.target_object_id)
        && !reachable.has(reference.source_object_id)) next.add(reference.source_object_id);
    }
    for (const id of next) reachable.add(id);
    frontier = next;
  }
  return objects.filter(object => reachable.has(object.id)).slice(0, limit);
}

export function projectGraphAnnotation(annotation: PodGraphAnnotation): KnowledgeGraphEdge {
  return {
    id: `annotation:${annotation.id}`,
    source: annotation.source_node_id,
    target: annotation.target_node_id,
    label: annotation.label ?? annotation.relation ?? undefined,
    type: 'solid',
    layer: 'annotation',
    provenance: 'user_annotation',
    direction: annotation.direction,
    note: annotation.note ?? undefined,
    valid_at: annotation.created_at,
    invalid_at: null,
  };
}

function normalizeExactTitle(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function syntheticMapNodeType(
  object: ReturnType<typeof listObjects>[number],
): string | undefined {
  if (object.metadata?.['synthetic'] !== true || object.metadata?.['graph_stress'] !== true) {
    return undefined;
  }
  const mapNodeType = object.metadata['map_node_type'];
  return typeof mapNodeType === 'string' && SYNTHETIC_MAP_NODE_TYPES.has(mapNodeType)
    ? mapNodeType
    : undefined;
}

export function aggregateEpistemicTags(tags: CanonicalEpistemicTag[]): KnowledgeGraphNode['epistemic'] {
  const unique = new Set(tags);
  if (unique.size === 0) return undefined;
  if (unique.size > 1) return 'mixed';
  return unique.values().next().value;
}

function addSmartwareProjection(
  snapshot: SmartwareKnowledgeGraphSnapshot,
  scopeNames: Map<string, string>,
  objectNodesByTitle: Map<string, KnowledgeGraphNode[]>,
  objectNodeByObservationId: Map<string, KnowledgeGraphNode>,
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  nodeIds: Set<string>,
): void {
  const claimsBySubject = new Map<string, SmartwareKnowledgeGraphSnapshot['claims']>();
  const claimById = new Map(snapshot.claims.map((claim) => [claim.claim_id, claim]));
  for (const claim of snapshot.claims) {
    const claims = claimsBySubject.get(claim.subject_id) ?? [];
    claims.push(claim);
    claimsBySubject.set(claim.subject_id, claims);
  }

  const entitiesByTitle = new Map<string, SmartwareKnowledgeGraphSnapshot['entities']>();
  const entityById = new Map(snapshot.entities.map((entity) => [entity.entity_id, entity]));
  for (const entity of snapshot.entities) {
    const key = normalizeExactTitle(entity.entity_name);
    const matches = entitiesByTitle.get(key) ?? [];
    matches.push(entity);
    entitiesByTitle.set(key, matches);
  }

  for (const entity of snapshot.entities) {
    const claims = claimsBySubject.get(entity.entity_id) ?? [];
    const epistemic = aggregateEpistemicTags(claims.map((claim) => claim.epistemic_tag));
    const validIntervals = claims
      .map(claim => ({ from: claim.valid_at, to: claim.invalid_at }))
      .sort((left, right) => left.from.localeCompare(right.from));
    const recordedAt = claims
      .flatMap(claim => claim.recorded_at ? [claim.recorded_at] : [])
      .sort()[0];
    const node: KnowledgeGraphNode = {
      id: `sw:${entity.entity_id}`,
      label: entity.entity_name,
      type: SMARTWARE_TYPE_TO_NODE_TYPE[entity.type] ?? 'entity',
      role: 'semantic_entity',
      semantic_type: entity.type,
      group: `smartware:${scopeNames.get(entity.scope) ?? entity.scope}`,
      properties: [
        { key: 'scope', value: scopeNames.get(entity.scope) ?? entity.scope },
        { key: 'claims', value: String(claims.length) },
        { key: 'semantic type', value: entity.type },
      ],
      ...(epistemic ? { epistemic } : {}),
      created_at: entity.created_at,
      ...(validIntervals[0] ? {
        valid_at: validIntervals[0].from,
        invalid_at: validIntervals.length === 1 ? validIntervals[0].to : null,
        valid_intervals: validIntervals,
        temporal_basis: 'valid_time',
      } : {}),
      ...(recordedAt ? { recorded_at: recordedAt } : {}),
    };
    nodes.push(node);
    nodeIds.add(node.id);

    const provenanceByObject = new Map<string, { node: KnowledgeGraphNode; observationIds: Set<string>; claimIds: Set<string> }>();
    for (const claim of claims) {
      for (const observationId of claim.provenance.observation_ids) {
        const objectNode = objectNodeByObservationId.get(observationId);
        if (!objectNode) continue;
        const linked = provenanceByObject.get(objectNode.id) ?? {
          node: objectNode,
          observationIds: new Set<string>(),
          claimIds: new Set<string>(),
        };
        linked.observationIds.add(observationId);
        linked.claimIds.add(claim.claim_id);
        provenanceByObject.set(objectNode.id, linked);
      }
    }
    for (const linked of provenanceByObject.values()) {
      edges.push({
        id: `evidence:${node.id}:${linked.node.id}`,
        source: linked.node.id,
        target: node.id,
        label: 'evidence for',
        type: 'dashed',
        layer: 'derived',
        provenance: {
          origin: 'claim_observation_lineage',
          observation_ids: [...linked.observationIds].sort(),
          claim_ids: [...linked.claimIds].sort(),
        },
        direction: 'directed',
      });
    }

    const titleKey = normalizeExactTitle(entity.entity_name);
    const exactObjects = objectNodesByTitle.get(titleKey) ?? [];
    const exactEntities = entitiesByTitle.get(titleKey) ?? [];
    // Ambiguous names remain unlinked rather than creating a cartesian product.
    if (provenanceByObject.size === 0 && exactObjects.length === 1 && exactEntities.length === 1) {
      const objectNode = exactObjects[0];
      edges.push({
        id: `xref:${node.id}:${objectNode.id}`,
        source: node.id,
        target: objectNode.id,
        label: 'same title',
        type: 'dashed',
        layer: 'derived',
        provenance: 'title_exact',
        direction: 'undirected',
      });
    }
  }

  for (const claim of snapshot.claims) {
    const source = `sw:${claim.subject_id}`;
    if (!nodeIds.has(source)) continue;

    for (const relation of claim.relations) {
      const targetClaim = claimById.get(relation.target);
      if (!targetClaim) continue;
      const target = `sw:${targetClaim.subject_id}`;
      if (!nodeIds.has(target) || target === source) continue;
      edges.push({
        id: `sw-rel:${relation.relation_id}`,
        source,
        target,
        label: relation.kind,
        type: relation.invalid_at ? 'dashed' : 'solid',
        layer: 'derived',
        provenance: {
          origin: 'claim_relation_projection',
          source_claim_id: claim.claim_id,
          target_claim_id: targetClaim.claim_id,
          relation: relation.provenance,
        },
        valid_at: relation.valid_at,
        invalid_at: relation.invalid_at,
        direction: 'directed',
      });
    }

    if (claim.object.type !== 'entity_ref' || typeof claim.object.value !== 'string') continue;
    const candidates = entitiesByTitle.get(normalizeExactTitle(claim.object.value)) ?? [];
    const scopedCandidates = candidates.filter((candidate) => candidate.scope === claim.scope);
    const targetById = entityById.get(claim.object.value);
    const targetEntity = targetById
      ?? (scopedCandidates.length === 1 ? scopedCandidates[0] : undefined);
    if (!targetEntity) continue;
    const target = `sw:${targetEntity.entity_id}`;
    if (!nodeIds.has(target) || target === source) continue;
    edges.push({
      id: `sw-entity-ref:${claim.claim_id}`,
      source,
      target,
      label: claim.predicate,
      type: claim.invalid_at ? 'dashed' : 'solid',
      layer: targetById ? 'canonical' : 'derived',
      provenance: {
        ...claim.provenance,
        claim_id: claim.claim_id,
        target_resolution: targetById ? 'entity_id' : 'unique_scoped_title',
      },
      valid_at: claim.valid_at,
      invalid_at: claim.invalid_at,
      direction: 'directed',
    });
  }
}

export async function buildKnowledgeGraphProjection(
  db: PodDb,
  env: CoffeePodEnv,
  objectLimit: number,
  workspace?: { id: string; scope: string },
  options: {
    mode?: KnowledgeGraphProjectionMode;
    rootNodeId?: string;
    depth?: number;
    semanticLimit?: number;
  } = {},
): Promise<KnowledgeGraphProjection> {
  const mode = options.mode ?? 'overview';
  const nodes: KnowledgeGraphNode[] = [];
  const edges: KnowledgeGraphEdge[] = [];
  const nodeIds = new Set<string>();
  const sourceErrors: KnowledgeGraphProjection['meta']['source_errors'] = [];
  let semanticEntityTotal = 0;

  const collections = listCollections(db, workspace?.id);
  for (const collection of collections) {
    const id = `col:${collection.id}`;
    nodes.push({
      id,
      label: collection.name,
      type: 'collection',
      role: 'collection',
      group: 'collection',
      properties: [
        { key: 'kind', value: 'collection' },
        ...(collection.description ? [{ key: 'description', value: collection.description }] : []),
      ],
      created_at: collection.created_at,
      recorded_at: collection.created_at,
      updated_at: collection.updated_at,
      temporal_basis: 'recorded_time',
    });
    nodeIds.add(id);
  }
  for (const collection of collections) {
    if (!collection.parent_id) continue;
    const source = `col:${collection.parent_id}`;
    const target = `col:${collection.id}`;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    edges.push({
      id: `col-parent:${collection.id}`,
      source,
      target,
      label: 'contains',
      type: 'solid',
      layer: 'structural',
      provenance: 'pod_collection_parent',
      direction: 'directed',
    });
  }

  const objectTotal = countObjects(db, { workspaceId: workspace?.id, excludeSensitive: true });
  const references = listAllObjectReferences(db);
  const activeMemoryObservations = listActiveObjectMemoryObservations(db);
  const degreeByObjectId = new Map<string, number>();
  for (const reference of references) {
    degreeByObjectId.set(
      reference.source_object_id,
      (degreeByObjectId.get(reference.source_object_id) ?? 0) + 1,
    );
    degreeByObjectId.set(
      reference.target_object_id,
      (degreeByObjectId.get(reference.target_object_id) ?? 0) + 1,
    );
  }
  for (const lineage of activeMemoryObservations) {
    degreeByObjectId.set(
      lineage.object_id,
      (degreeByObjectId.get(lineage.object_id) ?? 0) + 1,
    );
  }
  const candidates = listObjects(db, {
    workspaceId: workspace?.id,
    limit: Math.max(objectTotal, 1),
    excludeSensitive: true,
  });
  const requestedDepth = Math.max(1, Math.min(3, Math.floor(options.depth ?? 1)));
  let objects = mode === 'neighborhood'
    ? selectObjectNeighborhood(candidates, references, options.rootNodeId, requestedDepth, objectLimit)
      ?? candidates.slice(0, objectLimit)
    : mode === 'overview'
      ? selectRepresentativeGraphObjects(candidates, objectLimit, degreeByObjectId)
      : candidates.slice(0, objectLimit);
  if (options.rootNodeId?.startsWith('obj:')) {
    const rootObject = getObject(db, options.rootNodeId.slice(4));
    if (rootObject
      && (!workspace || rootObject.workspace_id === workspace.id)
      && !rootObject.sensitive
      && !objects.some(object => object.id === rootObject.id)) {
      objects = [...objects.slice(0, Math.max(0, objectLimit - 1)), rootObject];
    }
  }
  const objectNodesByTitle = new Map<string, KnowledgeGraphNode[]>();
  const objectNodeByObjectId = new Map<string, KnowledgeGraphNode>();
  for (const object of objects) {
    const id = `obj:${object.id}`;
    const temporal = podObjectTemporalInterval(object);
    const mapNodeType = syntheticMapNodeType(object);
    const node: KnowledgeGraphNode = {
      id,
      label: object.title,
      type: mapNodeType ?? 'artifact',
      role: object.origin === 'reflected' || object.source_app === 'smartware-wiki'
        ? 'derived_view'
        : 'artifact',
      artifact_kind: object.kind,
      group: object.collection_id || 'inbox',
      properties: [
        { key: 'kind', value: object.kind },
        ...(mapNodeType ? [{ key: 'map type', value: mapNodeType }] : []),
        ...(object.origin ? [{ key: 'origin', value: object.origin }] : []),
        ...(object.source_app ? [{ key: 'source', value: object.source_app }] : []),
      ],
      created_at: object.created_at,
      ...(temporal && temporal.basis !== 'recorded_time' ? {
        valid_at: temporal.start,
        invalid_at: temporal.end,
        temporal_basis: temporal.basis,
      } : temporal ? { temporal_basis: temporal.basis } : {}),
      recorded_at: object.created_at,
      updated_at: object.updated_at,
    };
    nodes.push(node);
    nodeIds.add(id);
    objectNodeByObjectId.set(object.id, node);
    const title = normalizeExactTitle(object.title);
    const matches = objectNodesByTitle.get(title) ?? [];
    matches.push(node);
    objectNodesByTitle.set(title, matches);

    const collectionId = `col:${object.collection_id}`;
    if (nodeIds.has(collectionId)) {
      edges.push({
        id: `obj-col:${object.id}`,
        source: collectionId,
        target: id,
        label: 'contains',
        type: 'solid',
        layer: 'structural',
        provenance: 'pod_collection_membership',
        direction: 'directed',
      });
    }
  }

  const objectNodeByObservationId = new Map<string, KnowledgeGraphNode>();
  for (const lineage of activeMemoryObservations) {
    const objectNode = objectNodeByObjectId.get(lineage.object_id);
    if (objectNode) objectNodeByObservationId.set(lineage.observation_id, objectNode);
  }

  for (const reference of references) {
    const source = `obj:${reference.source_object_id}`;
    const target = `obj:${reference.target_object_id}`;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    edges.push({
      id: `ref:${reference.source_object_id}:${reference.target_object_id}:${reference.reference_type}`,
      source,
      target,
      label: REFERENCE_LABELS[reference.reference_type] ?? reference.reference_type,
      type: 'dashed',
      // Pod metadata links originate as title intents. They are useful
      // navigation, but they are not warranted Smartware claims or explicit
      // graph annotations and must not enter canonical topology analytics.
      layer: 'derived',
      provenance: {
        origin: 'pod_object_metadata_reference',
        reference_key: reference.reference_key,
        resolution: 'stable_id_from_title_intent',
      },
      valid_at: reference.created_at,
      invalid_at: null,
      direction: 'directed',
    });
  }

  try {
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const actor = {
      type: 'person' as const,
      id: core.getConfig().owner_id,
      display_name: 'Owner',
    };
    const scopeEntries = workspace
      ? [['personal', profile.scopes.personal], ['workspace', workspace.scope]]
      : Object.entries(profile.scopes);
    const fullSnapshot = core.readKnowledgeGraph({
      actor,
      scopes: scopeEntries.map(([, scope]) => scope),
      include_sensitive: false,
    });
    semanticEntityTotal = fullSnapshot.entities.length;
    const selectedObservationIds = new Set(objectNodeByObservationId.keys());
    const pinnedEntityIds = semanticNeighborhoodEntityIds(
      fullSnapshot,
      options.rootNodeId,
      requestedDepth,
    );
    const semanticLimit = Math.min(
      MAX_GRAPH_OBJECT_LIMIT,
      Math.max(
        pinnedEntityIds.size,
        options.semanticLimit
          ?? (mode === 'overview' ? Math.max(250, Math.floor(objectLimit / 2)) : objectLimit),
      ),
    );
    const snapshot = selectRepresentativeSmartwareSnapshot(
      fullSnapshot,
      semanticLimit,
      selectedObservationIds,
      pinnedEntityIds,
    );
    addSmartwareProjection(
      snapshot,
      new Map(scopeEntries.map(([name, scope]) => [scope, name])),
      objectNodesByTitle,
      objectNodeByObservationId,
      nodes,
      edges,
      nodeIds,
    );
  } catch (error) {
    sourceErrors.push({
      source: 'smartware',
      message: error instanceof Error ? error.message : 'Smartware graph source unavailable',
    });
  }

  for (const annotation of listGraphAnnotations(db)) {
    if (!nodeIds.has(annotation.source_node_id) || !nodeIds.has(annotation.target_node_id)) continue;
    edges.push(projectGraphAnnotation(annotation));
  }

  const availableNodeCount = objectTotal
    + collections.length
    + semanticEntityTotal;
  if (mode === 'neighborhood' && options.rootNodeId) {
    const depth = requestedDepth;
    const reachable = new Set<string>([options.rootNodeId]);
    let frontier = new Set<string>([options.rootNodeId]);
    for (let hop = 0; hop < depth && frontier.size > 0; hop += 1) {
      const next = new Set<string>();
      for (const edge of edges) {
        if (frontier.has(edge.source) && !reachable.has(edge.target)) next.add(edge.target);
        if (frontier.has(edge.target) && !reachable.has(edge.source)) next.add(edge.source);
      }
      for (const id of next) reachable.add(id);
      frontier = next;
    }
    const projectedNodes = nodes.filter(node => reachable.has(node.id));
    const projectedNodeIds = new Set(projectedNodes.map(node => node.id));
    const projectedEdges = edges.filter(edge =>
      projectedNodeIds.has(edge.source) && projectedNodeIds.has(edge.target));
    return {
      nodes: projectedNodes,
      edges: projectedEdges,
      meta: {
        object_count: projectedNodes.filter(node => node.role === 'artifact' || node.role === 'derived_view').length,
        object_total: objectTotal,
        object_limit: objectLimit,
        truncated: projectedNodes.length < availableNodeCount,
        projection_mode: mode,
        selection_strategy: 'neighborhood',
        available_node_count: availableNodeCount,
        projected_node_count: projectedNodes.length,
        root_node_id: options.rootNodeId,
        depth,
        source_errors: sourceErrors,
      },
    };
  }

  return {
    nodes,
    edges,
    meta: {
      object_count: objects.length,
      object_total: objectTotal,
      object_limit: objectLimit,
      truncated: availableNodeCount > nodes.length,
      projection_mode: mode,
      selection_strategy: mode === 'overview'
        ? 'representative_stratified'
        : 'complete_recency',
      available_node_count: availableNodeCount,
      projected_node_count: nodes.length,
      source_errors: sourceErrors,
    },
  };
}
