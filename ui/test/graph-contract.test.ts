import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeTopology, calculateForceLayout, forceAtlas2Settings, selectConnectedAnalyticsNodes } from '../src/graph-analytics';
import {
  countGraphNodeTypes,
  graphRequestUrl,
  graphNeighborhoodIds,
  graphLabelBudget,
  graphTopologyKey,
  fitGraphNodesToViewport,
  layoutGraphData,
  orbitLabelPresentation,
  selectVisibleGraphLabelIds,
  type ApiGraphEdge,
  type ApiGraphNode,
  type GraphEdge,
  type GraphNode,
} from '../src/graph-contract';
import { drawGraphCanvas, hitTestGraphNode } from '../src/graph-canvas';

const nodes: ApiGraphNode[] = [
  { id: 'col:parent', label: 'Parent', type: 'collection', role: 'collection', group: 'collection' },
  { id: 'col:child', label: 'Child', type: 'collection', role: 'collection', group: 'collection' },
  { id: 'obj:one', label: 'One', type: 'artifact', role: 'artifact', artifact_kind: 'note', group: 'child' },
  { id: 'sw:two', label: 'Two', type: 'organisation', role: 'semantic_entity', semantic_type: 'organisation', group: 'child', epistemic: 'fact' },
];

const edges: ApiGraphEdge[] = [
  { id: 'parent', source: 'col:parent', target: 'col:child', layer: 'structural', type: 'solid' },
  { id: 'member', source: 'col:child', target: 'obj:one', layer: 'structural', type: 'solid' },
  { id: 'relation', source: 'obj:one', target: 'sw:two', layer: 'canonical', type: 'solid' },
];

test('the map requests a representative overview and expands neighborhoods on demand', () => {
  assert.equal(graphRequestUrl(), '/pod/graph?view=overview&limit=2000');
  assert.equal(
    graphRequestUrl({ view: 'neighborhood', root: 'sw:atlas', depth: 2 }),
    '/pod/graph?view=neighborhood&limit=6000&root=sw%3Aatlas&depth=2',
  );
});

test('canvas hit testing keeps node interactions accurate at any zoom', () => {
  const graph = layoutGraphData(nodes, edges);
  const target = graph.nodes.find(node => node.id === 'obj:one')!;
  const viewport = { pan: { x: 120, y: -40 }, zoom: 2.5 };

  const hit = hitTestGraphNode(
    graph.nodes,
    {
      x: target.x * viewport.zoom + viewport.pan.x + 4,
      y: target.y * viewport.zoom + viewport.pan.y,
    },
    viewport,
    () => 3,
  );

  assert.equal(hit?.id, target.id);
  assert.equal(hitTestGraphNode(graph.nodes, { x: -10_000, y: -10_000 }, viewport, () => 3), null);
});

