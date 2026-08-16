import type { ColorMode, LayoutMode, LensSettings, SizeMode } from './lenses';
import type { GraphEpistemic } from './graph-contract';

export type RelationshipLabelMode = 'off' | 'intent' | 'always';
export type GraphKnowledgeView = 'current' | 'evidence' | 'custom';

export const CURRENT_TRUTH_EPISTEMIC: readonly GraphEpistemic[] = ['fact', 'inference', 'opinion'];
export const ATTENTION_EPISTEMIC: readonly GraphEpistemic[] = ['contested', 'stale', 'mixed', 'unclassified'];
export const ALL_GRAPH_EPISTEMIC: readonly GraphEpistemic[] = [
  ...CURRENT_TRUTH_EPISTEMIC,
  ...ATTENTION_EPISTEMIC,
];

export interface GraphDisplayOptions {
  showOrphans: boolean;
  showDerivedAssociations: boolean;
  showArrows: boolean;
  /** Relative label budget. 1 is the calibrated default; higher reveals more labels. */
  labelDensity: number;
  /** Zoom threshold at which 2D nodes switch from dots to their detailed presentation. */
  expandedThreshold: number;
  /** Visual multipliers applied after semantic node/link styling. */
  nodeScale: number;
  linkScale: number;
  linkOpacity: number;
  relationshipLabels: RelationshipLabelMode;
  showTrustRings: boolean;
  /** ForceAtlas2 scaling ratio and gravity — applies only to the 2D Force layout. */
  forceRepel: number;
  forceGravity: number;
  forcePreventOverlap: boolean;
  forceSeparateClusters: boolean;
}

export const DEFAULT_GRAPH_DISPLAY_OPTIONS: GraphDisplayOptions = {
  showOrphans: true,
  showDerivedAssociations: false,
  showArrows: false,
  labelDensity: 1,
  expandedThreshold: 2.2,
  nodeScale: 1,
  linkScale: 1,
  linkOpacity: 1,
  relationshipLabels: 'intent',
  showTrustRings: true,
  forceRepel: 10,
  forceGravity: 1,
  forcePreventOverlap: false,
  forceSeparateClusters: false,
};

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** Normalize persisted settings and migrate the old inverse text-fade threshold. */
export function normalizeGraphDisplayOptions(value: unknown): GraphDisplayOptions {
  if (!value || typeof value !== 'object') return { ...DEFAULT_GRAPH_DISPLAY_OPTIONS };
  const saved = value as Record<string, unknown>;
  const legacyThreshold = finiteNumber(saved.labelThreshold, 1.5, 0.3, 3);
  const labelDensity = saved.labelDensity == null
    ? 1.5 / legacyThreshold
    : finiteNumber(saved.labelDensity, 1, 0.5, 2);
  const relationshipLabels = saved.relationshipLabels === 'off'
    || saved.relationshipLabels === 'intent'
    || saved.relationshipLabels === 'always'
    ? saved.relationshipLabels
    : DEFAULT_GRAPH_DISPLAY_OPTIONS.relationshipLabels;

  return {
    showOrphans: typeof saved.showOrphans === 'boolean' ? saved.showOrphans : DEFAULT_GRAPH_DISPLAY_OPTIONS.showOrphans,
    showDerivedAssociations: typeof saved.showDerivedAssociations === 'boolean'
      ? saved.showDerivedAssociations
      : DEFAULT_GRAPH_DISPLAY_OPTIONS.showDerivedAssociations,
    showArrows: typeof saved.showArrows === 'boolean' ? saved.showArrows : DEFAULT_GRAPH_DISPLAY_OPTIONS.showArrows,
    labelDensity: finiteNumber(labelDensity, 1, 0.5, 2),
    expandedThreshold: finiteNumber(saved.expandedThreshold, DEFAULT_GRAPH_DISPLAY_OPTIONS.expandedThreshold, 1, 4),
    nodeScale: finiteNumber(saved.nodeScale, DEFAULT_GRAPH_DISPLAY_OPTIONS.nodeScale, 0.6, 1.8),
    linkScale: finiteNumber(saved.linkScale, DEFAULT_GRAPH_DISPLAY_OPTIONS.linkScale, 0.5, 2.5),
    linkOpacity: finiteNumber(saved.linkOpacity, DEFAULT_GRAPH_DISPLAY_OPTIONS.linkOpacity, 0.25, 1.5),
    relationshipLabels,
    showTrustRings: typeof saved.showTrustRings === 'boolean'
      ? saved.showTrustRings
      : DEFAULT_GRAPH_DISPLAY_OPTIONS.showTrustRings,
    forceRepel: finiteNumber(saved.forceRepel, DEFAULT_GRAPH_DISPLAY_OPTIONS.forceRepel, 2, 30),
    forceGravity: finiteNumber(saved.forceGravity, DEFAULT_GRAPH_DISPLAY_OPTIONS.forceGravity, 0.2, 3),
    forcePreventOverlap: typeof saved.forcePreventOverlap === 'boolean'
      ? saved.forcePreventOverlap
      : DEFAULT_GRAPH_DISPLAY_OPTIONS.forcePreventOverlap,
    forceSeparateClusters: typeof saved.forceSeparateClusters === 'boolean'
      ? saved.forceSeparateClusters
      : DEFAULT_GRAPH_DISPLAY_OPTIONS.forceSeparateClusters,
  };
}

