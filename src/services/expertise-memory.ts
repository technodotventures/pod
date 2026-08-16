import type { CoffeePodEnv } from '../config/env.js';
import { findConversationEvidence } from './conversation-memory.js';
import { findApplicableLessons } from './experience-memory.js';
import { normalizeRetrievalEvidence, type RetrievalEvidence } from './retrieval-evidence.js';

export type ExpertiseEvidenceKind = 'conversation_resolution' | 'notable_burst' | 'validated_lesson';

export interface ExpertiseSupport {
  kind: ExpertiseEvidenceKind;
  source_group: string;
  score: number;
  evidence: RetrievalEvidence;
}

export interface ExpertiseMatch {
  actor_id: string;
  actor_name: string | null;
  score: number;
  confidence: number;
  reason: string;
  demonstrated_by: {
    resolutions: number;
    notable_bursts: number;
    validated_lessons: number;
    successful_applications: number;
  };
  matched_terms: string[];
  evidence: RetrievalEvidence[];
}

interface MutableExpertise {
  actor_id: string;
  actor_name: string | null;
  score: number;
  resolutions: number;
  notable_bursts: number;
  validated_lessons: number;
  successful_applications: number;
  matched_terms: Set<string>;
  supports: ExpertiseSupport[];
}

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'before', 'being', 'could', 'from', 'have', 'into',
  'should', 'that', 'their', 'there', 'these', 'this', 'those', 'when', 'where',
  'which', 'with', 'would', 'your', 'what', 'will', 'just', 'then', 'than',
]);

function tokens(value: string): Set<string> {
  return new Set(value
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/)
    .filter(token => token.length >= 3 && !STOP_WORDS.has(token)));
}

function matchingTerms(query: Set<string>, text: string): string[] {
  const haystack = tokens(text);
  return [...query].filter(token => haystack.has(token));
}

function allowedActor(actorId: string | null | undefined): actorId is string {
  return Boolean(actorId)
    && !actorId!.startsWith('unknown:')
    && !actorId!.startsWith('sync:')
    && !actorId!.startsWith('sidecar:')
    && !actorId!.startsWith('system:');
}

function mutableFor(
  byActor: Map<string, MutableExpertise>,
  actorId: string,
  actorName?: string,
): MutableExpertise {
  const existing = byActor.get(actorId);
  if (existing) {
    if (!existing.actor_name && actorName) existing.actor_name = actorName;
    return existing;
  }
  const created: MutableExpertise = {
    actor_id: actorId,
    actor_name: actorName ?? null,
    score: 0,
    resolutions: 0,
    notable_bursts: 0,
    validated_lessons: 0,
    successful_applications: 0,
    matched_terms: new Set(),
    supports: [],
  };
  byActor.set(actorId, created);
  return created;
}

function addSupport(
  mutable: MutableExpertise,
  input: {
    kind: ExpertiseEvidenceKind;
    score: number;
    terms: string[];
    evidence: RetrievalEvidence;
    successfulApplications?: number;
  },
): void {
  mutable.score += input.score;
  for (const term of input.terms) mutable.matched_terms.add(term);
  if (input.kind === 'conversation_resolution') mutable.resolutions += 1;
  if (input.kind === 'notable_burst') mutable.notable_bursts += 1;
  if (input.kind === 'validated_lesson') {
    mutable.validated_lessons += 1;
    mutable.successful_applications += input.successfulApplications ?? 0;
  }
  mutable.supports.push({
    kind: input.kind,
    source_group: input.evidence.source_group,
    score: input.score,
    evidence: input.evidence,
  });
}

function reasonFor(candidate: MutableExpertise): string {
  const reasons = [
    candidate.resolutions > 0
      ? `${candidate.resolutions} cited conversation resolution${candidate.resolutions === 1 ? '' : 's'}`
      : '',
    candidate.notable_bursts > 0
      ? `${candidate.notable_bursts} substantive conversation contribution${candidate.notable_bursts === 1 ? '' : 's'}`
      : '',
    candidate.validated_lessons > 0
      ? `${candidate.validated_lessons} validated workflow lesson${candidate.validated_lessons === 1 ? '' : 's'}`
      : '',
  ].filter(Boolean);
  return `Demonstrated by ${reasons.join(' and ')}.`;
}