test('canvas rendering batches thousands of equal-style primitives', () => {
  const manyNodes: GraphNode[] = Array.from({ length: 4_000 }, (_, index) => ({
    id: `node:${index}`,
    label: `Node ${index}`,
    type: 'concept',
    role: 'node',
    memoryRole: 'semantic_entity',
    x: index,
    y: 20,
    epistemic: 'unclassified',
  }));
  const manyEdges: GraphEdge[] = manyNodes.slice(1).map((node, index) => ({
    id: `edge:${index}`,
    source: manyNodes[index].id,
    target: node.id,
    layer: 'structural',
    type: 'solid',
  }));
  const calls = { strokes: 0, fills: 0 };
  const context = {
    globalAlpha: 1,
    lineCap: 'round',
    lineJoin: 'round',
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    setTransform() {}, clearRect() {}, beginPath() {}, setLineDash() {}, moveTo() {}, lineTo() {}, arc() {}, closePath() {},
    stroke() { calls.strokes += 1; },
    fill() { calls.fills += 1; },
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;

  drawGraphCanvas(canvas, {
    width: 4_100,
    height: 100,
    viewport: { pan: { x: 0, y: 0 }, zoom: 1 },
    nodes: manyNodes,
    edges: manyEdges,
    nodeById: new Map(manyNodes.map(node => [node.id, node])),
    nodeVisual: () => ({ radius: 2, fill: '#fff', opacity: 1 }),
    edgeVisual: () => ({ stroke: '#888', width: 1, opacity: 0.3 }),
    devicePixelRatio: 1,
  });

  assert.equal(calls.strokes, 1);
  assert.equal(calls.fills, 1);
});

test('layout is deterministic and keeps semantic collections and edges', () => {
  const first = layoutGraphData(nodes, edges);
  const second = layoutGraphData([...nodes].reverse(), [...edges].reverse());

  const firstPositions = Object.fromEntries(first.nodes.map(node => [node.id, { x: node.x, y: node.y }]));
  const secondPositions = Object.fromEntries(second.nodes.map(node => [node.id, { x: node.x, y: node.y }]));

  assert.deepEqual(firstPositions, secondPositions);
  assert.equal(first.nodes.find(node => node.id === 'col:child')?.role, 'cluster');
  assert.equal(first.nodes.find(node => node.id === 'col:child')?.memoryRole, 'collection');
  assert.equal(first.nodes.find(node => node.id === 'obj:one')?.memoryRole, 'artifact');
  assert.equal(first.nodes.find(node => node.id === 'sw:two')?.semanticType, 'organisation');
  assert.equal(first.edges.some(edge => edge.id === 'parent'), true);
  assert.equal(first.nodes.some(node => node.id.startsWith('hub:') || node.id.startsWith('bridge:')), false);
  assert.equal(first.edges.some(edge => edge.id.startsWith('hub:') || edge.id.startsWith('bridge:')), false);
});

test('unasserted memories remain unclassified', () => {
  const graph = layoutGraphData(nodes, edges);
  assert.equal(graph.nodes.find(node => node.id === 'obj:one')?.epistemic, 'unclassified');
  assert.equal(graph.nodes.find(node => node.id === 'sw:two')?.epistemic, 'fact');
});

test('map facet counts include collection hubs and exclude relationship scaffolding', () => {
  const graph = layoutGraphData(nodes, edges);
  const counts = countGraphNodeTypes([
    ...graph.nodes,
    {
      id: 'relationship:test',
      label: 'Relationship',
      type: 'concept',
      role: 'relationship',
      memoryRole: 'unknown',
      x: 0,
      y: 0,
      epistemic: 'unclassified',
    },
  ]);

  assert.equal(counts.get('collection'), 2);
  assert.equal(counts.get('artifact'), 1);
  assert.equal(counts.get('organisation'), 1);
  assert.equal(counts.get('concept'), undefined);
});

test('focus neighbourhood grows by graph hops without traversing filtered memories', () => {
  const depthOne = graphNeighborhoodIds('col:child', 1, edges);
  const depthTwo = graphNeighborhoodIds('col:child', 2, edges);
  assert.deepEqual([...depthOne].sort(), ['col:child', 'col:parent', 'obj:one']);
  assert.deepEqual([...depthTwo].sort(), ['col:child', 'col:parent', 'obj:one', 'sw:two']);

  const eligible = new Set(['col:child', 'obj:one', 'sw:two']);
  assert.deepEqual(
    [...graphNeighborhoodIds('col:child', 1, edges, eligible)].sort(),
    ['col:child', 'obj:one'],
  );
});

test('focus framing centres the neighbourhood in space not covered by the detail rail', () => {
  const viewport = fitGraphNodesToViewport(
    [{ x: 0, y: 0 }, { x: 100, y: 50 }],
    1_000,
    600,
    { padding: 60, rightInset: 320, maxZoom: 1.4 },
  );
  assert.ok(viewport);
  assert.equal(viewport.zoom, 1.4);
  const screenLeft = viewport.pan.x;
  const screenRight = 100 * viewport.zoom + viewport.pan.x;
  assert.ok(screenLeft >= 60);
  assert.ok(screenRight <= 1_000 - 320 - 60);
  assert.equal((screenLeft + screenRight) / 2, (1_000 - 320) / 2);
});

test('topology key ignores positions and input order but changes with relationship semantics', () => {
  const graph = layoutGraphData(nodes, edges);
  const key = graphTopologyKey(graph.nodes, graph.edges);
  const moved = graph.nodes.map(node => ({ ...node, x: node.x + 100, y: node.y - 50 })).reverse();

  assert.equal(graphTopologyKey(moved, [...graph.edges].reverse()), key);
  assert.notEqual(
    graphTopologyKey(graph.nodes, graph.edges.map(edge => edge.id === 'relation' ? { ...edge, layer: 'derived' } : edge)),
    key,
  );
});

test('analytics are produced from one semantic topology snapshot', () => {
  const analysis = analyzeTopology(
    [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 1, y: 0 },
      { id: 'c', x: 2, y: 0 },
    ],
    [
      { id: 'ab', source: 'a', target: 'b' },
      { id: 'bc', source: 'b', target: 'c' },
    ],
  );

  assert.deepEqual(Object.keys(analysis.communities).sort(), ['a', 'b', 'c']);
  assert.ok(analysis.betweenness.b > analysis.betweenness.a);
  assert.deepEqual(analysis.gaps, []);
});

test('topology analytics skip nodes with no asserted relationship', () => {
  const selected = selectConnectedAnalyticsNodes(
    [{ id: 'isolated', x: 0, y: 0 }, { id: 'source', x: 1, y: 0 }, { id: 'target', x: 2, y: 0 }],
    [{ id: 'edge', source: 'source', target: 'target' }],
  );

  assert.deepEqual(selected.map(node => node.id), ['source', 'target']);
});

