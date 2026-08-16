// Context API — the one-call read primitive that makes Pod a memory *layer*.
//
//   POST /pod/context  { query, scope?, agent_id?, token_budget?, ... }
//     → a ranked, provenance-tagged context pack any agent prepends to its
//       prompt: claims with epistemic tag, confidence, author, scope, and a
//       one-line citation, trimmed to a token budget.
//
// An agent's access preset, selected areas, persona, and default budget come
// from the agents table. This route enforces that memory boundary and the
// other memory routes apply the same policy.
//
// Every call is logged as a `memory_access` observation so the audit view can
// later answer "what did agent X read this week".

import type { FastifyInstance } from 'fastify';
import {
  CONTEXT_RETRIEVAL_MODES,
  decideContextRetrieval,
  planContextPacking,
  type ContextRetrievalMode,
} from 'smartware';

import type { CoffeePodEnv } from '../config/env.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { getDb, getAgent, type PodAgent } from '../pod/db.js';
import { agentAllowedScopeNames } from '../pod/agent-access.js';
import {
  findApplicableLessons,
  type ApplicableExperienceLesson,
  type ExperienceTaskQuery,
} from '../services/experience-memory.js';
import {
  filterSelfProfileByScopes,
  readSelfProfile,
  type ProfileFact,
} from '../services/profile-anchor.js';
import { normalizeRetrievalEvidence } from '../services/retrieval-evidence.js';
import {
  evaluateSmartwareHybridRecall,
  readRetrievalSettings,
  shouldUseSemanticFallback,
  type HybridRecallEvaluation,
} from '../services/semantic-retrieval.js';
import {
  findConversationEvidence,
  type ConversationMatch,
} from '../services/conversation-memory.js';

interface ContextRequestBody {
  /** What the agent wants context about. Empty = recent/salient memory. */
  query?: string;
  /** Explicit scope name(s). Ignored where they exceed the brain's view. */
  scope?: string | string[];
  /** Resolve the brain (persona + scope view + budget) for this agent id. */
  agent_id?: string;
  /** Max tokens for the returned pack. Falls back to the brain's budget, then 1500. */
  token_budget?: number;
  /** Only return claims at/above this confidence (0..1). */
  min_confidence?: number;
  /** Restrict to these epistemic tags (fact / inference / opinion / ...). */
  epistemic?: string[];
  include_sensitive?: boolean;
  include_stale?: boolean;
  /** Structured task identity makes experience transfer deterministic across agents. */
  task?: ExperienceTaskQuery;
  /** Always retrieve (default), conservatively auto-gate, or explicitly skip memory. */
  retrieval_mode?: ContextRetrievalMode;
  /** Restrict retrieval before candidate generation and packing. */
  source_types?: Array<'claim' | 'profile' | 'lesson' | 'conversation'>;
}

interface ContextItem {
  entity_id: string;
  entity: string;
  scope: string;
  score: number;
  text: string;
  epistemic?: string;
  confidence?: number;
  predicate?: string;
  claim_id?: string;
  observation_ids?: string[];
  retrievers: string[];
}

const DEFAULT_BUDGET = 1500;
const CONTEXT_LANES = ['profile', 'lessons', 'conversations', 'claims'] as const;
type ContextLane = typeof CONTEXT_LANES[number];
const CONTEXT_PACKING_POLICY = {
  lane_order: CONTEXT_LANES,
  lane_weights: {
    profile: 20,
    lessons: 20,
    conversations: 25,
    claims: 35,
  } satisfies Record<ContextLane, number>,
  overflow_order: ['claims', 'conversations', 'lessons', 'profile'] as const,
};
// Rough token estimate — good enough for trimming without a tokenizer dep.
const estimateTokens = (s: string): number => Math.ceil(s.length / 4);