export interface ActiveLensSettings {
  layout: LayoutMode;
  color: ColorMode;
  size: SizeMode;
  docsOnly: boolean;
  showDerivedAssociations: boolean;
}

/** Lenses remain truthful when a user manually changes one of their constituent settings. */
export function lensSettingsEdited(lens: LensSettings, active: ActiveLensSettings): boolean {
  return lens.layout !== active.layout
    || lens.color !== active.color
    || lens.size !== active.size
    || lens.docsOnly !== active.docsOnly
    || lens.showDerivedAssociations !== active.showDerivedAssociations;
}

export function scalePercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function graphKnowledgeView(
  activeEpistemic: ReadonlySet<GraphEpistemic>,
  showDerivedAssociations: boolean,
): GraphKnowledgeView {
  const isCurrentView = !showDerivedAssociations
    && activeEpistemic.size === CURRENT_TRUTH_EPISTEMIC.length
    && [...activeEpistemic].every(epistemic => CURRENT_TRUTH_EPISTEMIC.includes(epistemic));
  if (isCurrentView) return 'current';

  const isEvidenceView = showDerivedAssociations
    && activeEpistemic.size === ALL_GRAPH_EPISTEMIC.length
    && [...activeEpistemic].every(epistemic => ALL_GRAPH_EPISTEMIC.includes(epistemic));
  return isEvidenceView ? 'evidence' : 'custom';
}

/** Switches cleanly between epistemic groups, then behaves like an additive checkbox group. */
export function toggleGraphEpistemicFacet(
  activeEpistemic: ReadonlySet<GraphEpistemic>,
  target: GraphEpistemic,
  group: readonly GraphEpistemic[],
  emptyFallback: readonly GraphEpistemic[],
): Set<GraphEpistemic> {
  const groupSet = new Set(group);
  if (![...activeEpistemic].every(epistemic => groupSet.has(epistemic))) {
    return new Set([target]);
  }

  const next = new Set(activeEpistemic);
  if (next.has(target)) next.delete(target);
  else next.add(target);
  return next.size > 0 ? next : new Set(emptyFallback);
}

export function formatGraphCount(value: number): string {
  const absolute = Math.abs(value);
  const units = [
    { threshold: 1_000_000, suffix: 'm' },
    { threshold: 1_000, suffix: 'k' },
  ];
  const unit = units.find(candidate => absolute >= candidate.threshold);
  if (!unit) return String(value);

  const scaled = value / unit.threshold;
  const precision = Math.abs(scaled) < 10 ? 1 : 0;
  return `${scaled.toFixed(precision).replace(/\.0$/, '')}${unit.suffix}`;
}
