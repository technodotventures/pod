export const ACTIVITY_CARD_GAP = 20;
export const ACTIVITY_CARD_ESTIMATED_HEIGHT = 140;
export const ACTIVITY_PRESENT_GAP = 60;
export const ACTIVITY_CANVAS_BOTTOM_SPACE = 40;

export interface ActivityTimelineLayout {
  yPositions: number[];
  lastCardBottom: number;
  rulerHeight: number;
  canvasHeight: number;
}

export interface ActivityColorStop {
  position: number;
  color: string;
}

const DEFAULT_ACTIVITY_COLOR = '#a855f7';

function parseHexColor(color: string): [number, number, number] | null {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) return null;

  return [
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  ];
}

function formatHexColor(channels: [number, number, number]): string {
  return `#${channels
    .map(channel => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Returns the colour at a vertical point in the activity timeline.
 *
 * Each card owns its exact colour at its centre. Between neighbouring cards,
 * their colours are blended by distance so scrolling never produces a hard
 * switch when the nearest card changes.
 */
export function activityTimelineColorAt(
  stops: ActivityColorStop[],
  position: number,
  fallback = DEFAULT_ACTIVITY_COLOR,
): string {
  const validStops = stops
    .map(stop => ({ ...stop, rgb: parseHexColor(stop.color) }))
    .filter((stop): stop is ActivityColorStop & { rgb: [number, number, number] } => (
      Number.isFinite(stop.position) && stop.rgb !== null
    ))
    .sort((a, b) => a.position - b.position);

  if (validStops.length === 0) return fallback;
  if (position <= validStops[0].position) return validStops[0].color;

  const last = validStops[validStops.length - 1];
  if (position >= last.position) return last.color;

  const upperIndex = validStops.findIndex(stop => stop.position >= position);
  const lower = validStops[upperIndex - 1];
  const upper = validStops[upperIndex];
  const span = upper.position - lower.position;
  const progress = span === 0 ? 1 : (position - lower.position) / span;

  return formatHexColor(lower.rgb.map((channel, index) => (
    channel + (upper.rgb[index] - channel) * progress
  )) as [number, number, number]);
}

export function computeActivityTimelineLayout(cardHeights: number[]): ActivityTimelineLayout {
  const yPositions: number[] = [];
  let nextY = 0;

  for (const height of cardHeights) {
    yPositions.push(nextY);
    nextY += height + ACTIVITY_CARD_GAP;
  }

  const lastCardBottom = cardHeights.length > 0
    ? yPositions[yPositions.length - 1] + cardHeights[cardHeights.length - 1]
    : 0;
  const rulerHeight = lastCardBottom + ACTIVITY_PRESENT_GAP;

  return {
    yPositions,
    lastCardBottom,
    rulerHeight,
    canvasHeight: rulerHeight + ACTIVITY_CANVAS_BOTTOM_SPACE,
  };
}