export async function registerContextRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);

  app.post('/pod/context', {
    schema: { summary: 'Assemble a ranked, provenance-tagged context pack for an agent (the memory-layer read primitive).' },
  }, async (request, reply) => {
    const body = (request.body ?? {}) as ContextRequestBody;
    if (body.retrieval_mode !== undefined
      && !CONTEXT_RETRIEVAL_MODES.includes(body.retrieval_mode)) {
      return reply.code(400).send({
        error: 'invalid_retrieval_mode',
        message: `retrieval_mode must be one of ${CONTEXT_RETRIEVAL_MODES.join(', ')}`,
      });
    }
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const allScopeNames = Object.keys(profile.scopes) as Array<keyof typeof profile.scopes>;

    // ── Resolve the calling brain ──────────────────────────────────────────
    // Prefer the authenticated agent (Bearer token → coffeePodAuth), else an
    // explicit agent_id, else treat as the owner (full view).
    const auth = request.coffeePodAuth;
    const authenticatedActorId = auth?.kind === 'agent'
      ? auth.actor_id
      : auth?.kind === 'client'
        ? auth.client.actor_id
        : undefined;
    if (authenticatedActorId && body.agent_id && body.agent_id !== authenticatedActorId) {
      return reply.code(403).send({
        error: 'forbidden',
        message: 'The authenticated client cannot select a different agent policy.',
      });
    }
    const brainId = authenticatedActorId ?? body.agent_id;
    const brain: PodAgent | null = brainId ? getAgent(db, brainId) : null;

    // ── Least-privilege scope view ─────────────────────────────────────────
    // A brain sees only the scopes it was granted. Owner (no brain) sees all.
    // An explicit `scope` request is intersected with the view, never widens it.
    const viewScopeNames: string[] = brain
      ? agentAllowedScopeNames(brain, 'read', allScopeNames)
      : [...allScopeNames];

    const requestedRaw = body.scope
      ? (Array.isArray(body.scope) ? body.scope : [body.scope])
      : null;
    const requested = requestedRaw?.includes('all')
      ? null
      : requestedRaw?.map(value => {
          if (value in profile.scopes) return value;
          return Object.entries(profile.scopes).find(([, id]) => id === value)?.[0] ?? value;
        }) ?? null;
    const effectiveNames = requested
      ? viewScopeNames.filter(s => requested.includes(s))
      : viewScopeNames;

    // Map scope names ("personal") to their resolved ids.
    const scopeIds = effectiveNames
      .map(name => profile.scopes[name as keyof typeof profile.scopes])
      .filter(Boolean) as string[];

    if (scopeIds.length === 0) {
      return reply.code(403).send({
        error: 'no_scope_access',
        message: brain
          ? `Brain "${brain.name}" has no readable scope in this request.`
          : 'No matching scope.',
      });
    }

    const configuredBudget = brain?.context_budget ?? DEFAULT_BUDGET;
    const budget = brain
      ? Math.min(body.token_budget ?? configuredBudget, configuredBudget)
      : body.token_budget ?? DEFAULT_BUDGET;
    const query = (body.query ?? '').trim();
    const requestedTypes = new Set(body.source_types ?? []);
    const wants = (type: 'claim' | 'profile' | 'lesson' | 'conversation') => requestedTypes.size === 0 || requestedTypes.has(type);
    const retrievalStartedAt = Date.now();
    const gate = decideContextRetrieval(body.retrieval_mode ?? 'always', query, Boolean(body.task));
    const actor = brain
      ? { type: 'agent' as const, id: brain.id, display_name: brain.name }
      : authenticatedActorId
        ? { type: 'agent' as const, id: authenticatedActorId, display_name: authenticatedActorId }
      : { type: 'person' as const, id: profile.owner_id, display_name: 'Owner' };

    // ── Recall across the brain's scopes, merge, rank ──────────────────────
    const items: ContextItem[] = [];
    const claimStartedAt = Date.now();
    if (gate.decision === 'retrieve' && wants('claim')) {
      for (const scope of scopeIds) {
        try {
          const res = await core.recall({
            actor,
            query: query || '*',
            scope,
            min_confidence: body.min_confidence,
            epistemic: body.epistemic,
            include_sensitive: body.include_sensitive ?? false,
            include_stale: body.include_stale ?? false,
            limit: 30,
            resolution: 'oneliner',
          });
          for (const r of res.results) {
            const claimText = r.claim
              ? `${r.entity_name} — ${r.claim.predicate} ${formatObject(r.claim.object)}`
              : r.entity_name;
            items.push({
              entity_id: r.entity_id,
              entity: r.entity_name,
              scope: r.scope,
              score: r.score,
              text: claimText,
              epistemic: r.claim?.epistemic,
              confidence: r.claim?.confidence,
              predicate: r.claim?.predicate,
              claim_id: r.claim?.id,
              observation_ids: r.claim?.observation_ids,
              retrievers: ['lexical'],
            });
          }
        } catch (err) {
          app.log.warn({ err, scope }, 'context: recall failed for scope');
        }
      }
    }
    const claimDurationMs = Date.now() - claimStartedAt;

    items.sort((a, b) => b.score - a.score);

    // ── Smartware hybrid shadow/fallback ──────────────────────────────────
    // Smartware owns eligibility, persistence, temporal semantics, and fusion.
    // Shadow mode measures candidates without changing the delivered context.
    // Sensitive claims are never sent to the configured embedding provider.
    const retrievalSettings = readRetrievalSettings(db);
    let semanticStatus: 'skipped' | 'unavailable' | 'ok' | 'error' = 'skipped';
    let semanticModel: string | null = null;
    let semanticCount = 0;
    const hybridEvaluations: HybridRecallEvaluation[] = [];
    let hybridApplied = false;
    const useFallback = shouldUseSemanticFallback(items, retrievalSettings);
    const evaluateHybrid = retrievalSettings.semantic_mode === 'shadow' || useFallback;
    if (gate.decision === 'retrieve' && wants('claim') && query && evaluateHybrid) {
      const byClaim = new Map(
        items.flatMap(item => item.claim_id ? [[item.claim_id, item] as const] : []),
      );
      for (const scope of scopeIds) {
        const evaluation = await evaluateSmartwareHybridRecall(
          env,
          db,
          core,
          {
            actor,
            query,
            scope,
            min_confidence: body.min_confidence,
            epistemic: body.epistemic,
            include_stale: body.include_stale,
          },
        );
        hybridEvaluations.push(evaluation);
        semanticModel ??= evaluation.model ?? null;
        semanticCount += evaluation.matches.length;
        if (evaluation.status === 'error') {
          semanticStatus = 'error';
          app.log.warn(
            { error: evaluation.error, scope },
            'context: Smartware hybrid evaluation failed',
          );
          continue;
        }
        if (evaluation.status === 'unavailable' && semanticStatus === 'skipped') {
          semanticStatus = 'unavailable';
          continue;
        }
        if (evaluation.status !== 'ok') continue;
        if (semanticStatus !== 'error') semanticStatus = 'ok';

        if (retrievalSettings.semantic_mode !== 'fallback'
          || !useFallback
          || evaluation.selected_channel !== 'hybrid') {
          continue;
        }
        hybridApplied = true;
        const strongest = Math.max(
          0,
          ...evaluation.matches.map(match => match.rrf_score),
        );
        for (const match of evaluation.matches) {
          const score = strongest > 0 ? match.rrf_score / strongest : 0;
          const existing = byClaim.get(match.claim_id);
          if (existing) {
            existing.retrievers = [...new Set([...existing.retrievers, 'hybrid'])];
            existing.score = Math.max(existing.score, score);
            continue;
          }
          const hybridItem: ContextItem = {
            entity_id: match.entity_id,
            entity: match.entity,
            scope: match.scope,
            score,
            text: match.text,
            confidence: match.confidence,
            predicate: match.predicate,
            claim_id: match.claim_id,
            observation_ids: match.observation_ids,
            retrievers: ['hybrid'],
          };
          items.push(hybridItem);
          byClaim.set(match.claim_id, hybridItem);
        }
      }
      items.sort((left, right) => right.score - left.score);
    }
    const hybridOverlap = hybridEvaluations
      .reduce((total, evaluation) => total + evaluation.comparison.overlap_count, 0);
    const hybridTop1Comparable = hybridEvaluations
      .filter(evaluation => evaluation.comparison.top1_agreement !== null);
    const hybridTop1Agreements = hybridTop1Comparable
      .filter(evaluation => evaluation.comparison.top1_agreement === true).length;
    const hybridSelections = hybridEvaluations
      .filter(evaluation => evaluation.selected_channel === 'hybrid').length;

    // ── Agent experience ──────────────────────────────────────────────────
    // Lessons are derived from immutable attempt + feedback observations.
    // They are scoped by the same least-privilege view as canonical recall
    // and remain explicitly separate from user-owned facts.
    let lessonMatches: ApplicableExperienceLesson[] = [];
    const lessonStartedAt = Date.now();
    if (gate.decision === 'retrieve' && wants('lesson')) {
      try {
        lessonMatches = await findApplicableLessons(env, scopeIds, {
          query,
          task: body.task,
        });
      } catch (err) {
        app.log.warn({ err }, 'context: experience lesson lookup failed');
      }
    }
    const lessonDurationMs = Date.now() - lessonStartedAt;

    // ── Conversation memory ───────────────────────────────────────────────
    // Thread artifacts are disposable read models derived from the original,
    // cited messages. The same scope fence applies before they enter context.
    let conversationMatches: ConversationMatch[] = [];
    const conversationStartedAt = Date.now();
    if (gate.decision === 'retrieve' && wants('conversation')) {
      try {
        conversationMatches = await findConversationEvidence(env, scopeIds, query, 8);
      } catch (err) {
        app.log.warn({ err }, 'context: conversation lookup failed');
      }
    }
    const conversationDurationMs = Date.now() - conversationStartedAt;

    // ── Federated peer card ────────────────────────────────────────────────
    // The peer card follows the agent across task scopes, but individual facts
    // remain fenced by the source scope the agent is authorized to read.
    let selfProfile = null as Awaited<ReturnType<typeof readSelfProfile>>;
    const profileStartedAt = Date.now();
    if (gate.decision === 'retrieve' && wants('profile')) {
      try {
        const fullProfile = await readSelfProfile(env, profile, core.readKnowledgeGraph({
          actor: { type: 'person', id: profile.owner_id, display_name: 'Pod owner' },
          scopes: Object.values(profile.scopes),
        }));
        if (fullProfile) {
          const viewScopeIds = viewScopeNames
            .map(name => profile.scopes[name as keyof typeof profile.scopes])
            .filter(Boolean) as string[];
          selfProfile = filterSelfProfileByScopes(fullProfile, viewScopeIds);
        }
      } catch (err) {
        app.log.warn({ err }, 'context: self profile lookup failed');
      }
    }
    const profileDurationMs = Date.now() - profileStartedAt;
    const retrievalDurationMs = Date.now() - retrievalStartedAt;

    // ── Trim to the token budget ───────────────────────────────────────────
    // Reserve room for the persona preface, then carry the authorized peer
    // card and applicable lessons before ordinary recalled claims.
    const personaTokens = brain?.persona ? estimateTokens(brain.persona) : 0;
    const profileCandidates = (selfProfile?.facts ?? []).map(fact => {
      const contextText = `[User profile · ${fact.category}] ${fact.text}`;
      return { ...fact, context_text: contextText, pack_tokens: estimateTokens(contextText) + 4 };
    });
    const lessonCandidates = lessonMatches.map(lesson => {
      const text = experienceLessonText(lesson);
      return { ...lesson, text, pack_tokens: estimateTokens(text) + 4 };
    });
    const conversationCandidates = conversationMatches.map(conversation => ({
      ...conversation,
      pack_tokens: estimateTokens(conversation.text) + 4,
    }));
    const claimCandidates = items.map(item => ({
      ...item,
      pack_tokens: estimateTokens(item.text) + 4,
    }));
    const packingPlan = planContextPacking({
      profile: profileCandidates.map(candidate => candidate.pack_tokens),
      lessons: lessonCandidates.map(candidate => candidate.pack_tokens),
      conversations: conversationCandidates.map(candidate => candidate.pack_tokens),
      claims: claimCandidates.map(candidate => candidate.pack_tokens),
    }, Math.max(0, budget - personaTokens), CONTEXT_PACKING_POLICY);
    const packedProfileFacts: Array<ProfileFact & { context_text: string }> = packingPlan.selected.profile
      .map(index => {
        const { pack_tokens: _, ...fact } = profileCandidates[index]!;
        return fact;
      });
    const packedLessons: Array<ApplicableExperienceLesson & { text: string }> = packingPlan.selected.lessons
      .map(index => {
        const { pack_tokens: _, ...lesson } = lessonCandidates[index]!;
        return lesson;
      });
    const packedConversations: ConversationMatch[] = packingPlan.selected.conversations
      .map(index => {
        const { pack_tokens: _, ...conversation } = conversationCandidates[index]!;
        return conversation;
      });
    const packed: ContextItem[] = packingPlan.selected.claims
      .map(index => {
        const { pack_tokens: _, ...item } = claimCandidates[index]!;
        return item;
      });
    const used = personaTokens + packingPlan.used_tokens;
    const candidateCounts = {
      profile: profileCandidates.length,
      lessons: lessonCandidates.length,
      conversations: conversationCandidates.length,
      claims: claimCandidates.length,
    };
    const packedCounts = {
      profile: packedProfileFacts.length,
      lessons: packedLessons.length,
      conversations: packedConversations.length,
      claims: packed.length,
    };

    // ── Audit: record the read so the agent-activity view can surface it ────
    try {
      await core.observe({
        actor,
        // No dedicated memory-read observation type yet; `system` + the
        // action tag in the body is what the audit view will filter on.
        type: 'system',
        scope: scopeIds[0],
        visibility: 'private',
        app: 'coffee-pod',
        source_id: `context:${brain?.id ?? 'owner'}:${Date.now()}`,
        content: {
          format: 'application/json',
          body: {
            action: 'context_read',
            agent_id: brain?.id ?? null,
            query: query || null,
            task: body.task ?? null,
            scopes: effectiveNames,
            returned: packed.length + packedLessons.length + packedProfileFacts.length + packedConversations.length,
            profile_facts_returned: packedProfileFacts.length,
            lessons_returned: packedLessons.length,
            conversations_returned: packedConversations.length,
            semantic_status: semanticStatus,
            semantic_results: semanticCount,
            hybrid_shadow_scopes: hybridEvaluations.length,
            hybrid_selections: hybridSelections,
            hybrid_applied: hybridApplied,
            hybrid_overlap: hybridOverlap,
            hybrid_top1_agreements: hybridTop1Agreements,
            retrieval_gate: gate,
            candidate_counts: candidateCounts,
            packed_counts: packedCounts,
            lane_token_estimates: packingPlan.lane_tokens,
            retrieval_duration_ms: retrievalDurationMs,
            token_estimate: used,
          },
        },
        sensitive: false,
      });
    } catch { /* audit is best-effort — never block the read */ }

    const evidence = [
      ...packedProfileFacts.map(fact => normalizeRetrievalEvidence({
        id: `profile:${fact.id}`,
        type: 'profile',
        title: `User profile · ${fact.category}`,
        text: fact.text,
        scope: fact.scope,
        profile_id: 'self',
        observation_ids: fact.source_ids,
        confidence: fact.confidence,
        retrievers: ['peer_card'],
        resolver: { method: 'GET', path: '/pod/wiki/profile' },
      })),
      ...packedLessons.map(lesson => normalizeRetrievalEvidence({
        id: `lesson:${lesson.id}`,
        type: 'lesson',
        title: lesson.task.title ?? lesson.task.key,
        text: lesson.text,
        scope: lesson.scope,
        lesson_id: lesson.id,
        observation_ids: lesson.evidence_observation_ids,
        actor_ids: lesson.learned_from_actor_ids,
        score: lesson.relevance_score,
        confidence: lesson.confidence,
        retrievers: ['experience'],
      })),
      ...packedConversations.map(conversation => normalizeRetrievalEvidence({
        id: `conversation:${conversation.id}`,
        type: 'conversation',
        title: conversation.title,
        text: conversation.text,
        scope: conversation.scope,
        source_group: `conversation:${conversation.source}:${conversation.conversation_id}`,
        source_app: conversation.source,
        source_external_id: conversation.conversation_id,
        observed_at: conversation.ended_at,
        observation_ids: conversation.evidence_observation_ids,
        actor_ids: conversation.participants.map(participant => participant.actor_id),
        score: conversation.relevance_score,
        retrievers: ['conversation_projection'],
      })),
      ...packed.map(item => normalizeRetrievalEvidence({
        id: item.claim_id ? `claim:${item.claim_id}` : `entity:${item.entity_id}`,
        type: 'claim',
        title: item.entity,
        text: item.text,
        scope: item.scope,
        claim_id: item.claim_id,
        entity_id: item.entity_id,
        observation_ids: item.observation_ids,
        score: item.score,
        confidence: item.confidence,
        retrievers: item.retrievers,
      })),
    ];

    return {
      persona: brain?.persona ?? null,
      brain: brain ? { id: brain.id, name: brain.name, model: brain.model } : null,
      scopes_read: effectiveNames,
      token_budget: budget,
      token_estimate: used,
      retrieval: {
        gate,
        duration_ms: retrievalDurationMs,
        stages: [
          ...(wants('profile') ? [{ id: 'profile', duration_ms: profileDurationMs, candidates: candidateCounts.profile, packed: packedCounts.profile, tokens: packingPlan.lane_tokens.profile }] : []),
          ...(wants('lesson') ? [{ id: 'lesson', duration_ms: lessonDurationMs, candidates: candidateCounts.lessons, packed: packedCounts.lessons, tokens: packingPlan.lane_tokens.lessons }] : []),
          ...(wants('conversation') ? [{ id: 'conversation', duration_ms: conversationDurationMs, candidates: candidateCounts.conversations, packed: packedCounts.conversations, tokens: packingPlan.lane_tokens.conversations }] : []),
          ...(wants('claim') ? [{ id: 'claim', duration_ms: claimDurationMs, candidates: candidateCounts.claims, packed: packedCounts.claims, tokens: packingPlan.lane_tokens.claims }] : []),
        ],
        lexical_results: items.filter(item => item.retrievers.includes('lexical')).length,
        conversation_results: conversationMatches.length,
        packing: {
          candidate_counts: candidateCounts,
          packed_counts: packedCounts,
          lane_token_estimates: packingPlan.lane_tokens,
        },
        semantic: {
          mode: retrievalSettings.semantic_mode,
          status: semanticStatus,
          model: semanticModel,
          results: semanticCount,
          shadow_scopes: hybridEvaluations.length,
          selected_hybrid_scopes: hybridSelections,
          applied: hybridApplied,
          overlap: hybridOverlap,
          top1_agreement_rate: hybridTop1Comparable.length > 0
            ? hybridTop1Agreements / hybridTop1Comparable.length
            : null,
        },
      },
      evidence,
      self_profile: selfProfile ? {
        profile_id: selfProfile.profile_id,
        updated_at: selfProfile.updated_at,
        facts: packedProfileFacts.map(fact => ({
          id: fact.id,
          category: fact.category,
          text: fact.text,
          context_text: fact.context_text,
          scope: fact.scope,
          origin: fact.origin,
          confidence: fact.confidence ?? null,
          source_ids: fact.source_ids,
        })),
      } : null,
      lessons: packedLessons.map(lesson => ({
        id: lesson.id,
        text: lesson.text,
        instruction: lesson.instruction,
        applies_when: lesson.applies_when,
        previous_failure: lesson.failure,
        task: lesson.task,
        scope: lesson.scope,
        origin: lesson.origin,
        validation_status: lesson.validation_status,
        confidence: lesson.confidence,
        utility_score: lesson.utility_score,
        failure_count: lesson.failure_count,
        success_count: lesson.success_count,
        last_applied_at: lesson.last_applied_at ?? null,
        evidence_observation_ids: lesson.evidence_observation_ids,
        learned_from_actor_ids: lesson.learned_from_actor_ids,
        score: lesson.relevance_score,
      })),
      conversations: packedConversations.map(conversation => ({
        id: conversation.id,
        title: conversation.title,
        question: conversation.question,
        question_actor_id: conversation.question_actor_id,
        resolution: conversation.resolution,
        resolution_actor_id: conversation.resolution_actor_id,
        summary: conversation.summary,
        source: conversation.source,
        conversation_id: conversation.conversation_id,
        scope: conversation.scope,
        participants: conversation.participants,
        code_refs: conversation.code_refs,
        message_count: conversation.message_count,
        ended_at: conversation.ended_at,
        evidence_observation_ids: conversation.evidence_observation_ids,
        score: conversation.relevance_score,
        text: conversation.text,
      })),
      context: packed.map(it => ({
        entity: it.entity,
        text: it.text,
        scope: it.scope,
        epistemic: it.epistemic ?? null,
        confidence: it.confidence ?? null,
        score: Number(it.score.toFixed(3)),
      })),
      citations: packed.map(it => ({ entity_id: it.entity_id, entity: it.entity, scope: it.scope })),
    };
  });
}

function experienceLessonText(lesson: ApplicableExperienceLesson): string {
  return [
    `Experience lesson for ${lesson.task.title ?? lesson.task.key}: ${lesson.instruction}`,
    `Use when: ${lesson.applies_when}`,
    `Previous failure: ${lesson.failure}`,
  ].join('\n');
}

function formatObject(obj: unknown): string {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object' && 'value' in (obj as Record<string, unknown>)) {
    return String((obj as Record<string, unknown>).value);
  }
  return String(obj);
}