export async function findDemonstratedExpertise(
  env: CoffeePodEnv,
  scopes: string[],
  query: string,
  limit = 8,
): Promise<ExpertiseMatch[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];
  const queryTokens = tokens(normalizedQuery);
  if (queryTokens.size === 0) return [];

  const [conversations, lessons] = await Promise.all([
    findConversationEvidence(env, scopes, normalizedQuery, 100),
    findApplicableLessons(env, scopes, { query: normalizedQuery, limit: 100 }),
  ]);
  const byActor = new Map<string, MutableExpertise>();

  for (const conversation of conversations) {
    const names = new Map(conversation.participants.map(participant => [participant.actor_id, participant.actor_name]));
    if (conversation.resolution && allowedActor(conversation.resolution_actor_id)) {
      const terms = matchingTerms(queryTokens, `${conversation.question} ${conversation.resolution} ${conversation.code_refs.join(' ')}`);
      if (terms.length > 0) {
        const actorId = conversation.resolution_actor_id;
        const candidate = mutableFor(byActor, actorId, names.get(actorId));
        const score = 12 + terms.length * 3 + Math.min(8, conversation.relevance_score / 3);
        addSupport(candidate, {
          kind: 'conversation_resolution',
          score,
          terms,
          evidence: normalizeRetrievalEvidence({
            id: `expertise:${actorId}:${conversation.id}:resolution`,
            type: 'expertise',
            title: `${names.get(actorId) ?? actorId} resolved ${conversation.title}`,
            text: conversation.resolution,
            scope: conversation.scope,
            source_group: `conversation:${conversation.source}:${conversation.conversation_id}`,
            source_app: conversation.source,
            source_external_id: conversation.conversation_id,
            observed_at: conversation.ended_at,
            observation_ids: conversation.resolution_observation_id
              ? [conversation.resolution_observation_id]
              : conversation.evidence_observation_ids,
            actor_ids: [actorId],
            score,
            retrievers: ['expertise_projection'],
          }),
        });
      }
    }

    for (const burst of conversation.bursts) {
      if (!allowedActor(burst.actor_id)) continue;
      const terms = matchingTerms(queryTokens, `${conversation.question} ${burst.text}`);
      if (terms.length === 0) continue;
      const candidate = mutableFor(byActor, burst.actor_id, burst.actor_name ?? names.get(burst.actor_id));
      const socialBoost = burst.reasons.includes('endorsed') ? 4 : 0;
      const score = 5 + socialBoost + terms.length * 2;
      addSupport(candidate, {
        kind: 'notable_burst',
        score,
        terms,
        evidence: normalizeRetrievalEvidence({
          id: `expertise:${burst.actor_id}:${conversation.id}:burst:${candidate.notable_bursts + 1}`,
          type: 'expertise',
          title: `${burst.actor_name ?? burst.actor_id} contributed to ${conversation.title}`,
          text: burst.text,
          scope: conversation.scope,
          source_group: `conversation:${conversation.source}:${conversation.conversation_id}:burst:${burst.actor_id}`,
          source_app: conversation.source,
          source_external_id: conversation.conversation_id,
          observed_at: conversation.ended_at,
          observation_ids: burst.evidence_observation_ids,
          actor_ids: [burst.actor_id],
          score,
          retrievers: ['expertise_projection'],
        }),
      });
    }
  }

  for (const lesson of lessons.filter(candidate => candidate.validation_status === 'validated')) {
    const terms = matchingTerms(queryTokens, [
      lesson.task.key,
      lesson.task.title ?? '',
      lesson.task.goal ?? '',
      lesson.instruction,
      lesson.applies_when,
      lesson.failure,
    ].join(' '));
    if (terms.length === 0) continue;
    for (const actorId of lesson.learned_from_actor_ids.filter(allowedActor)) {
      const candidate = mutableFor(byActor, actorId);
      const score = 10 + lesson.success_count * 4 + terms.length * 2 + Math.min(5, lesson.relevance_score / 10);
      addSupport(candidate, {
        kind: 'validated_lesson',
        score,
        terms,
        successfulApplications: lesson.success_count,
        evidence: normalizeRetrievalEvidence({
          id: `expertise:${actorId}:lesson:${lesson.id}`,
          type: 'expertise',
          title: `${actorId} contributed to a validated lesson`,
          text: lesson.instruction,
          scope: lesson.scope,
          source_group: `lesson:${lesson.id}`,
          lesson_id: lesson.id,
          observation_ids: lesson.evidence_observation_ids,
          actor_ids: [actorId],
          observed_at: lesson.last_validated_at ?? lesson.learned_at,
          score,
          confidence: lesson.confidence,
          retrievers: ['expertise_projection'],
        }),
      });
    }
  }

  return [...byActor.values()].map((candidate): ExpertiseMatch => {
    const distinctSources = new Set(candidate.supports.map(support => support.source_group)).size;
    const confidence = Math.min(0.98,
      0.35
      + Math.min(0.3, distinctSources * 0.1)
      + Math.min(0.2, candidate.resolutions * 0.08)
      + Math.min(0.2, candidate.successful_applications * 0.08));
    return {
      actor_id: candidate.actor_id,
      actor_name: candidate.actor_name,
      score: Number(candidate.score.toFixed(3)),
      confidence: Number(confidence.toFixed(3)),
      reason: reasonFor(candidate),
      demonstrated_by: {
        resolutions: candidate.resolutions,
        notable_bursts: candidate.notable_bursts,
        validated_lessons: candidate.validated_lessons,
        successful_applications: candidate.successful_applications,
      },
      matched_terms: [...candidate.matched_terms].sort(),
      evidence: candidate.supports
        .sort((a, b) => b.score - a.score)
        .map(support => support.evidence),
    };
  })
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.actor_id.localeCompare(b.actor_id))
    .slice(0, Math.max(1, Math.min(50, limit)));
}
