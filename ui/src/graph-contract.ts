export type GraphNodeType =
  | 'entity'
  | 'concept'
  | 'decision'
  | 'project'
  | 'person'
  | 'tool'
  | 'organisation'
  | 'event'
  | 'agent'
  | 'preference'
  | 'artifact'
  | 'collection';
export type GraphNodeRole = 'cluster' | 'node' | 'relationship';
export type GraphMemoryRole = 'artifact' | 'semantic_entity' | 'collection' | 'derived_view' | 'unknown';
export type GraphEpistemic = 'fact' | 'inference' | 'opinion' | 'stale' | 'contested' | 'mixed' | 'unclassified';
export type GraphEdgeLayer = 'structural' | 'canonical' | 'derived' | 'annotation';

export interface ApiGraphNode {
  id: string;
  label: string;
  type: string;
  role?: string;
  semantic_type?: string;
  artifact_kind?: string;
  group?: string;
  properties?: Array<{ key: string; value: string }>;
  epistemic?: string;
  created_at?: string;
  valid_at?: string;
  invalid_at?: string | null;
  recorded_at?: string;
  updated_at?: string;
  temporal_basis?: 'valid_time' | 'observed_time' | 'recorded_time';
  valid_intervals?: Array<{ from: string; to: string | null }>;
}

export interface ApiGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  relation?: string;
  direction?: 'directed' | 'undirected';
  note?: string;
  type?: 'solid' | 'dashed';
  layer?: GraphEdgeLayer;
  provenance?: unknown;
  valid_at?: string;
  invalid_at?: string | null;
}

export interface GraphSourceError {
  source?: string;
  message?: string;
  error?: string;
}

export interface GraphMeta {
  truncated?: boolean;
  object_count?: number;
  object_total?: number;
  projection_mode?: 'overview' | 'complete' | 'neighborhood';
  selection_strategy?: 'representative_stratified' | 'complete_recency' | 'neighborhood';
  available_node_count?: number;
  projected_node_count?: number;
  root_node_id?: string;
  depth?: number;
  source_errors?: Array<string | GraphSourceError>;
  [key: string]: unknown;
}

export interface ApiGraphResponse {
  nodes: ApiGraphNode[];
  edges: ApiGraphEdge[];
  meta?: GraphMeta;
}

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  role: GraphNodeRole;
  memoryRole: GraphMemoryRole;
  semanticType?: string;
  artifactKind?: string;
  x: number;
  y: number;
  cluster?: string;
  radius?: number;
  properties?: Array<{ key: string; value: string }>;
  epistemic: GraphEpistemic;
  created_at?: string;
  valid_at?: string;
  invalid_at?: string | null;
  recorded_at?: string;
  updated_at?: string;
  temporal_basis?: 'valid_time' | 'observed_time' | 'recorded_time';
  valid_intervals?: Array<{ from: string; to: string | null }>;
}

export interface GraphEdge extends ApiGraphEdge {
  layer: GraphEdgeLayer;
  type: 'solid' | 'dashed';
}

export interface GraphLabelSelectionOptions {
  width: number;
  height: number;
  pan: { x: number; y: number };
  zoom: number;
  zoomRatio: number;
  selectedId?: string | null;
  hoveredId?: string | null;
  connectedIds?: ReadonlySet<string>;
  importance?: Record<string, number>;
}

export interface OrbitLabelPresentation {
  visible: boolean;
  opacity: number;
  budget: number;
}

const NODE_TYPES = new Set<GraphNodeType>([
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
  'artifact',
  'collection',
]);
const MEMORY_ROLES = new Set<GraphMemoryRole>(['artifact', 'semantic_entity', 'collection', 'derived_view', 'unknown']);
const EPISTEMIC_STATES = new Set<GraphEpistemic>([
  'fact',
  'inference',
  'opinion',
  'stale',
  'contested',
  'mixed',
  'unclassified',
]);
const EDGE_LAYERS = new Set<GraphEdgeLayer>(['structural', 'canonical', 'derived', 'annotation']);

/** Keep explicit expanded views aligned with the Pod API safety ceiling. */
export const GRAPH_OBJECT_LIMIT = 6_000;
export const GRAPH_OVERVIEW_OBJECT_LIMIT = 2_000;

