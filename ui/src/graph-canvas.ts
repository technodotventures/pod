import type { GraphEdge, GraphNode } from './graph-contract';

export interface GraphViewport {
  pan: { x: number; y: number };
  zoom: number;
}

export interface CanvasNodeVisual {
  radius: number;
  fill: string;
  opacity: number;
  ring?: { radius: number; stroke: string; width: number; dash?: number[] };
  halo?: { radius: number; fill: string; opacity: number };
  pulse?: { radius: number; stroke: string; opacity: number };
}

export interface CanvasEdgeVisual {
  stroke: string;
  width: number;
  opacity: number;
  dash?: number[];
  arrow?: boolean;
}

interface GraphCanvasOptions {
  width: number;
  height: number;
  viewport: GraphViewport;
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeById: ReadonlyMap<string, GraphNode>;
  nodeVisual: (node: GraphNode) => CanvasNodeVisual;
  edgeVisual: (edge: GraphEdge, source: GraphNode, target: GraphNode) => CanvasEdgeVisual;
  devicePixelRatio?: number;
}

interface MinimapOptions {
  width: number;
  height: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeById: ReadonlyMap<string, GraphNode>;
  nodeColor: (node: GraphNode) => string;
  devicePixelRatio?: number;
}

function prepareCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  devicePixelRatio = window.devicePixelRatio || 1,
): { context: CanvasRenderingContext2D; ratio: number } | null {
  const context = canvas.getContext('2d');
  if (!context || width <= 0 || height <= 0) return null;
  const ratio = Math.max(1, Math.min(2, devicePixelRatio));
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, ratio };
}

function outsideViewport(
  x: number,
  y: number,
  viewport: GraphViewport,
  width: number,
  height: number,
  marginPx: number,
): boolean {
  const screenX = x * viewport.zoom + viewport.pan.x;
  const screenY = y * viewport.zoom + viewport.pan.y;
  return screenX < -marginPx || screenY < -marginPx || screenX > width + marginPx || screenY > height + marginPx;
}

function edgeOutsideViewport(
  source: GraphNode,
  target: GraphNode,
  viewport: GraphViewport,
  width: number,
  height: number,
  marginPx = 24,
): boolean {
  const sx = source.x * viewport.zoom + viewport.pan.x;
  const sy = source.y * viewport.zoom + viewport.pan.y;
  const tx = target.x * viewport.zoom + viewport.pan.x;
  const ty = target.y * viewport.zoom + viewport.pan.y;
  return (sx < -marginPx && tx < -marginPx)
    || (sy < -marginPx && ty < -marginPx)
    || (sx > width + marginPx && tx > width + marginPx)
    || (sy > height + marginPx && ty > height + marginPx);
}

function edgeStyleKey(visual: CanvasEdgeVisual): string {
  return `${visual.stroke}|${visual.width}|${visual.opacity}|${visual.dash?.join(',') ?? ''}|${visual.arrow ? 1 : 0}`;
}

