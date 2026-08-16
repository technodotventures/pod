export const GRAPH_HOVER_CARD_DELAY_MS = 550;
export const GRAPH_HOVER_MOVE_TOLERANCE_PX = 5;

export interface GraphHoverIntent {
  nodeId: string;
  anchorX: number;
  anchorY: number;
}

export interface GraphHoverSample {
  nodeId: string;
  x: number;
  y: number;
}

export function updateGraphHoverIntent(
  current: GraphHoverIntent | null,
  sample: GraphHoverSample | null,
): { intent: GraphHoverIntent | null; restartTimer: boolean } {
  if (!sample) return { intent: null, restartTimer: false };
  const movedBeyondTolerance = current
    ? Math.hypot(sample.x - current.anchorX, sample.y - current.anchorY) > GRAPH_HOVER_MOVE_TOLERANCE_PX
    : false;
  if (!current || current.nodeId !== sample.nodeId || movedBeyondTolerance) {
    return {
      intent: { nodeId: sample.nodeId, anchorX: sample.x, anchorY: sample.y },
      restartTimer: true,
    };
  }
  return { intent: current, restartTimer: false };
}
