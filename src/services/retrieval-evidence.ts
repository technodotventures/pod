export type RetrievalEvidenceKind =
  | 'claim'
  | 'observation'
  | 'object'
  | 'external'
  | 'profile'
  | 'lesson'
  | 'conversation'
  | 'expertise';

export interface RetrievalEvidenceSource {
  app: string | null;
  external_id: string | null;
  url: string | null;
  observed_at: string | null;
}

export interface RetrievalEvidenceProvenance {
  observation_ids: string[];
  actor_ids: string[];
  claim_id: string | null;
  entity_id: string | null;
  object_id: string | null;
  profile_id: string | null;
  lesson_id: string | null;
}

export interface RetrievalEvidenceRanking {
  retrievers: string[];
  score: number | null;
  confidence: number | null;
  recency: number | null;
}

export interface RetrievalEvidenceContext {
  before: string[];
  after: string[];
}

export interface RetrievalEvidenceTemporal {
  valid_from: string | null;
  valid_to: string | null;
  observed_at: string | null;
  recorded_at: string | null;
  basis: 'valid_time' | 'observed_time' | 'recorded_time' | null;
}

/**
 * Common, derived evidence row returned by Pod retrieval surfaces. It is a
 * read model only: canonical observations and claims remain authoritative.
 */
export interface RetrievalEvidence {
  id: string;
  type: RetrievalEvidenceKind;
  title: string;
  text: string;
  scope: string | null;
  source_group: string;
  source: RetrievalEvidenceSource;
  /** Stored context is reference material, never an instruction channel. */
  instruction_authority: 'none';
  actor: {
    ids: string[];
    role: 'source';
  };
  trust: {
    level: 'untrusted' | 'mixed' | 'trusted' | 'unknown';
    basis: string;
  };
  provenance: RetrievalEvidenceProvenance;
  ranking: RetrievalEvidenceRanking;
  context: RetrievalEvidenceContext;
  temporal: RetrievalEvidenceTemporal;
  resolver?: {
    method: 'GET' | 'POST';
    path: string;
  };
}

export interface RetrievalEvidenceCandidate {
  id: string;
  type: RetrievalEvidenceKind;
  title: string;
  text?: string;
  snippet?: string;
  scope?: string | null;
  source_group?: string;
  source_app?: string;
  source_external_id?: string;
  source_id?: string;
  observed_at?: string;
  valid_at?: string | null;
  invalid_at?: string | null;
  recorded_at?: string | null;
  temporal_basis?: RetrievalEvidenceTemporal['basis'];
  url?: string;
  observation_id?: string;
  observation_ids?: string[];
  actor_ids?: string[];
  source_trust?: RetrievalEvidence['trust'];
  claim_id?: string;
  entity_id?: string;
  object_id?: string;
  profile_id?: string;
  lesson_id?: string;
  retrievers?: string[];
  score?: number;
  confidence?: number;
  recency?: number;
  context_before?: string[];
  context_after?: string[];
  resolver?: RetrievalEvidence['resolver'];
  [key: string]: unknown;
}

function compactStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.map(value => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function defaultRetriever(type: RetrievalEvidenceKind): string {
  if (type === 'object') return 'library_fts';
  if (type === 'external') return 'external_mcp';
  if (type === 'profile') return 'peer_card';
  if (type === 'lesson') return 'experience';
  if (type === 'conversation') return 'conversation_projection';
  if (type === 'expertise') return 'expertise_projection';
  return 'lexical';
}

function sourceGroup(candidate: RetrievalEvidenceCandidate, observationIds: string[]): string {
  if (candidate.source_group?.trim()) return candidate.source_group.trim();
  if (candidate.type === 'profile') return `profile:${candidate.profile_id ?? 'self'}`;
  if (candidate.type === 'lesson') return `lesson:${candidate.lesson_id ?? candidate.id}`;
  if (observationIds[0]) return `observation:${observationIds[0]}`;
  if (candidate.type === 'object') {
    return `object:${candidate.source_app ?? 'pod'}:${candidate.source_external_id ?? candidate.object_id ?? candidate.id}`;
  }
  if (candidate.type === 'external') {
    return `external:${candidate.source_app ?? 'mcp'}:${candidate.source_id ?? candidate.id}`;
  }
  return candidate.id;
}

function defaultSourceTrust(type: RetrievalEvidenceKind): RetrievalEvidence['trust'] {
  if (type === 'external' || type === 'conversation') {
    return { level: 'untrusted', basis: 'third_party_content' };
  }
  if (type === 'lesson' || type === 'expertise') {
    return { level: 'mixed', basis: 'derived_projection' };
  }
  if (type === 'profile') {
    return { level: 'mixed', basis: 'scoped_profile_projection' };
  }
  return { level: 'unknown', basis: 'source_not_classified' };
}

export function normalizeRetrievalEvidence(candidate: RetrievalEvidenceCandidate): RetrievalEvidence {
  const observationIds = compactStrings([
    candidate.observation_id,
    ...(candidate.observation_ids ?? []),
  ]);
  const actorIds = compactStrings(candidate.actor_ids ?? []);
  return {
    id: candidate.id,
    type: candidate.type,
    title: candidate.title.trim() || candidate.id,
    text: (candidate.text ?? candidate.snippet ?? candidate.title).trim(),
    scope: candidate.scope?.trim() || null,
    source_group: sourceGroup(candidate, observationIds),
    source: {
      app: candidate.source_app?.trim() || null,
      external_id: (candidate.source_external_id ?? candidate.source_id)?.trim() || null,
      url: candidate.url?.trim() || null,
      observed_at: candidate.observed_at?.trim() || null,
    },
    instruction_authority: 'none',
    actor: {
      ids: actorIds,
      role: 'source',
    },
    trust: candidate.source_trust ?? defaultSourceTrust(candidate.type),
    provenance: {
      observation_ids: observationIds,
      actor_ids: actorIds,
      claim_id: candidate.claim_id?.trim() || null,
      entity_id: candidate.entity_id?.trim() || null,
      object_id: candidate.object_id?.trim() || null,
      profile_id: candidate.profile_id?.trim() || null,
      lesson_id: candidate.lesson_id?.trim() || null,
    },
    ranking: {
      retrievers: compactStrings(candidate.retrievers ?? [defaultRetriever(candidate.type)]),
      score: Number.isFinite(candidate.score) ? candidate.score! : null,
      confidence: Number.isFinite(candidate.confidence) ? candidate.confidence! : null,
      recency: Number.isFinite(candidate.recency) ? candidate.recency! : null,
    },
    context: {
      before: compactStrings(candidate.context_before ?? []),
      after: compactStrings(candidate.context_after ?? []),
    },
    temporal: {
      valid_from: candidate.valid_at?.trim() || null,
      valid_to: candidate.invalid_at?.trim() || null,
      observed_at: candidate.observed_at?.trim() || null,
      recorded_at: candidate.recorded_at?.trim() || null,
      basis: candidate.temporal_basis ?? null,
    },
    ...(candidate.resolver ? { resolver: candidate.resolver } : {}),
  };
}

export interface DiverseEvidenceOptions {
  limit: number;
  maxPerSourceApp?: number;
  maxPerType?: Partial<Record<RetrievalEvidenceKind, number>>;
}

export interface ReciprocalRankFusionOptions {
  smoothing?: number;
  weights?: Partial<Record<string, number>>;
}

function mergedCandidate(
  primary: RetrievalEvidenceCandidate,
  duplicate: RetrievalEvidenceCandidate,
): RetrievalEvidenceCandidate {
  return {
    ...primary,
    observation_ids: compactStrings([
      primary.observation_id,
      ...(primary.observation_ids ?? []),
      duplicate.observation_id,
      ...(duplicate.observation_ids ?? []),
    ]),
    actor_ids: compactStrings([...(primary.actor_ids ?? []), ...(duplicate.actor_ids ?? [])]),
    retrievers: compactStrings([...(primary.retrievers ?? []), ...(duplicate.retrievers ?? [])]),
    score: Math.max(primary.score ?? Number.NEGATIVE_INFINITY, duplicate.score ?? Number.NEGATIVE_INFINITY),
  };
}

/**
 * Fuse the independent ranked views represented by each candidate's
 * retriever tags. Consensus raises a source; no individual scorer's numeric
 * scale is allowed to dominate the others.
 */
export function reciprocalRankFuseEvidenceCandidates(
  candidates: RetrievalEvidenceCandidate[],
  options: ReciprocalRankFusionOptions = {},
): RetrievalEvidenceCandidate[] {
  const smoothing = Math.max(1, options.smoothing ?? 60);
  const lists = new Map<string, RetrievalEvidenceCandidate[]>();
  for (const candidate of candidates) {
    const retrievers = compactStrings(candidate.retrievers ?? [defaultRetriever(candidate.type)]);
    for (const retriever of retrievers) {
      const list = lists.get(retriever) ?? [];
      list.push(candidate);
      lists.set(retriever, list);
    }
  }

  const fused = new Map<string, {
    candidate: RetrievalEvidenceCandidate;
    score: number;
    firstSeen: number;
  }>();
  let sequence = 0;
  for (const [retriever, list] of lists) {
    const weight = options.weights?.[retriever] ?? 1;
    const seenInList = new Set<string>();
    for (let index = 0; index < list.length; index += 1) {
      const candidate = list[index]!;
      const key = normalizeRetrievalEvidence(candidate).source_group;
      if (seenInList.has(key)) continue;
      seenInList.add(key);
      const contribution = weight / (smoothing + index + 1);
      const existing = fused.get(key);
      if (existing) {
        existing.candidate = mergedCandidate(existing.candidate, candidate);
        existing.score += contribution;
      } else {
        fused.set(key, { candidate, score: contribution, firstSeen: sequence });
        sequence += 1;
      }
    }
  }

  return [...fused.values()]
    .sort((a, b) => b.score - a.score || a.firstSeen - b.firstSeen)
    .map(row => ({
      ...row.candidate,
      score: Number(row.score.toFixed(8)),
    }));
}

/**
 * Collapse duplicate retrieval views of the same source, then prevent one
 * connector or evidence kind from monopolising the final packet.
 */
export function selectDiverseEvidenceCandidates(
  candidates: RetrievalEvidenceCandidate[],
  options: DiverseEvidenceOptions,
): RetrievalEvidenceCandidate[] {
  const bySource = new Map<string, RetrievalEvidenceCandidate>();
  const order: string[] = [];
  for (const candidate of candidates) {
    const key = normalizeRetrievalEvidence(candidate).source_group;
    const existing = bySource.get(key);
    if (existing) {
      bySource.set(key, mergedCandidate(existing, candidate));
    } else {
      bySource.set(key, candidate);
      order.push(key);
    }
  }

  const appCounts = new Map<string, number>();
  const typeCounts = new Map<RetrievalEvidenceKind, number>();
  const selected: RetrievalEvidenceCandidate[] = [];
  for (const key of order) {
    if (selected.length >= options.limit) break;
    const candidate = bySource.get(key)!;
    const app = candidate.source_app?.trim();
    const maxForApp = options.maxPerSourceApp ?? Number.POSITIVE_INFINITY;
    if (app && (appCounts.get(app) ?? 0) >= maxForApp) continue;
    const maxForType = options.maxPerType?.[candidate.type] ?? Number.POSITIVE_INFINITY;
    if ((typeCounts.get(candidate.type) ?? 0) >= maxForType) continue;
    selected.push(candidate);
    if (app) appCounts.set(app, (appCounts.get(app) ?? 0) + 1);
    typeCounts.set(candidate.type, (typeCounts.get(candidate.type) ?? 0) + 1);
  }
  return selected;
}

function searchTerms(query: string): string[] {
  return compactStrings(query.toLowerCase().split(/[^a-z0-9_./:-]+/g))
    .filter(term => term.length > 2);
}

/** Select the best matching paragraph and at most one neighbour on each side. */
export function expandTextAroundMatch(
  content: string,
  query: string,
  maxChars = 1_200,
): { text: string; before: string[]; after: string[] } {
  const paragraphs = content
    .split(/\n\s*\n/g)
    .map(value => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return { text: '', before: [], after: [] };
  const terms = searchTerms(query);
  let bestIndex = 0;
  let bestScore = -1;
  for (let index = 0; index < paragraphs.length; index += 1) {
    const lower = paragraphs[index]!.toLowerCase();
    const score = terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  const before = bestIndex > 0 ? [paragraphs[bestIndex - 1]!] : [];
  const after = bestIndex + 1 < paragraphs.length ? [paragraphs[bestIndex + 1]!] : [];
  const bounded = [...before, paragraphs[bestIndex]!, ...after].join('\n\n').slice(0, Math.max(1, maxChars));
  return {
    text: bounded,
    before: before.filter(value => bounded.includes(value)),
    after: after.filter(value => bounded.includes(value)),
  };
}