/** Draw the bulk graph in one canvas instead of creating one React/SVG element per primitive. */
export function drawGraphCanvas(canvas: HTMLCanvasElement, options: GraphCanvasOptions): void {
  const prepared = prepareCanvas(canvas, options.width, options.height, options.devicePixelRatio);
  if (!prepared) return;
  const { context } = prepared;
  const { viewport } = options;
  const zoom = Math.max(0.001, viewport.zoom);
  context.setTransform(
    prepared.ratio * zoom,
    0,
    0,
    prepared.ratio * zoom,
    prepared.ratio * viewport.pan.x,
    prepared.ratio * viewport.pan.y,
  );
  context.lineCap = 'round';
  context.lineJoin = 'round';

  const edgeGroups = new Map<string, {
    visual: CanvasEdgeVisual;
    segments: Array<{ source: GraphNode; target: GraphNode }>;
  }>();
  for (const edge of options.edges) {
    const source = options.nodeById.get(edge.source);
    const target = options.nodeById.get(edge.target);
    if (!source || !target || edgeOutsideViewport(source, target, viewport, options.width, options.height)) continue;
    const visual = options.edgeVisual(edge, source, target);
    if (visual.opacity <= 0 || visual.width <= 0) continue;
    const key = edgeStyleKey(visual);
    const group = edgeGroups.get(key) ?? { visual, segments: [] };
    group.segments.push({ source, target });
    edgeGroups.set(key, group);
  }

  for (const { visual, segments } of edgeGroups.values()) {
    context.beginPath();
    context.strokeStyle = visual.stroke;
    context.globalAlpha = visual.opacity;
    context.lineWidth = visual.width / zoom;
    context.setLineDash((visual.dash ?? []).map(value => value / zoom));
    for (const { source, target } of segments) {
      context.moveTo(source.x, source.y);
      context.lineTo(target.x, target.y);
    }
    context.stroke();

    if (visual.arrow) {
      const arrowSize = 5 / zoom;
      context.fillStyle = visual.stroke;
      context.beginPath();
      for (const { source, target } of segments) {
        const angle = Math.atan2(target.y - source.y, target.x - source.x);
        context.moveTo(target.x, target.y);
        context.lineTo(target.x - Math.cos(angle - 0.48) * arrowSize, target.y - Math.sin(angle - 0.48) * arrowSize);
        context.lineTo(target.x - Math.cos(angle + 0.48) * arrowSize, target.y - Math.sin(angle + 0.48) * arrowSize);
        context.closePath();
      }
      context.fill();
    }
  }
  context.setLineDash([]);

  const visibleNodes: Array<{ node: GraphNode; visual: CanvasNodeVisual }> = [];
  for (const node of options.nodes) {
    if (outsideViewport(node.x, node.y, viewport, options.width, options.height, 32)) continue;
    const visual = options.nodeVisual(node);
    if (visual.opacity > 0 && visual.radius > 0) visibleNodes.push({ node, visual });
  }

  const haloGroups = new Map<string, typeof visibleNodes>();
  const fillGroups = new Map<string, typeof visibleNodes>();
  const ringGroups = new Map<string, typeof visibleNodes>();
  const pulseGroups = new Map<string, typeof visibleNodes>();
  for (const entry of visibleNodes) {
    const { visual } = entry;
    const fillKey = `${visual.fill}|${visual.opacity}`;
    const fills = fillGroups.get(fillKey) ?? [];
    fills.push(entry);
    fillGroups.set(fillKey, fills);
    if (visual.halo) {
      const key = `${visual.halo.fill}|${visual.halo.opacity * visual.opacity}`;
      const group = haloGroups.get(key) ?? [];
      group.push(entry);
      haloGroups.set(key, group);
    }
    if (visual.ring) {
      const key = `${visual.ring.stroke}|${visual.ring.width}|${visual.opacity}|${visual.ring.dash?.join(',') ?? ''}`;
      const group = ringGroups.get(key) ?? [];
      group.push(entry);
      ringGroups.set(key, group);
    }
    if (visual.pulse) {
      const key = `${visual.pulse.stroke}|${visual.pulse.opacity * visual.opacity}`;
      const group = pulseGroups.get(key) ?? [];
      group.push(entry);
      pulseGroups.set(key, group);
    }
  }

  for (const group of haloGroups.values()) {
    const visual = group[0].visual;
    context.beginPath();
    context.globalAlpha = visual.halo!.opacity * visual.opacity;
    context.fillStyle = visual.halo!.fill;
    for (const { node, visual: item } of group) {
      context.moveTo(node.x + item.halo!.radius, node.y);
      context.arc(node.x, node.y, item.halo!.radius, 0, Math.PI * 2);
    }
    context.fill();
  }
  for (const group of fillGroups.values()) {
    const visual = group[0].visual;
    context.beginPath();
    context.globalAlpha = visual.opacity;
    context.fillStyle = visual.fill;
    for (const { node, visual: item } of group) {
      context.moveTo(node.x + item.radius, node.y);
      context.arc(node.x, node.y, item.radius, 0, Math.PI * 2);
    }
    context.fill();
  }
  for (const group of ringGroups.values()) {
    const visual = group[0].visual;
    context.beginPath();
    context.globalAlpha = visual.opacity;
    context.strokeStyle = visual.ring!.stroke;
    context.lineWidth = visual.ring!.width / zoom;
    context.setLineDash((visual.ring!.dash ?? []).map(value => value / zoom));
    for (const { node, visual: item } of group) {
      context.moveTo(node.x + item.ring!.radius, node.y);
      context.arc(node.x, node.y, item.ring!.radius, 0, Math.PI * 2);
    }
    context.stroke();
  }
  for (const group of pulseGroups.values()) {
    const visual = group[0].visual;
    context.beginPath();
    context.globalAlpha = visual.pulse!.opacity * visual.opacity;
    context.strokeStyle = visual.pulse!.stroke;
    context.lineWidth = 1 / zoom;
    context.setLineDash([]);
    for (const { node, visual: item } of group) {
      context.moveTo(node.x + item.pulse!.radius, node.y);
      context.arc(node.x, node.y, item.pulse!.radius, 0, Math.PI * 2);
    }
    context.stroke();
  }
  context.globalAlpha = 1;
  context.setLineDash([]);
}

