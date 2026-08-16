/**
 * Graph analytics: wraps graphology + Force Atlas 2 + Louvain + betweenness.
 * Used by GraphView (ui/src/main.tsx) for H1/H3/H4/H9 features.
 */
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import louvain from 'graphology-communities-louvain';
import betweennessCentrality from 'graphology-metrics/centrality/betweenness';

export interface AnalyticsNode {
  id: string;
  x: number;
  y: number;
  /** Optional rendered radius used by ForceAtlas2 overlap prevention. */
  size?: number;
}

export interface AnalyticsEdge {
  id: string;
  source: string;
  target: string;
}

/** Isolated nodes cannot affect relationship analytics; excluding them avoids cubic work on large Pods. */
export function selectConnectedAnalyticsNodes<T extends AnalyticsNode>(nodes: T[], edges: AnalyticsEdge[]): T[] {
  const connectedIds = new Set<string>();
  for (const edge of edges) {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  }
  return nodes.filter(node => connectedIds.has(node.id));
}

export function buildGraphology(nodes: AnalyticsNode[], edges: AnalyticsEdge[]): Graph {
  const g = new Graph({ type: 'undirected', multi: false });
  for (const n of nodes) {
    if (!g.hasNode(n.id)) {
      g.addNode(n.id, { x: n.x, y: n.y, size: n.size ?? 1 });
    }
  }
  for (const e of edges) {
    if (!g.hasNode(e.source) || !g.hasNode(e.target) || e.source === e.target) continue;
    // Skip duplicates (undirected, single-edge graph)
    if (g.hasEdge(e.source, e.target) || g.hasEdge(e.target, e.source)) continue;
    g.addEdgeWithKey(e.id, e.source, e.target);
  }
  return g;
}

export interface ForceSettings {
  /** Node repulsion strength (FA2 scalingRatio). Higher = airier layout. */
  repel?: number;
  /** Pull toward the graph centre. Higher = tighter ball. */
  gravity?: number;
  /** Keep rendered node radii from overlapping. */
  preventOverlap?: boolean;
  /** Use LinLog attraction to make graph communities more distinct. */
  separateClusters?: boolean;
}

export function forceAtlas2Settings(nodeCount: number, force: ForceSettings = {}) {
  return {
    gravity: force.gravity ?? 1,
    scalingRatio: force.repel ?? 10,
    adjustSizes: force.preventOverlap ?? false,
    barnesHutOptimize: nodeCount > 100,
    barnesHutTheta: 0.6,
    slowDown: 1,
    strongGravityMode: false,
    linLogMode: force.separateClusters ?? false,
  };
}

/** Run Force Atlas 2 in-place. Returns updated x/y per node. */
export function runForceAtlas2(g: Graph, iterations = 200, force: ForceSettings = {}): Record<string, { x: number; y: number }> {
  const settings = forceAtlas2Settings(g.order, force);
  forceAtlas2.assign(g, { iterations, settings });
  const out: Record<string, { x: number; y: number }> = {};
  g.forEachNode((node, attrs) => {
    out[node] = { x: (attrs as { x: number }).x, y: (attrs as { y: number }).y };
  });
  return out;
}

export interface ForceLayoutRequest {
  nodes: AnalyticsNode[];
  edges: AnalyticsEdge[];
  iterations?: number;
  force?: ForceSettings;
}

export type ForceLayoutResponse =
  | { ok: true; positions: Record<string, { x: number; y: number }> }
  | { ok: false; error: string };

/** Serializable ForceAtlas2 entry point shared by the worker and deterministic tests. */
export function calculateForceLayout(request: ForceLayoutRequest): Record<string, { x: number; y: number }> {
  return runForceAtlas2(
    buildGraphology(request.nodes, request.edges),
    request.iterations ?? 200,
    request.force,
  );
}

/** Louvain community detection. Returns map of node id → community number. */
export function runLouvain(g: Graph): Record<string, number> {
  if (g.order === 0) return {};
  // Seeded for stability across reloads.
  return louvain(g, { randomWalk: false, resolution: 1 });
}

/** Betweenness centrality, normalized 0–1. */
export function computeBetweenness(g: Graph): Record<string, number> {
  if (g.order === 0) return {};
  return betweennessCentrality(g, { normalized: true });
}

/** Top-N nodes ranked by a metric. */
export function topByMetric(metric: Record<string, number>, n: number): Array<{ id: string; score: number }> {
  return Object.entries(metric)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

/** Detect "structural gaps": pairs of communities with sparse inter-cluster edges. Stub for H5. */
export function detectGaps(g: Graph, communities: Record<string, number>): Array<{ a: number; b: number; weakness: number }> {
  const communityPairs = new Map<string, number>();
  const communitySizes = new Map<number, number>();
  for (const c of Object.values(communities)) {
    communitySizes.set(c, (communitySizes.get(c) ?? 0) + 1);
  }
  g.forEachEdge((_e, _attrs, source, target) => {
    const cs = communities[source];
    const ct = communities[target];
    if (cs == null || ct == null || cs === ct) return;
    const k = cs < ct ? `${cs}:${ct}` : `${ct}:${cs}`;
    communityPairs.set(k, (communityPairs.get(k) ?? 0) + 1);
  });
  const results: Array<{ a: number; b: number; weakness: number }> = [];
  const allCommunities = [...communitySizes.keys()];
  for (let i = 0; i < allCommunities.length; i++) {
    for (let j = i + 1; j < allCommunities.length; j++) {
      const a = allCommunities[i];
      const b = allCommunities[j];
      const k = a < b ? `${a}:${b}` : `${b}:${a}`;
      const actual = communityPairs.get(k) ?? 0;
      const sizeA = communitySizes.get(a) ?? 1;
      const sizeB = communitySizes.get(b) ?? 1;
      const expected = (sizeA * sizeB) / Math.max(g.size, 1);
      const weakness = expected > 0 ? Math.max(0, 1 - actual / Math.max(expected, 1)) : 1;
      if (sizeA >= 3 && sizeB >= 3 && actual === 0) {
        results.push({ a, b, weakness });
      }
    }
  }
  return results.sort((x, y) => y.weakness - x.weakness);
}

export interface TopologyAnalysis {
  communities: Record<string, number>;
  betweenness: Record<string, number>;
  gaps: Array<{ a: number; b: number; weakness: number }>;
}

/** Build one topology snapshot so all analytics share the same semantic graph. */
export function analyzeTopology(nodes: AnalyticsNode[], edges: AnalyticsEdge[]): TopologyAnalysis {
  const graph = buildGraphology(nodes, edges);
  const communities = runLouvain(graph);
  return {
    communities,
    betweenness: computeBetweenness(graph),
    gaps: detectGaps(graph, communities),
  };
}
