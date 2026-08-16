/**
 * Lenses — curated combinations of {layout, colour, sizing, filters} that the Map exposes
 * as a single user choice. Picking a lens applies all underlying settings at once and
 * animates the graph into the new state.
 *
 * See plan §3b. Replaces the standalone Layout/Color/Size mode toggles + standalone
 * Color Groups (H6) feature.
 */

export type LayoutMode = 'hub-spoke' | 'force';
export type ColorMode = 'type' | 'community';
export type SizeMode = 'fixed' | 'betweenness';
export type LensId = 'default' | 'themes' | 'influence' | 'bridges' | 'docs';

export interface LensSettings {
  layout: LayoutMode;
  color: ColorMode;
  size: SizeMode;
  /** Auto-collapse clusters with ≥ N members. 0 = no auto-collapse. */
  autoCollapseAbove: number;
  /** Filter: only show nodes whose underlying object is a viewable doc. */
  docsOnly: boolean;
  /** Show inferred associations when the lens is explicitly about discovering bridges. */
  showDerivedAssociations: boolean;
  /** Render gap markers between weakly-connected communities (Bridges lens). */
  showGapMarkers: boolean;
}

export interface Lens {
  id: LensId;
  name: string;
  /** One-line description shown in the menu — frames the lens in terms of intent, not knobs. */
  description: string;
  /** Lucide icon name (resolved at the render site). */
  icon: 'Compass' | 'Network' | 'TrendingUp' | 'GitMerge' | 'BookOpen' | 'Bookmark';
  /** Accent colour used in the menu chip and (subtly) in active-lens decoration. */
  accent: string;
  settings: LensSettings;
  /** User-saved lenses are flagged so we can show "Saved" group separately. */
  userSaved?: boolean;
}

export const BUILTIN_LENSES: Lens[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Collections and types, exactly as stored.',
    icon: 'Compass',
    accent: '#94A3B8',
    settings: {
      layout: 'hub-spoke',
      color: 'type',
      size: 'fixed',
      autoCollapseAbove: 0,
      docsOnly: false,
      showDerivedAssociations: false,
      showGapMarkers: false,
    },
  },
  {
    id: 'themes',
    name: 'Themes',
    description: 'Group connected memories by detected theme.',
    icon: 'Network',
    accent: '#38BDF8',
    settings: {
      layout: 'hub-spoke',
      color: 'community',
      size: 'fixed',
      autoCollapseAbove: 0,
      docsOnly: false,
      showDerivedAssociations: false,
      showGapMarkers: false,
    },
  },
  {
    id: 'influence',
    name: 'Influence',
    description: 'Larger nodes bridge more asserted relationships.',
    icon: 'TrendingUp',
    accent: '#A855F7',
    settings: {
      layout: 'hub-spoke',
      color: 'type',
      size: 'betweenness',
      autoCollapseAbove: 0,
      docsOnly: false,
      showDerivedAssociations: false,
      showGapMarkers: false,
    },
  },
  {
    id: 'bridges',
    name: 'Bridges',
    description: 'Highlight links that cross between detected themes.',
    icon: 'GitMerge',
    accent: '#FB7185',
    settings: {
      layout: 'hub-spoke',
      color: 'community',
      size: 'fixed',
      autoCollapseAbove: 0,
      docsOnly: false,
      showDerivedAssociations: true,
      showGapMarkers: true,
    },
  },
  {
    id: 'docs',
    name: 'Docs',
    description: 'Only memories that can be opened as documents.',
    icon: 'BookOpen',
    accent: '#34D399',
    settings: {
      layout: 'hub-spoke',
      color: 'type',
      size: 'fixed',
      autoCollapseAbove: 0,
      docsOnly: true,
      showDerivedAssociations: false,
      showGapMarkers: false,
    },
  },
];

const ACTIVE_LENS_STORAGE_KEY = 'cp:graph:active-lens:v1';

export function loadActiveLensId(): LensId {
  try {
    const raw = localStorage.getItem(ACTIVE_LENS_STORAGE_KEY);
    if (raw && BUILTIN_LENSES.some(l => l.id === raw)) return raw as LensId;
  } catch {}
  return 'default';
}

export function persistActiveLensId(id: LensId) {
  try { localStorage.setItem(ACTIVE_LENS_STORAGE_KEY, id); } catch {}
}

export function getLensById(id: LensId): Lens {
  return BUILTIN_LENSES.find(l => l.id === id) ?? BUILTIN_LENSES[0];
}