export function drawGraphMinimap(canvas: HTMLCanvasElement, options: MinimapOptions): void {
  const prepared = prepareCanvas(canvas, options.width, options.height, options.devicePixelRatio);
  if (!prepared) return;
  const { context, ratio } = prepared;
  const graphWidth = Math.max(1, options.bounds.maxX - options.bounds.minX);
  const graphHeight = Math.max(1, options.bounds.maxY - options.bounds.minY);
  const scale = Math.min(options.width / graphWidth, options.height / graphHeight);
  const offsetX = (options.width - graphWidth * scale) / 2;
  const offsetY = (options.height - graphHeight * scale) / 2;
  context.setTransform(
    ratio * scale,
    0,
    0,
    ratio * scale,
    ratio * (offsetX - options.bounds.minX * scale),
    ratio * (offsetY - options.bounds.minY * scale),
  );

  context.beginPath();
  context.strokeStyle = 'rgba(148,163,184,0.16)';
  context.lineWidth = 0.7 / scale;
  for (const edge of options.edges) {
    const source = options.nodeById.get(edge.source);
    const target = options.nodeById.get(edge.target);
    if (!source || !target) continue;
    context.moveTo(source.x, source.y);
    context.lineTo(target.x, target.y);
  }
  context.stroke();

  const groups = new Map<string, GraphNode[]>();
  for (const node of options.nodes) {
    const color = options.nodeColor(node);
    const group = groups.get(color) ?? [];
    group.push(node);
    groups.set(color, group);
  }
  context.globalAlpha = 0.82;
  for (const [color, nodes] of groups) {
    context.beginPath();
    context.fillStyle = color;
    for (const node of nodes) {
      context.moveTo(node.x + (node.role === 'cluster' ? 4 : 2), node.y);
      context.arc(node.x, node.y, node.role === 'cluster' ? 4 : 2, 0, Math.PI * 2);
    }
    context.fill();
  }
  context.globalAlpha = 1;
}

/** Resolve the top-most canvas node at a screen-space point. */
export function hitTestGraphNode(
  nodes: GraphNode[],
  point: { x: number; y: number },
  viewport: GraphViewport,
  radiusForNode: (node: GraphNode) => number,
  paddingPx = 6,
): GraphNode | null {
  const zoom = Math.max(0.001, viewport.zoom);
  const graphX = (point.x - viewport.pan.x) / zoom;
  const graphY = (point.y - viewport.pan.y) / zoom;
  const padding = paddingPx / zoom;
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    const radius = Math.max(0, radiusForNode(node)) + padding;
    const dx = graphX - node.x;
    const dy = graphY - node.y;
    if (dx * dx + dy * dy <= radius * radius) return node;
  }
  return null;
}
