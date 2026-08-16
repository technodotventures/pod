import type { LensId, SizeMode } from './lenses';

export interface OrbitLayoutInput {
  id: string;
  cluster?: string;
  community?: number;
  isHub?: boolean;
}

export interface OrbitPositionedNode {
  x: number;
  y: number;
  z: number;
  fx: number;
  fy: number;
  fz: number;
}

export interface OrbitPresentationNode {
  type: string;
  degree: number;
  influence: number;
  community?: number;
  isHub?: boolean;
  isBridge?: boolean;
}

export interface OrbitPresentationLink {
  layer: 'structural' | 'canonical' | 'derived' | 'annotation';
  crossCommunity?: boolean;
  emphasis?: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TYPE_COLOR: Record<string, string> = {
  entity: '#94A3B8',
  concept: '#5CB8EC',
  decision: '#ECB85C',
  project: '#C77DFF',
  person: '#FF6B9D',
  tool: '#5C7CEC',
  organisation: '#F97316',
  event: '#22D3EE',
  agent: '#A78BFA',
  preference: '#F472B6',
  artifact: '#5CECC6',
  collection: '#64748B',
};
const COMMUNITY_COLORS = [
  '#8B5CF6', '#38BDF8', '#34D399', '#F59E0B', '#FB7185', '#A855F7',
  '#22D3EE', '#FBBF24', '#F472B6', '#4ADE80', '#60A5FA', '#FB923C',
];

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalize(vector: { x: number; y: number; z: number }) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function cross(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function fibonacciDirection(index: number, count: number) {
  const y = 1 - 2 * ((index + 0.5) / Math.max(1, count));
  const ring = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = GOLDEN_ANGLE * index;
  return { x: Math.cos(angle) * ring, y, z: Math.sin(angle) * ring };
}

export function orbitGroupKey(node: OrbitLayoutInput, lensId: LensId): string {
  if ((lensId === 'themes' || lensId === 'bridges') && node.community != null) return `theme:${node.community}`;
  return node.cluster ? `collection:${node.cluster}` : 'unclassified';
}

/**
 * Stable spherical caps: groups receive evenly-spaced directions and their members
 * occupy a shallow cap around that direction. Fixed coordinates remove global-force warm-up.
 */
export function layoutOrbitSphere<T extends OrbitLayoutInput>(nodes: T[], lensId: LensId): {
  nodes: Array<T & OrbitPositionedNode>;
  radius: number;
} {
  const radius = Math.max(90, Math.cbrt(Math.max(1, nodes.length)) * 14);
  const groups = new Map<string, T[]>();
  for (const node of nodes) {
    const key = orbitGroupKey(node, lensId);
    const members = groups.get(key) ?? [];
    members.push(node);
    groups.set(key, members);
  }
  const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  const positions = new Map<string, OrbitPositionedNode>();

  keys.forEach((key, groupIndex) => {
    const members = [...(groups.get(key) ?? [])].sort((a, b) => a.id.localeCompare(b.id));
    const direction = fibonacciDirection(groupIndex, keys.length);
    const reference = Math.abs(direction.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
    const tangentA = normalize(cross(reference, direction));
    const tangentB = normalize(cross(direction, tangentA));
    const cap = keys.length === 1
      ? Math.PI
      : Math.min(0.72, 0.14 + Math.sqrt(members.length / Math.max(nodes.length, 1)) * 1.1);

    members.forEach((node, memberIndex) => {
      const hash = stableHash(node.id);
      let unit: { x: number; y: number; z: number };
      if (keys.length === 1) {
        unit = fibonacciDirection(memberIndex, members.length);
      } else if (node.isHub) {
        unit = direction;
      } else {
        const angle = cap * Math.sqrt((memberIndex + 0.5) / Math.max(1, members.length));
        const around = GOLDEN_ANGLE * memberIndex + ((hash & 255) / 255) * 0.18;
        unit = normalize({
          x: direction.x * Math.cos(angle) + (tangentA.x * Math.cos(around) + tangentB.x * Math.sin(around)) * Math.sin(angle),
          y: direction.y * Math.cos(angle) + (tangentA.y * Math.cos(around) + tangentB.y * Math.sin(around)) * Math.sin(angle),
          z: direction.z * Math.cos(angle) + (tangentA.z * Math.cos(around) + tangentB.z * Math.sin(around)) * Math.sin(angle),
        });
      }
      const radialScale = node.isHub ? 0.68 : 0.8 + ((hash >>> 8) % 201) / 1000;
      const x = unit.x * radius * radialScale;
      const y = unit.y * radius * radialScale;
      const z = unit.z * radius * radialScale;
      positions.set(node.id, { x, y, z, fx: x, fy: y, fz: z });
    });
  });

  return {
    radius,
    nodes: nodes.map(node => ({ ...node, ...positions.get(node.id)! })),
  };
}

export function orbitNodePresentation(
  node: OrbitPresentationNode,
  lensId: LensId,
  sizeMode: SizeMode = lensId === 'influence' ? 'betweenness' : 'fixed',
): { color: string; size: number } {
  const fixedSize = node.isHub ? 3.2 : 2;
  const influenceSize = (node.isHub ? 2.5 : 1.2) + Math.min(14, Math.sqrt(Math.max(0, node.influence)) * 22);
  if (lensId === 'themes') {
    return {
      color: node.community == null ? '#94A3B8' : COMMUNITY_COLORS[node.community % COMMUNITY_COLORS.length],
      size: sizeMode === 'betweenness' ? influenceSize : fixedSize,
    };
  }
  if (lensId === 'bridges') {
    return {
      color: node.isBridge ? '#FB7185' : node.community == null ? '#94A3B8' : COMMUNITY_COLORS[node.community % COMMUNITY_COLORS.length],
      size: sizeMode === 'betweenness'
        ? influenceSize
        : node.isBridge ? 6 + Math.min(8, Math.sqrt(Math.max(0, node.influence)) * 16) : node.isHub ? 3.2 : 1.25,
    };
  }
  if (lensId === 'influence' || sizeMode === 'betweenness') {
    return {
      color: lensId === 'influence' ? (node.influence > 0 ? '#A855F7' : '#8290A3') : TYPE_COLOR[node.type] ?? TYPE_COLOR.entity,
      size: influenceSize,
    };
  }
  return { color: TYPE_COLOR[node.type] ?? TYPE_COLOR.entity, size: fixedSize };
}

export function orbitLinkPresentation(link: OrbitPresentationLink, lensId: LensId): { color: string; width: number } {
  if (lensId === 'bridges') {
    if (link.crossCommunity) return { color: '#FB7185', width: 1.9 };
    if (link.layer === 'derived') return { color: 'rgba(167,139,250,0.55)', width: 0.8 };
    return { color: 'rgba(148,163,184,0.06)', width: 0.25 };
  }
  if (lensId === 'influence') {
    return link.emphasis && link.emphasis > 0
      ? { color: 'rgba(168,85,247,0.78)', width: 0.8 + Math.min(1.8, Math.sqrt(link.emphasis) * 2.2) }
      : { color: 'rgba(148,163,184,0.07)', width: 0.25 };
  }
  if (lensId === 'themes') {
    if (link.layer === 'canonical') return { color: 'rgba(56,189,248,0.55)', width: 0.9 };
    if (link.layer === 'annotation') return { color: 'rgba(254,0,107,0.75)', width: 1.25 };
    return { color: 'rgba(148,163,184,0.10)', width: 0.35 };
  }
  const styles = {
    structural: { color: 'rgba(148,163,184,0.20)', width: 0.42 },
    canonical: { color: 'rgba(92,236,198,0.62)', width: 0.9 },
    derived: { color: 'rgba(167,139,250,0.52)', width: 0.7 },
    annotation: { color: 'rgba(254,0,107,0.82)', width: 1.4 },
  } as const;
  return styles[link.layer];
}
