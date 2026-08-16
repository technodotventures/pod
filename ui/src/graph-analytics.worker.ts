import {
  analyzeTopology,
  type AnalyticsEdge,
  type AnalyticsNode,
  type TopologyAnalysis,
} from './graph-analytics';

type AnalysisRequest = { nodes: AnalyticsNode[]; edges: AnalyticsEdge[] };
type AnalysisResponse =
  | { ok: true; analysis: TopologyAnalysis }
  | { ok: false; error: string };

type WorkerScope = {
  onmessage: ((event: MessageEvent<AnalysisRequest>) => void) | null;
  postMessage: (message: AnalysisResponse) => void;
};

const worker = globalThis as unknown as WorkerScope;

worker.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  try {
    worker.postMessage({ ok: true, analysis: analyzeTopology(event.data.nodes, event.data.edges) } satisfies AnalysisResponse);
  } catch (error) {
    worker.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies AnalysisResponse);
  }
};