export function countGraphNodeTypes(
  nodes: Array<Pick<GraphNode, 'type' | 'role'>>,
): Map<GraphNodeType, number> {
  const counts = new Map<GraphNodeType, number>();
  for (const node of nodes) {
    if (node.role === 'relationship') continue;
    counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
  }
  return counts;
}

export function graphRequestUrl(options: {
  view?: 'overview' | 'complete' | 'neighborhood';
  limit?: number;
  root?: string;
  depth?: number;
} = {}): string {
  const view = options.view ?? 'overview';
  const limit = options.limit
    ?? (view === 'overview' ? GRAPH_OVERVIEW_OBJECT_LIMIT : GRAPH_OBJECT_LIMIT);
  const params = new URLSearchParams({ view, limit: String(limit) });
  if (options.root) params.set('root', options.root);
  if (options.depth !== undefined) params.set('depth', String(options.depth));
  return `/pod/graph?${params.toString()}`;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nodeType(value: string): GraphNodeType {
  return NODE_TYPES.has(value as GraphNodeType) ? value as GraphNodeType : 'entity';
}

function epistemicState(value?: string): GraphEpistemic {
  return value && EPISTEMIC_STATES.has(value as GraphEpistemic)
    ? value as GraphEpistemic
    : 'unclassified';
}

function memoryRole(node: ApiGraphNode): GraphMemoryRole {
  if (node.role && MEMORY_ROLES.has(node.role as GraphMemoryRole)) return node.role as GraphMemoryRole;
  if (node.id.startsWith('col:')) return 'collection';
  if (node.id.startsWith('obj:')) return 'artifact';
  if (node.id.startsWith('sw:')) return 'semantic_entity';
  return 'unknown';
}

function inferLegacyLayer(edge: ApiGraphEdge): GraphEdgeLayer {
  if (edge.id.startsWith('col-parent:') || edge.id.startsWith('obj-col:')) return 'structural';
  if (edge.id.startsWith('xref:') || edge.id.startsWith('sw-rel:') || edge.type === 'dashed') return 'derived';
  return 'canonical';
}

export function normalizeGraphEdge(edge: ApiGraphEdge): GraphEdge {
  const layer = edge.layer && EDGE_LAYERS.has(edge.layer) ? edge.layer : inferLegacyLayer(edge);
  return {
    ...edge,
    layer,
    type: edge.type ?? (layer === 'derived' ? 'dashed' : 'solid'),
  };
}

function effectiveGroup(node: ApiGraphNode): string {
  // A collection is the semantic hub for its own collection id. This keeps the real
  // collection node and its parent edge instead of replacing it with layout scaffolding.
  if (node.id.startsWith('col:')) return node.id.slice(4);
  return node.group || 'ungrouped';
}

/**
 * Deterministic semantic layout. Every returned node and edge came from the API;
 * group centres influence coordinates only and never become graph entities.
 */
export function layoutGraphData(apiNodes: ApiGraphNode[], apiEdges: ApiGraphEdge[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const groups = new Map<string, ApiGraphNode[]>();
  for (const node of [...apiNodes].sort((a, b) => a.id.localeCompare(b.id))) {
    const group = effectiveGroup(node);
    const members = groups.get(group) ?? [];
    members.push(node);
    groups.set(group, members);
  }

  const groupKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  const clusterCount = Math.max(groupKeys.length, 1);
  const clusterRadius = groupKeys.length <= 1 ? 0 : Math.max(360, Math.sqrt(clusterCount) * 260);
  const centerX = clusterRadius + 240;
  const centerY = clusterRadius + 240;
  const nodes: GraphNode[] = [];

  groupKeys.forEach((groupKey, groupIndex) => {
    const members = groups.get(groupKey) ?? [];
    const groupAngle = (2 * Math.PI * groupIndex) / clusterCount - Math.PI / 2;
    const cx = centerX + Math.cos(groupAngle) * clusterRadius;
    const cy = centerY + Math.sin(groupAngle) * clusterRadius;
    const collection = members.find(member => member.id === `col:${groupKey}`);
    const leaves = members.filter(member => member !== collection);

    if (collection) {
      nodes.push({
        id: collection.id,
        label: collection.label,
        type: nodeType(collection.type),
        role: 'cluster',
        memoryRole: memoryRole(collection),
        semanticType: collection.semantic_type,
        artifactKind: collection.artifact_kind,
        x: cx,
        y: cy,
        cluster: groupKey,
        radius: Math.min(14, 7 + Math.sqrt(Math.max(leaves.length, 1))),
        properties: collection.properties,
        epistemic: epistemicState(collection.epistemic),
        created_at: collection.created_at,
        valid_at: collection.valid_at,
        invalid_at: collection.invalid_at,
        recorded_at: collection.recorded_at,
        updated_at: collection.updated_at,
        temporal_basis: collection.temporal_basis,
        valid_intervals: collection.valid_intervals,
      });
    }

    const positioned = collection ? leaves : members;
    const spokeRadius = positioned.length <= 1 && !collection ? 0 : Math.max(72, Math.sqrt(Math.max(positioned.length, 1)) * 38);
    positioned.forEach((member, memberIndex) => {
      const seed = stableHash(member.id);
      const angleOffset = (seed % 360) * (Math.PI / 180) * 0.08;
      const angle = (2 * Math.PI * memberIndex) / Math.max(positioned.length, 1) - Math.PI / 2 + angleOffset;
      const radialScale = 0.72 + ((seed >>> 8) % 29) / 100;
      nodes.push({
        id: member.id,
        label: member.label,
        type: nodeType(member.type),
        role: member.id.startsWith('col:') ? 'cluster' : 'node',
        memoryRole: memoryRole(member),
        semanticType: member.semantic_type,
        artifactKind: member.artifact_kind,
        x: cx + Math.cos(angle) * spokeRadius * radialScale,
        y: cy + Math.sin(angle) * spokeRadius * radialScale,
        cluster: groupKey,
        radius: 4 + ((seed >>> 16) % 20) / 10,
        properties: member.properties,
        epistemic: epistemicState(member.epistemic),
        created_at: member.created_at,
        valid_at: member.valid_at,
        invalid_at: member.invalid_at,
        recorded_at: member.recorded_at,
        updated_at: member.updated_at,
        temporal_basis: member.temporal_basis,
        valid_intervals: member.valid_intervals,
      });
    });
  });

  const nodeIds = new Set(nodes.map(node => node.id));
  const edges = apiEdges
    .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map(normalizeGraphEdge);

  return { nodes, edges };
}

export function graphTopologyKey(nodes: Array<Pick<GraphNode, 'id'>>, edges: Array<Pick<GraphEdge, 'id' | 'source' | 'target' | 'layer'>>): string {
  const nodeKey = nodes.map(node => node.id).sort().join('\u001f');
  const edgeKey = edges
    .map(edge => `${edge.id}\u001e${edge.source}\u001e${edge.target}\u001e${edge.layer}`)
    .sort()
    .join('\u001f');
  return `${nodeKey}\u001d${edgeKey}`;
}

/** Return the root and every eligible node reachable within the requested hop depth. */
export function graphNeighborhoodIds(
  rootId: string,
  depth: number,
  edges: Array<Pick<ApiGraphEdge, 'source' | 'target'>>,
  eligibleIds?: ReadonlySet<string>,
): Set<string> {
  if (eligibleIds && !eligibleIds.has(rootId)) return new Set();
  const reachable = new Set<string>([rootId]);
  let frontier = new Set<string>([rootId]);
  const hops = Math.max(0, Math.floor(depth));
  for (let hop = 0; hop < hops && frontier.size > 0; hop += 1) {
    const next = new Set<string>();
    for (const edge of edges) {
      if (frontier.has(edge.source) && !reachable.has(edge.target) && (!eligibleIds || eligibleIds.has(edge.target))) {
        reachable.add(edge.target);
        next.add(edge.target);
      }
      if (frontier.has(edge.target) && !reachable.has(edge.source) && (!eligibleIds || eligibleIds.has(edge.source))) {
        reachable.add(edge.source);
        next.add(edge.source);
      }
    }
    frontier = next;
  }
  return reachable;
}

/** Fit graph coordinates into the unobscured part of a viewport. */
export function fitGraphNodesToViewport(
  nodes: Array<Pick<GraphNode, 'x' | 'y'>>,
  width: number,
  height: number,
  options: { padding?: number; rightInset?: number; maxZoom?: number } = {},
): { pan: { x: number; y: number }; zoom: number } | null {
  if (nodes.length === 0) return null;
  const padding = options.padding ?? 60;
  const availableWidth = Math.max(1, width - (options.rightInset ?? 0));
  const availableHeight = Math.max(1, height);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  }
  const graphWidth = Math.max(1, maxX - minX);
  const graphHeight = Math.max(1, maxY - minY);
  const zoom = Math.max(0.05, Math.min(
    Math.max(1, availableWidth - padding * 2) / graphWidth,
    Math.max(1, availableHeight - padding * 2) / graphHeight,
    options.maxZoom ?? 1,
  ));
  return {
    zoom,
    pan: {
      x: availableWidth / 2 - ((minX + maxX) / 2) * zoom,
      y: availableHeight / 2 - ((minY + maxY) / 2) * zoom,
    },
  };
}

/** Context grows monotonically as the user moves from overview to reading distance. */
export function graphLabelBudget(zoomRatio: number): number {
  const ratio = Number.isFinite(zoomRatio) ? Math.max(1, zoomRatio) : 1;
  if (ratio <= 2) return Math.round(28 + (ratio - 1) * 60);
  if (ratio <= 4) return Math.round(88 + (ratio - 2) * 76);
  return 240;
}

/**
 * Pick a bounded, collision-aware screen-space label set. Intent wins first,
 * followed by real collection hubs, the active neighbourhood, and topology.
 */
export function selectVisibleGraphLabelIds(
  nodes: GraphNode[],
  options: GraphLabelSelectionOptions,
): Set<string> {
  const budget = graphLabelBudget(options.zoomRatio);
  const margin = 48;
  const cellWidth = 72;
  const cellHeight = 20;
  const occupied = new Set<string>();
  const visible = new Set<string>();

  const candidates = nodes.map((node) => {
    const selected = node.id === options.selectedId;
    const hovered = node.id === options.hoveredId;
    const connected = options.connectedIds?.has(node.id) ?? false;
    const priority = selected ? 100_000
      : hovered ? 90_000
      : node.role === 'cluster' ? 60_000
      : connected ? 40_000
      : (options.importance?.[node.id] ?? 0) * 10_000;
    return { node, selected, hovered, priority };
  }).sort((a, b) => b.priority - a.priority || a.node.id.localeCompare(b.node.id));

  for (const candidate of candidates) {
    const { node, selected, hovered } = candidate;
    const screenX = node.x * options.zoom + options.pan.x;
    const screenY = node.y * options.zoom + options.pan.y;
    if (screenX < -margin || screenY < -margin || screenX > options.width + margin || screenY > options.height + margin) continue;

    const forced = selected || hovered;
    if (!forced && visible.size >= budget) continue;

    const labelWidth = Math.min(210, Math.max(48, node.label.length * 6.4));
    const left = screenX + 10;
    const top = screenY - 9;
    const right = left + labelWidth;
    const bottom = top + 18;
    const cells: string[] = [];
    for (let x = Math.floor(left / cellWidth); x <= Math.floor(right / cellWidth); x += 1) {
      for (let y = Math.floor(top / cellHeight); y <= Math.floor(bottom / cellHeight); y += 1) {
        cells.push(`${x}:${y}`);
      }
    }
    if (!forced && cells.some((cell) => occupied.has(cell))) continue;
    visible.add(node.id);
    for (const cell of cells) occupied.add(cell);
  }

  return visible;
}

/** Target-relative Orbit label policy shared by rendering and regression tests. */
export function orbitLabelPresentation(input: {
  distance: number;
  overviewDistance: number;
  rank: number;
  nodeCount: number;
  selected: boolean;
  hub: boolean;
  density?: number;
}): OrbitLabelPresentation {
  const overview = input.overviewDistance > 0 ? input.overviewDistance : Math.max(input.distance, 1);
  const ratio = Math.max(0, Math.min(1, input.distance / overview));
  const progress = Math.max(0, Math.min(1, (1 - ratio) / 0.65));
  const density = Math.min(2, Math.max(0.5, input.density ?? 1));
  const minimum = Math.max(8, Math.round(18 * density));
  const maximum = Math.min(input.nodeCount, Math.max(minimum, Math.round(240 * density)));
  const budget = Math.round(minimum + (maximum - minimum) * progress);
  if (input.selected) return { visible: true, opacity: 1, budget };
  const visible = input.hub || input.rank < budget;
  const opacity = visible ? Math.min(0.95, (input.hub ? 0.78 : 0.55) + progress * 0.4) : 0;
  return { visible, opacity, budget };
}

export function sourceErrorMessage(error: string | GraphSourceError): string {
  if (typeof error === 'string') return error;
  const message = error.message || error.error || 'Source unavailable';
  return error.source ? `${error.source}: ${message}` : message;
}
