import {
  calculateForceLayout,
  type ForceLayoutRequest,
  type ForceLayoutResponse,
} from './graph-analytics';

type WorkerScope = {
  onmessage: ((event: MessageEvent<ForceLayoutRequest>) => void) | null;
  postMessage: (message: ForceLayoutResponse) => void;
};

const worker = globalThis as unknown as WorkerScope;

worker.onmessage = (event: MessageEvent<ForceLayoutRequest>) => {
  try {
    worker.postMessage({ ok: true, positions: calculateForceLayout(event.data) });
  } catch (error) {
    worker.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
