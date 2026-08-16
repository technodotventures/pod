/**
 * Ask Pod client — scopes Pod queries to the current Map state.
 *
 * The backend (`POST /pod/query`) already accepts `context: { kind: 'map_selection', ... }`
 * and `generateAskPodAnswer` formats it into the prompt. This module just types the call,
 * generates context-aware suggested prompts, and resolves backend evidence markers.
 */

export interface AskPodNodeRef {
  id: string;
  label: string;
  type: string;
}

export interface AskPodEdgeRef {
  id: string;
  source: string;
  target: string;
  label?: string;
  layer?: 'structural' | 'canonical' | 'derived' | 'annotation';
}

export interface AskPodScope {
  /** Visible/filtered subgraph (after lens + filters). */
  visibleNodes: AskPodNodeRef[];
  visibleEdges: AskPodEdgeRef[];
  /** Currently-selected single node, if any. */
  selectedNode?: AskPodNodeRef;
  /** Local-graph focus root + depth, if active. */
  focus?: { node: AskPodNodeRef; depth: number };
  /** Ordered waypoints of a user-defined trace path (Phase E). */
  trace?: AskPodNodeRef[];
  /** Top-influential node labels (Phase D/E richer context). */
  influential?: string[];
  /** Detected community summaries (top labels per community), if available. */
  communities?: Array<{ id: number; topLabels: string[] }>;
  /** Active lens id at time of question, for prompt phrasing. */
  lensId?: string;
}

export interface AskPodRequest {
  query: string;
  actorId?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  scope: AskPodScope;
  authToken?: string;
}

export interface AskPodResult {
  answer: string;
  provider?: string;
  model?: string;
  sources: AskPodEvidenceSource[];
  /** Explicit [S#] evidence markers returned by the backend/model. */
  citations: Array<{
    start: number;
    end: number;
    sourceId: string;
    marker: string;
    label: string;
    nodeId?: string;
    url?: string;
  }>;
}

export interface AskPodEvidenceSource {
  marker: string;
  id: string;
  type: 'claim' | 'observation' | 'object' | 'external' | 'profile' | 'lesson' | 'conversation' | 'expertise';
  title: string;
  snippet?: string;
  claim_id?: string;
  observation_id?: string;
  observation_ids?: string[];
  object_id?: string;
  entity_id?: string;
  profile_id?: 'self';
  url?: string;
  resolver?: {
    method: 'GET' | 'POST';
    path: string;
  };
}

/** Build the backend contract separately so the Map client stays testable. */
export function buildAskPodQueryBody(req: AskPodRequest) {
  // Cap context size to keep the prompt reasonable. Backend re-truncates internally.
  const labels = uniqueStrings([
    ...(req.scope.selectedNode ? [req.scope.selectedNode.label] : []),
    ...(req.scope.focus ? [req.scope.focus.node.label] : []),
    ...(req.scope.trace ?? []).map(n => n.label),
    ...(req.scope.visibleNodes.slice(0, 60).map(n => n.label)),
  ]);
  const nodeIds = uniqueStrings([
    ...(req.scope.selectedNode ? [req.scope.selectedNode.id] : []),
    ...(req.scope.focus ? [req.scope.focus.node.id] : []),
    ...(req.scope.trace ?? []).map(n => n.id),
    ...(req.scope.visibleNodes.slice(0, 60).map(n => n.id)),
  ]);
  const objectIds = nodeIds
    .filter(id => id.startsWith('obj:'))
    .map(id => id.slice(4));

  // Hint the model with cluster + influence context via the labels list (prompt builder uses labels).
  const contextLabels = [...labels];
  if (req.scope.influential && req.scope.influential.length > 0) {
    contextLabels.push(...req.scope.influential.map(l => `[influential] ${l}`));
  }
  if (req.scope.communities && req.scope.communities.length > 0) {
    for (const c of req.scope.communities) {
      contextLabels.push(`[cluster ${c.id}] ${c.topLabels.slice(0, 4).join(', ')}`);
    }
  }
  if (req.scope.trace && req.scope.trace.length >= 2) {
    contextLabels.push(`[trace] ${req.scope.trace.map(n => n.label).join(' → ')}`);
  }
  if (req.scope.focus) {
    contextLabels.push(`[focus ${req.scope.focus.depth}-hop] ${req.scope.focus.node.label}`);
  }
  if (req.scope.lensId) {
    contextLabels.push(`[lens] ${req.scope.lensId}`);
  }

  return {
    query: req.query,
    actor_id: req.actorId ?? 'person-local',
    history: req.history?.slice(-8),
    scope: 'all',
    use_llm: true,
    include_observations: true,
    include_external_mcp: true,
    model_mode: 'auto',
    context: {
      kind: 'map_selection',
      node_ids: nodeIds,
      object_ids: objectIds,
      labels: contextLabels,
      edges: req.scope.visibleEdges.slice(0, 80).map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        layer: e.layer,
      })),
    },
  };
}