test('force layout settings expose only supported user-facing ForceAtlas2 controls', () => {
  assert.deepEqual(forceAtlas2Settings(500, {
    repel: 14,
    gravity: 1.4,
    preventOverlap: true,
    separateClusters: true,
  }), {
    gravity: 1.4,
    scalingRatio: 14,
    adjustSizes: true,
    barnesHutOptimize: true,
    barnesHutTheta: 0.6,
    slowDown: 1,
    strongGravityMode: false,
    linLogMode: true,
  });
});

test('force layout runs with overlap prevention and cluster separation enabled', () => {
  const positions = calculateForceLayout({
    nodes: [
      { id: 'a', x: -10, y: 0, size: 3 },
      { id: 'b', x: 0, y: 5, size: 4 },
      { id: 'c', x: 10, y: 0, size: 3 },
    ],
    edges: [
      { id: 'ab', source: 'a', target: 'b' },
      { id: 'bc', source: 'b', target: 'c' },
    ],
    iterations: 10,
    force: { preventOverlap: true, separateClusters: true },
  });

  assert.deepEqual(Object.keys(positions).sort(), ['a', 'b', 'c']);
  assert.equal(Object.values(positions).every(position => Number.isFinite(position.x) && Number.isFinite(position.y)), true);
});

test('semantic zoom label budget is monotonic at reading distance', () => {
  const ratios = [1, 1.4, 2, 2.2, 3, 5];
  const budgets = ratios.map(graphLabelBudget);

  for (let index = 1; index < budgets.length; index += 1) {
    assert.ok(budgets[index] >= budgets[index - 1]);
  }
  assert.ok(budgets.at(-1)! > budgets[0]);
});

test('2D label selection keeps intent visible and bounds contextual labels', () => {
  const graph = layoutGraphData(nodes, edges);
  const crowded = Array.from({ length: 300 }, (_, index) => ({
    ...graph.nodes[index % graph.nodes.length],
    id: `crowded:${index}`,
    label: `Memory ${index}`,
    role: 'node' as const,
    x: 100 + (index % 30) * 18,
    y: 100 + Math.floor(index / 30) * 18,
  }));
  const selectedId = crowded[299].id;
  const visible = selectVisibleGraphLabelIds(crowded, {
    width: 800,
    height: 500,
    pan: { x: 0, y: 0 },
    zoom: 1,
    zoomRatio: 3,
    selectedId,
    hoveredId: crowded[298].id,
    connectedIds: new Set([crowded[297].id]),
    importance: Object.fromEntries(crowded.map((node, index) => [node.id, index / crowded.length])),
  });

  assert.ok(visible.has(selectedId));
  assert.ok(visible.has(crowded[298].id));
  assert.ok(visible.size <= graphLabelBudget(3) + 3);
});

test('Orbit labels reveal useful context early and always show intent', () => {
  const overview = orbitLabelPresentation({
    distance: 100,
    overviewDistance: 100,
    rank: 0,
    nodeCount: 2_000,
    selected: false,
    hub: false,
  });
  const closer = orbitLabelPresentation({
    distance: 55,
    overviewDistance: 100,
    rank: 80,
    nodeCount: 2_000,
    selected: false,
    hub: false,
  });
  const selected = orbitLabelPresentation({
    distance: 100,
    overviewDistance: 100,
    rank: 1_999,
    nodeCount: 2_000,
    selected: true,
    hub: false,
  });

  assert.equal(overview.visible, true);
  assert.ok(overview.opacity >= 0.5);
  assert.equal(closer.visible, true);
  assert.ok(closer.budget > overview.budget);
  assert.deepEqual(selected, { visible: true, opacity: 1, budget: overview.budget });
});

test('Orbit label density changes context without hiding selected nodes', () => {
  const sparse = orbitLabelPresentation({
    distance: 55,
    overviewDistance: 100,
    rank: 300,
    nodeCount: 2_000,
    selected: false,
    hub: false,
    density: 0.5,
  });
  const dense = orbitLabelPresentation({
    distance: 55,
    overviewDistance: 100,
    rank: 300,
    nodeCount: 2_000,
    selected: false,
    hub: false,
    density: 2,
  });
  const selected = orbitLabelPresentation({
    distance: 100,
    overviewDistance: 100,
    rank: 1_999,
    nodeCount: 2_000,
    selected: true,
    hub: false,
    density: 0.5,
  });

  assert.ok(dense.budget > sparse.budget);
  assert.equal(dense.visible, true);
  assert.equal(selected.visible, true);
});