/** Fire one Ask Pod query, scoping it to the visible Map subgraph. */
export async function askPod(req: AskPodRequest): Promise<AskPodResult> {
  const body = buildAskPodQueryBody(req);
  const res = await fetch('/pod/query', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(req.authToken ? { authorization: `Bearer ${req.authToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Ask Pod failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const data = await res.json() as {
    answer?: string;
    answer_provider?: string;
    answer_model?: string;
    citations?: AskPodEvidenceSource[];
    results?: unknown;
    fallback_answer?: string;
  };
  const answer = data.answer
    ?? (typeof data.fallback_answer === 'string' ? data.fallback_answer : '')
    ?? '';
  const sources = Array.isArray(data.citations) ? data.citations : [];

  return {
    answer,
    provider: data.answer_provider,
    model: data.answer_model,
    sources,
    citations: extractEvidenceCitations(answer, sources, req.scope.visibleNodes),
  };
}

/**
 * Resolve only explicit backend evidence markers. Entity-name mentions are not
 * citations: without an [S#] marker they remain ordinary answer text.
 */
export function extractEvidenceCitations(
  answer: string,
  sources: AskPodEvidenceSource[],
  visibleNodes: AskPodNodeRef[],
): AskPodResult['citations'] {
  if (!answer || sources.length === 0) return [];
  const byMarker = new Map(sources.map(source => [source.marker, source]));
  const visibleIds = new Set(visibleNodes.map(node => node.id));
  const citations: AskPodResult['citations'] = [];
  for (const match of answer.matchAll(/\[(S\d+)\]/g)) {
    const source = byMarker.get(match[1]!);
    if (!source || match.index === undefined) continue;
    const candidateNodeId = source.object_id
      ? `obj:${source.object_id}`
      : source.entity_id
        ? `sw:${source.entity_id}`
        : undefined;
    citations.push({
      start: match.index,
      end: match.index + match[0].length,
      sourceId: source.id,
      marker: source.marker,
      label: source.title,
      nodeId: candidateNodeId && visibleIds.has(candidateNodeId) ? candidateNodeId : undefined,
      url: source.url,
    });
  }
  return citations;
}

/**
 * Generate 3 context-aware suggested prompts to seed the Ask Pod input.
 * The wording follows the plan's §4b examples.
 */
export function suggestedPromptsForScope(scope: AskPodScope): string[] {
  if (scope.trace && scope.trace.length >= 2) {
    return [
      `What's the throughline this path tells?`,
      `What's the strongest causal chain from ${scope.trace[0].label} to ${scope.trace[scope.trace.length - 1].label}?`,
      `What's missing from this path — what node would I add and where?`,
    ];
  }
  if (scope.selectedNode) {
    const l = scope.selectedNode.label;
    return [
      `Tell me everything you know about ${l}.`,
      `Who or what is most connected to ${l}?`,
      `What's the throughline from ${l} to my most recent work?`,
    ];
  }
  if (scope.focus) {
    const l = scope.focus.node.label;
    return [
      `Summarise the neighbourhood around ${l}.`,
      `What are the main themes near ${l}?`,
      `What's the most surprising thing connected to ${l}?`,
    ];
  }
  if (scope.lensId === 'bridges' && scope.communities && scope.communities.length >= 2) {
    const a = scope.communities[0];
    const b = scope.communities[1];
    return [
      `What might connect ${a.topLabels.slice(0, 3).join(', ')} with ${b.topLabels.slice(0, 3).join(', ')}?`,
      `Are there hidden bridges between my clusters I haven't noticed?`,
      `What's missing from this map?`,
    ];
  }
  if (scope.lensId === 'themes') {
    return [
      `What are the main themes in my graph?`,
      `What have I been thinking about most this month?`,
      `Which themes seem to be growing?`,
    ];
  }
  if (scope.lensId === 'influence') {
    return [
      `Why do the influential nodes connect so much?`,
      `What roles do my top influential nodes play?`,
      `Which influential node should I look at first?`,
    ];
  }
  return [
    `What are the main themes in my graph?`,
    `What have I been thinking about most this month?`,
    `What's missing from this map?`,
  ];
}

/** Heuristic: is the user typing a search query, or asking a question? */
export function looksLikeAskQuery(text: string): boolean {
  const t = text.trim();
  if (t.length < 4) return false;
  if (t.endsWith('?')) return true;
  return /^(what|how|why|who|when|where|find|show|compare|explain|summari[sz]e|give|tell|describe)\b/i.test(t);
}

const LOCAL_SEARCH_STOP_WORDS = new Set([
  'about', 'and', 'are', 'can', 'could', 'did', 'does', 'for', 'from', 'give',
  'has', 'have', 'how', 'into', 'its', 'me', 'my', 'please', 'should', 'show',
  'tell', 'that', 'the', 'their', 'them', 'there', 'these', 'they', 'this',
  'those', 'was', 'were', 'what', 'when', 'where', 'which', 'who', 'why',
  'will', 'with', 'would', 'you', 'your',
]);

/** Meaningful words for the emergency in-browser cache search. */
export function localAskPodSearchTerms(text: string): string[] {
  const words = text.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];
  return [...new Set(words.filter(word =>
    word.length > 2 && !LOCAL_SEARCH_STOP_WORDS.has(word)))];
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}
