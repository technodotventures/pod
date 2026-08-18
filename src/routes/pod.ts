import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AccessOperation, SessionCheckpointV1 } from 'smartware';
import {
  deriveSessionCheckpointId,
  evaluateAccess,
  SessionCheckpointValidationError,
  validateSessionCheckpoint,
} from 'smartware';
import crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ulid } from 'ulid';
import type { CoffeePodEnv } from '../config/env.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import {
  buildAskPodFallback,
  citedEvidenceSources,
  generateAskPodAnswer,
  numberEvidenceSources,
  type AskPodEvidenceSource,
  type AskPodFallbackKind,
} from '../services/ask-pod.js';
import {
  AIProviderRequestError,
  type AIProviderFailureReason,
} from '../services/ai-provider.js';
import {
  askPodConflictEvidence,
  buildAskPodConflictAnswer,
  groupAskPodConflicts,
  type AskPodConflict,
} from '../services/ask-pod-conflicts.js';
import { classifyAskPodIntent } from '../services/ask-pod-intent.js';
import {
  expandTextAroundMatch,
  reciprocalRankFuseEvidenceCandidates,
  selectDiverseEvidenceCandidates,
  type RetrievalEvidenceCandidate,
} from '../services/retrieval-evidence.js';
import {
  meaningfulSearchTerms,
  parseTemporalHint,
  podObjectTemporalInterval,
  searchPodObjects,
} from '../services/ask-pod-search.js';
import {
  filterSelfProfileByScopes,
  observationMayAffectProfile,
  readSelfProfile,
  reflectSelfProfile,
} from '../services/profile-anchor.js';
import {
  compileExperienceProjection,
  findApplicableLessons,
  listExperienceLessons,
  parseExperienceEvent,
  validateExperienceEventContent,
} from '../services/experience-memory.js';
import { readDreamCadence, runPodDreamCycle, runPodDreamCycleAcrossScopes } from '../services/dream-cycle.js';
import { resolveObservationDefaults, resolveReflectionModelUse } from '../services/memory-settings.js';
import {
  readReflectionCadence,
  runPodReflectionCycle,
  updateReflectionCadenceAfterRun,
} from '../services/reflection-cycle.js';
import {
  evaluateSmartwareHybridRecall,
  readRetrievalSettings,
  shouldUseSemanticFallback,
  type HybridClaimMatch,
  type HybridRecallEvaluation,
} from '../services/semantic-retrieval.js';
import {
  compileConversationProjection,
  findConversationEvidence,
  parseConversationMessage,
  readConversationProjection,
} from '../services/conversation-memory.js';
import { findDemonstratedExpertise } from '../services/expertise-memory.js';
import { requireActorAuth, requireOwnerAuth } from '../security/auth.js';
import type { PodAccessBody, PodActivityQuery, PodAgentActionBody, PodAgentActionReviewBody, PodApprovalQuery, PodObserveBody, PodQueryBody, PodQueryContext, PodRecallBody, PodReflectBody, PodDreamBody, PodReviseBody, PodScopeAlias, PodSessionCheckpointBody, PodSessionEndBody, PodSessionStartBody, PodExplainBody, PodCorrectBody, PodForgetBody, PodReadBody } from '../pod/types.js';

interface ReviseRelationInput {
  kind: 'supports' | 'contradicts' | 'supersedes' | 'corrects' | 'invalidates' | 'summarizes' | 'references';
  target: string;
  valid_at: string;
  provenance: { origin: 'user'; target_claim_version: number };
}
import type { PodObject } from '../pod/db.js';
import { DEFAULT_WORKSPACE_ID, deleteCollection, deleteObject, getAgent, getDb, getEvent, getObject, getObservationIdempotency, insertEvent, insertEventIfFresh, listObjects, patchObject, resolveConflictEvents, saveObservationIdempotency } from '../pod/db.js';
import {
  agentAllowedScopeNames,
  agentCanAccessResolvedScope,
  type AgentAccessOperation,
} from '../pod/agent-access.js';
import type { CoffeePodProfile } from '../pod/data-spaces.js';
import { searchExternalMcpContext } from '@technodotventures/smartware-connectors';
import {
  ConflictError as OperationConflictError,
  OperationIdFormatError,
  wrapMutation,
} from '../services/operations-log.js';
import {
  commitEndorsement,
  dryRunEndorsement,
} from '../services/endorsement.js';
import {
  validateObserve,
  validateRecall,
  validateRevise,
} from '../services/schema-gateway.js';
import { ensureWorkspaceScope, requestWorkspaceId } from './workspaces.js';

const actorSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['person', 'agent', 'system'] },
    id: { type: 'string' },
    display_name: { type: 'string' },
  },
  required: ['type', 'id', 'display_name'],
} as const;

function resolveScope(profile: CoffeePodProfile, scope?: string, alias?: PodScopeAlias, workspaceScope = profile.scopes.workspace): string {
  if (scope) {
    // If the scope is a known alias name, resolve it to the full scope ID
    if (scope === 'workspace') return workspaceScope;
    if (scope in profile.scopes) return profile.scopes[scope as PodScopeAlias];
    return scope;
  }
  if (!alias || alias === 'workspace') return workspaceScope;
  return profile.scopes[alias] ?? workspaceScope;
}

function inferContentFormat(content: string | object, explicit?: PodObserveBody['content_format']): 'text/markdown' | 'text/plain' | 'application/json' {
  if (explicit) return explicit;
  return typeof content === 'string' ? 'text/plain' : 'application/json';
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function conflictFromActivityContent(content: unknown): AskPodConflict | null {
  const candidate = asRecord(asRecord(content)['conflict']);
  const claims = candidate['claims'];
  if (
    typeof candidate['id'] !== 'string'
    || typeof candidate['subject_id'] !== 'string'
    || typeof candidate['subject_name'] !== 'string'
    || typeof candidate['predicate'] !== 'string'
    || typeof candidate['scope'] !== 'string'
    || !Array.isArray(claims)
    || claims.length < 2
  ) {
    return null;
  }
  return candidate as unknown as AskPodConflict;
}

function displayConflictValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// Spec error envelope per Protocol Contract v0.4.1. Use this for any
// spec-conformant rejection (operation_id format, conflict, invalid_payload).
function specError(
  reply: import('fastify').FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): unknown {
  return reply.code(status).send({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}

// Translate operations-log thrown errors into the spec envelope. Returns
// `true` if the response was sent; the handler should return immediately.
function handleOperationError(
  reply: import('fastify').FastifyReply,
  err: unknown,
): boolean {
  if (err instanceof OperationIdFormatError) {
    specError(reply, 400, 'invalid_payload', err.message, { received: err.received });
    return true;
  }
  if (err instanceof OperationConflictError) {
    specError(
      reply,
      409,
      'conflict',
      `operation_id was previously seen with a different payload`,
      { operation_id: err.operation_id },
    );
    return true;
  }
  const protocolError = err as { name?: string; code?: string; message?: string };
  if (protocolError?.name === 'ProtocolError' && protocolError.code) {
    const forbiddenCodes = new Set([
      'user_required',
      'protected_claim',
      'owner_required',
      'actor_unregistered',
      'insufficient_permission',
    ]);
    if (forbiddenCodes.has(protocolError.code)) {
      specError(reply, 403, 'forbidden', protocolError.message ?? 'Operation is not permitted', {
        substrate_code: protocolError.code,
      });
      return true;
    }
    if (protocolError.code === 'claim_not_found' || protocolError.code === 'not_found') {
      specError(reply, 404, 'not_found', protocolError.message ?? 'Target was not found');
      return true;
    }
    if (protocolError.code === 'conflict') {
      specError(reply, 409, 'conflict', protocolError.message ?? 'Operation conflicted with current state');
      return true;
    }
  }
  return false;
}

function hashObservePayload(body: PodObserveBody): string {
  return crypto.createHash('sha256').update(JSON.stringify({
    type: body.type ?? 'message',
    scope: body.scope ?? body.scope_alias ?? 'workspace',
    content: body.content,
    content_format: body.content_format ?? null,
    visibility: body.visibility ?? 'scope',
    source_id: body.source_id ?? null,
    informed_by: body.informed_by ?? [],
    sensitive: body.sensitive ?? false,
    pod_object_id: body.pod_object_id ?? null,
    pod_object_version: body.pod_object_version ?? null,
    pod_object_hash: body.pod_object_hash ?? null,
    observed_excerpt_hash: body.observed_excerpt_hash ?? null,
  })).digest('hex');
}

interface NormalizedQueryContext {
  objectIds: string[];
  entityIds: string[];
  labels: string[];
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
}

type QuerySource = AskPodEvidenceSource;
type UnnumberedQuerySource = RetrievalEvidenceCandidate;

interface QueryStep {
  id: string;
  label: string;
  status: 'done' | 'error' | 'skipped';
  count?: number;
}

interface QueryResultPayload {
  results: Awaited<ReturnType<Awaited<ReturnType<typeof getSmartwareCore>>['query']>>['results'];
  observations: ReturnType<Awaited<ReturnType<typeof getSmartwareCore>>['searchObservations']>;
  external_context: Awaited<ReturnType<typeof searchExternalMcpContext>>;
  sources: QuerySource[];
  evidence: QuerySource[];
  citations: QuerySource[];
  steps: QueryStep[];
  answer?: string;
  answer_mode?: 'model' | AskPodFallbackKind;
  answer_status?: 'not_requested' | 'ok' | 'unavailable' | 'error';
  answer_provider?: string;
  answer_model?: string;
  retrieval?: Record<string, unknown>;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function normalizeQueryContext(context?: PodQueryContext): NormalizedQueryContext {
  const nodeIds = context?.node_ids ?? [];
  const objectIds = uniqueStrings([
    ...(context?.object_ids ?? []),
    ...nodeIds.filter((id) => id.startsWith('obj:')).map((id) => id.slice(4)),
  ]);
  const entityIds = uniqueStrings([
    ...(context?.entity_ids ?? []),
    ...nodeIds.filter((id) => id.startsWith('sw:')).map((id) => id.slice(3)),
  ]);
  return {
    objectIds,
    entityIds,
    labels: uniqueStrings(context?.labels ?? []).slice(0, 20),
    edges: (context?.edges ?? []).slice(0, 40),
  };
}

function objectContentText(object: PodObject): string | undefined {
  if (typeof object.content === 'string') return object.content;
  if (object.content && typeof object.content === 'object') {
    const record = object.content as Record<string, unknown>;
    for (const key of ['text', 'body', 'notes', 'description', 'summary']) {
      if (typeof record[key] === 'string' && record[key].trim()) return record[key];
    }
  }
  return undefined;
}

function objectSnippet(object: PodObject): string | undefined {
  if (object.summary) return object.summary.slice(0, 240);
  const content = objectContentText(object);
  if (content) return content.slice(0, 240);
  return undefined;
}

function sourceFromObject(
  object: PodObject,
  query?: string,
  retriever = 'library_fts',
  observationIds: string[] = [],
): UnnumberedQuerySource {
  const content = objectContentText(object);
  const expanded = content && query ? expandTextAroundMatch(content, query) : null;
  const temporal = podObjectTemporalInterval(object);
  return {
    id: `object:${object.id}`,
    type: 'object',
    title: object.title,
    snippet: expanded?.text || objectSnippet(object),
    object_id: object.id,
    source_app: object.source_app ?? undefined,
    source_external_id: object.source_external_id ?? undefined,
    url: object.source_url ?? undefined,
    observation_ids: observationIds,
    ...(temporal && temporal.basis !== 'recorded_time' ? {
      valid_at: temporal.start,
      invalid_at: temporal.end,
      recorded_at: object.created_at,
      temporal_basis: temporal.basis,
    } : {
      recorded_at: object.created_at,
      temporal_basis: 'recorded_time' as const,
    }),
    context_before: expanded?.before ?? [],
    context_after: expanded?.after ?? [],
    retrievers: [retriever],
    resolver: { method: 'GET', path: `/pod/objects/${encodeURIComponent(object.id)}` },
  };
}

function queryToText(query: string | object): string {
  return typeof query === 'string' ? query : JSON.stringify(query);
}

function depthToLimit(depth?: PodRecallBody['depth'], maxResults?: number): number | undefined {
  if (maxResults) return maxResults;
  if (depth === 'oneline') return 3;
  if (depth === 'paragraph') return 10;
  return undefined;
}

function confidenceBucketThreshold(value?: 'high' | 'medium' | 'low'): number | undefined {
  if (value === 'high') return 0.7;
  if (value === 'medium') return 0.4;
  if (value === 'low') return 0;
  return undefined;
}

async function writeRecallFile(env: CoffeePodEnv, payload: QueryResultPayload): Promise<string> {
  const dir = path.join(env.dataDir, 'recall');
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `recall_${new Date().toISOString().replace(/[:.]/g, '-')}_${ulid()}.json`);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

export async function registerPodRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);

  function selfProfileKnowledge(
    core: Awaited<ReturnType<typeof getSmartwareCore>>,
    profile: CoffeePodProfile,
  ) {
    return core.readKnowledgeGraph({
      actor: { type: 'person', id: 'person-local', display_name: 'Pod owner' },
      scopes: Object.values(profile.scopes),
    });
  }

  async function refreshSelfProfileAfterObservation(
    core: Awaited<ReturnType<typeof getSmartwareCore>>,
    profile: CoffeePodProfile,
    type: string | undefined,
    content: unknown,
  ): Promise<void> {
    if (!observationMayAffectProfile(type, content)) return;
    try {
      await reflectSelfProfile(env, profile, selfProfileKnowledge(core, profile));
    } catch (error) {
      app.log.warn({ error }, 'failed to refresh Self profile after observation');
    }
  }

  async function refreshExperienceAfterObservation(
    scope: string,
    content: unknown,
    receipt?: { actorId: string; observationId: string },
  ): Promise<void> {
    const experienceEvent = parseExperienceEvent(content);
    if (!experienceEvent) return;
    try {
      const projection = await compileExperienceProjection(env, scope);
      if (!receipt) return;
      const relatedLessons = projection.lessons.filter(lesson =>
        lesson.evidence_observation_ids.includes(receipt.observationId));
      const attempt = experienceEvent.attempt;
      if (experienceEvent.event === 'attempt_finished'
        && attempt?.status === 'success'
        && attempt.applied_lesson_ids.length > 0
        && relatedLessons.some(lesson => attempt.applied_lesson_ids.includes(lesson.id))) {
        insertEventIfFresh(db, {
          type: 'learning_applied',
          process: 'learn',
          actor_id: receipt.actorId,
          scope,
          title: 'A previous lesson helped this run',
          detail: `${attempt.applied_lesson_ids.length} lesson${attempt.applied_lesson_ids.length === 1 ? '' : 's'} applied · ${attempt.summary}`,
          content: {
            attempt_id: attempt.id,
            lesson_ids: attempt.applied_lesson_ids,
            status: 'success',
            observation_id: receipt.observationId,
          },
        });
      } else if (relatedLessons.length > 0) {
        insertEventIfFresh(db, {
          type: 'lesson_candidate_created',
          process: 'learn',
          actor_id: receipt.actorId,
          scope,
          title: 'Pod learned a possible better approach',
          detail: relatedLessons[0]!.instruction,
          content: {
            lesson_ids: relatedLessons.map(lesson => lesson.id),
            origins: [...new Set(relatedLessons.map(lesson => lesson.origin))],
            observation_id: receipt.observationId,
          },
        });
      }
    } catch (error) {
      app.log.warn({ error, scope }, 'failed to refresh experience lessons');
    }
  }

  async function refreshConversationAfterObservation(scope: string, content: unknown): Promise<void> {
    if (!parseConversationMessage(content)) return;
    try {
      await compileConversationProjection(env, scope);
    } catch (error) {
      app.log.warn({ error, scope }, 'failed to refresh conversation projection');
    }
  }

  async function refreshExperienceScopes(scopes: string[]): Promise<void> {
    try {
      await Promise.all([...new Set(scopes)].map(scope => compileExperienceProjection(env, scope)));
    } catch (error) {
      app.log.warn({ error, scopes }, 'failed to refresh experience lessons');
    }
  }

  async function refreshConversationScopes(scopes: string[]): Promise<void> {
    try {
      await Promise.all([...new Set(scopes)].map(scope => compileConversationProjection(env, scope)));
    } catch (error) {
      app.log.warn({ error, scopes }, 'failed to refresh conversation projections');
    }
  }

  function recordActivity(input: Parameters<typeof insertEvent>[1]): void {
    try {
      insertEvent(db, input);
    } catch (error) {
      app.log.warn({ error, process: input.process, type: input.type }, 'failed to record Pod activity event');
    }
  }

  function requireAgentScope(
    profile: CoffeePodProfile,
    actorId: string,
    resolvedScope: string,
    operation: AgentAccessOperation,
    reply: FastifyReply,
  ): boolean {
    const agent = getAgent(db, actorId);
    if (!agent || agentCanAccessResolvedScope(agent, operation, profile, resolvedScope)) return true;
    const allowed = agentAllowedScopeNames(agent, operation, Object.keys(profile.scopes));
    reply.code(403).send({
      error: 'no_scope_access',
      message: operation === 'read'
        ? `Agent "${agent.name}" cannot read this memory area.`
        : `Agent "${agent.name}" cannot add memory to this area.`,
      access_mode: agent.access_mode,
      allowed_scopes: allowed,
    });
    return false;
  }

  async function runPodQuery(request: FastifyRequest, reply: FastifyReply, body: PodQueryBody): Promise<QueryResultPayload | undefined> {
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const workspaceId = requestWorkspaceId(request);
    const workspaceScope = ensureWorkspaceScope(core, env, workspaceId);
    const actor = { type: 'agent' as const, id: body.actor_id, display_name: body.actor_display_name ?? body.actor_id };
    const registeredAgent = getAgent(db, body.actor_id);
    const allScopeNames = Object.keys(profile.scopes);
    const defaultReadScope = registeredAgent && registeredAgent.access_mode !== 'all' && !body.scope && !body.scope_alias
      ? agentAllowedScopeNames(registeredAgent, 'read', allScopeNames)[0]
      : undefined;
    const requestsAllScopes = body.scope === 'all' || body.scope_alias === 'all';
    const allowedScopeNames = registeredAgent
      ? agentAllowedScopeNames(registeredAgent, 'read', allScopeNames)
      : allScopeNames;
    const scopeIds = requestsAllScopes
      ? registeredAgent
        ? [...new Set(
            allowedScopeNames
              .filter(name => workspaceId === DEFAULT_WORKSPACE_ID || name === 'personal' || name === 'workspace')
              .map(name => name === 'workspace' ? workspaceScope : profile.scopes[name])
              .filter(Boolean),
          )]
        : [...new Set(
            workspaceId === DEFAULT_WORKSPACE_ID
              ? Object.values(profile.scopes)
              : [profile.scopes.personal, workspaceScope],
          )]
      : [defaultReadScope
          ? (defaultReadScope === 'workspace' ? workspaceScope : profile.scopes[defaultReadScope])
          : resolveScope(profile, body.scope, body.scope_alias, workspaceScope)];
    if (scopeIds.length === 0) {
      reply.code(403).send({ error: 'no_scope_access', message: 'No readable memory area is available for this query.' });
      return;
    }
    for (const scopeId of scopeIds) {
      if (!requireAgentScope(profile, body.actor_id, scopeId, 'read', reply)) return;
    }
    const primaryScope = scopeIds[0]!;
    const queryIntent = classifyAskPodIntent(body.query);
    if (queryIntent === 'conflict_status') {
      const conflicts = groupAskPodConflicts(core.readConflicts({
        actor,
        scopes: scopeIds,
        include_sensitive: body.include_sensitive,
      }).claims);
      const sources = numberEvidenceSources(askPodConflictEvidence(conflicts));
      const markersByClaimId = new Map(sources.flatMap(source =>
        source.claim_id ? [[source.claim_id, source.marker] as const] : []));
      const answerText = body.use_llm
        ? buildAskPodConflictAnswer(conflicts, markersByClaimId)
        : undefined;
      const citations = answerText ? citedEvidenceSources(answerText, sources) : [];
      const steps: QueryStep[] = [
        {
          id: 'conflicts',
          label: 'Check conflicting memories',
          status: 'done',
          count: conflicts.length,
        },
        ...(body.use_llm ? [{
          id: 'answer',
          label: conflicts.length > 0 ? 'Summarize conflicts' : 'Confirm conflict status',
          status: 'done' as const,
          count: citations.length,
        }] : []),
      ];
      const payload = {
        results: [],
        total_found: conflicts.length,
        filtered_out: 0,
        query_scope: scopeIds.length === 1 ? primaryScope : 'all',
        observations: [],
        conversations: [],
        experts: [],
        conflicts,
        external_context: [],
        sources,
        evidence: sources,
        citations,
        steps,
        answer: answerText,
        answer_mode: body.use_llm ? 'conflict' as const : undefined,
        answer_status: body.use_llm ? 'ok' as const : 'not_requested' as const,
      };
      const eventScope = scopeIds.length === 1 ? primaryScope.replace(/^pod\/[^/]+\//, '') : 'all';
      for (const conflict of conflicts) {
        insertEventIfFresh(db, {
          workspace_id: workspaceId,
          type: 'memory_conflict_detected',
          process: 'recall',
          actor_id: body.actor_id,
          scope: eventScope,
          title: `${conflict.subject_name} · ${conflict.predicate.replace(/_/g, ' ')}`,
          detail: `${conflict.claims.length} memories disagree`,
          content: { conflict },
          requires_attention: true,
          severity: 'warning',
          attention_reason: 'Choose what Pod should treat as current',
          attention_action_label: 'Review conflict',
          attention_action: 'conflict',
        });
      }
      recordActivity({
        workspace_id: workspaceId,
        type: 'recall_completed',
        process: 'recall',
        actor_id: body.actor_id,
        scope: eventScope,
        title: 'Checked memory consistency',
        detail: `${conflicts.length} unresolved conflict${conflicts.length === 1 ? '' : 's'} found`,
        content: { query: body.query, conflict_count: conflicts.length },
      });
      return payload;
    }
    const normalizedContext = normalizeQueryContext(body.context);
    // Raw Pod objects do not yet carry the same scope policy as Smartware
    // memory. Exclude that owner-facing library seam for named agents rather
    // than let it bypass the selected memory access preset.
    const selectedObjects = registeredAgent
      ? []
      : normalizedContext.objectIds
        .map((objectId) => getObject(db, objectId))
        .filter((object): object is PodObject => Boolean(object && object.workspace_id === workspaceId));
    const previousUserQuery = [...(body.history ?? [])]
      .reverse()
      .find(turn => turn.role === 'user')
      ?.content;
    const conversationQuery = uniqueStrings([previousUserQuery, body.query]).join(' ');
    const retrievalQuery = uniqueStrings([conversationQuery, ...normalizedContext.labels]).join(' ');
    // Valid-time intent must enter every retrieval channel before ranking.
    // Explicit UI bounds win over natural-language phrases.
    const temporal = body.date_start
      ? {
          start: body.date_start,
          end: body.date_end ?? new Date().toISOString(),
          label: body.timeframe_label ?? 'selected range',
        }
      : parseTemporalHint(body.query);
    const temporalConstraint = temporal
      ? {
          mode: 'range' as const,
          axis: 'valid_time' as const,
          relation: 'overlaps' as const,
          from: temporal.start,
          to: temporal.end,
        }
      : undefined;
    const profileFastPath = queryIntent === 'profile'
      && !body.context
      && !temporal
      && !body.include_external_mcp;
    const smartwareQuery = temporal
      ? meaningfulSearchTerms(retrievalQuery, temporal).join(' ')
      : retrievalQuery;
    const claimSets = await Promise.all((profileFastPath ? [] : scopeIds).map(scope => core.query({
        actor,
        query: smartwareQuery,
        scope,
        limit: body.limit,
        include_sensitive: body.include_sensitive,
        min_confidence: body.min_confidence,
        temporal: temporalConstraint,
      })));
    const claims = {
      results: claimSets
        .flatMap(result => result.results)
        .sort((a, b) => b.score - a.score)
        .slice(0, body.limit ?? 10),
      total_found: claimSets.reduce((count, result) => count + result.total_found, 0),
      filtered_out: claimSets.reduce((count, result) => count + result.filtered_out, 0),
      query_scope: scopeIds.length === 1 ? primaryScope : 'all',
    };
    const retrievalSettings = readRetrievalSettings(db);
    let semanticStatus: 'skipped' | 'unavailable' | 'ok' | 'error' = 'skipped';
    let semanticModel: string | null = null;
    let semanticMatches: HybridClaimMatch[] = [];
    const semanticMatchScores = new Map<string, number>();
    const hybridEvaluations: HybridRecallEvaluation[] = [];
    const useSemanticFallback = shouldUseSemanticFallback(
      claims.results,
      retrievalSettings,
    );
    const evaluateHybrid = retrievalSettings.semantic_mode === 'shadow'
      || useSemanticFallback;
    if (smartwareQuery && evaluateHybrid) {
      for (const scope of scopeIds) {
        const evaluation = await evaluateSmartwareHybridRecall(
          env,
          db,
          core,
          {
            actor,
            query: smartwareQuery,
            scope,
            min_confidence: body.min_confidence,
            temporal: temporalConstraint,
          },
        );
        hybridEvaluations.push(evaluation);
        semanticModel ??= evaluation.model ?? null;
        if (evaluation.status === 'error') {
          semanticStatus = 'error';
          request.log.warn(
            { error: evaluation.error, scope },
            'Ask Pod Smartware hybrid evaluation failed',
          );
          continue;
        }
        if (evaluation.status === 'unavailable' && semanticStatus === 'skipped') {
          semanticStatus = 'unavailable';
          continue;
        }
        if (evaluation.status !== 'ok') continue;
        if (semanticStatus !== 'error') semanticStatus = 'ok';
        if (retrievalSettings.semantic_mode === 'fallback'
          && useSemanticFallback
          && evaluation.selected_channel === 'hybrid') {
          const strongest = Math.max(
            0,
            ...evaluation.matches.map(match => match.rrf_score),
          );
          for (const match of evaluation.matches) {
            semanticMatchScores.set(
              match.claim_id,
              strongest > 0 ? match.rrf_score / strongest : 0,
            );
          }
          semanticMatches.push(...evaluation.matches);
        }
      }
    }
    const hybridOverlap = hybridEvaluations
      .reduce((total, evaluation) => total + evaluation.comparison.overlap_count, 0);
    const hybridTop1Comparable = hybridEvaluations
      .filter(evaluation => evaluation.comparison.top1_agreement !== null);
    const hybridTop1Agreements = hybridTop1Comparable
      .filter(evaluation => evaluation.comparison.top1_agreement === true).length;
    const hybridSelections = hybridEvaluations
      .filter(evaluation => evaluation.selected_channel === 'hybrid').length;
    const observationQuery = meaningfulSearchTerms(retrievalQuery, temporal).join(' ');
    let observations = body.include_observations === false || profileFastPath
      ? []
      : scopeIds.flatMap(scope => core.searchObservations(observationQuery, scope, {
          limit: body.limit ?? 10,
          includeSensitive: body.include_sensitive,
          ...(temporal ? {
            temporalRange: { from: temporal.start, to: temporal.end },
          } : {}),
        })).sort((a, b) => b.observed_at.localeCompare(a.observed_at));
    observations = observations.slice(0, body.limit ?? 10);

    // Pod.db library search — calendar events, journal entries, wiki rows,
    // file uploads. Distinct from Smartware L0/L1.
    const podObjectMatches = registeredAgent || profileFastPath
      ? []
      : searchPodObjects(db, body.query, {
        workspaceId,
        limit: 20,
        temporalRange: temporal,
      });
    // External connector results have their own grant model and are not
    // labelled with Pod memory areas. Do not fold them into a named agent's
    // scoped memory response.
    const externalContext = body.include_external_mcp && !registeredAgent && !profileFastPath
      ? await searchExternalMcpContext(env, retrievalQuery).catch((e) => {
          request.log.warn(e, 'external MCP context search failed');
          return [];
        })
      : [];
    const conversationMatches = profileFastPath ? [] : await findConversationEvidence(env, scopeIds, retrievalQuery, 8).catch((error) => {
      request.log.warn({ error }, 'Ask Pod conversation lookup failed');
      return [];
    });
    const expertiseMatches = queryIntent === 'expertise'
      ? await findDemonstratedExpertise(env, scopeIds, retrievalQuery, 3).catch((error) => {
          request.log.warn({ error }, 'Ask Pod expertise lookup failed');
          return [];
        })
      : [];
    const singletonObservationIdByObjectId = new Map<string, string>();
    for (const conversation of conversationMatches) {
      if (conversation.evidence_observation_ids.length !== 1) continue;
      const observationId = conversation.evidence_observation_ids[0]!;
      const evidence = core.readObservationEvidence({
        actor,
        observation_id: observationId,
        include_sensitive: body.include_sensitive,
      });
      if (evidence?.source_id) {
        singletonObservationIdByObjectId.set(evidence.source_id, observationId);
      }
    }
    const objectBackedObservationIds = new Set(singletonObservationIdByObjectId.values());
    const fullSelfProfile = await readSelfProfile(env, profile, selfProfileKnowledge(core, profile)).catch((error) => {
      request.log.warn({ error }, 'failed to read Self profile for Ask Pod');
      return null;
    });
    const profileViewScopeIds = registeredAgent
      ? allowedScopeNames
          .map(name => profile.scopes[name])
          .filter((scope): scope is string => Boolean(scope))
      : Object.values(profile.scopes);
    const selfProfile = fullSelfProfile
      ? filterSelfProfileByScopes(fullSelfProfile, profileViewScopeIds)
      : null;
    const evidenceCandidates: UnnumberedQuerySource[] = [
      ...(selfProfile && selfProfile.facts.length > 0 ? [{
        id: 'profile:self',
        type: 'profile' as const,
        title: 'Your profile',
        snippet: selfProfile.facts
          .map(fact => `${fact.category.toUpperCase()}: ${fact.text}`)
          .join('\n'),
        profile_id: 'self' as const,
        scope: selfProfile.scope,
        observation_ids: selfProfile.facts.flatMap(fact => fact.source_ids),
        retrievers: ['peer_card'],
        resolver: { method: 'GET' as const, path: '/pod/wiki/profile' },
      }] : []),
      ...selectedObjects.map(object => sourceFromObject(
        object,
        body.query,
        'selected_context',
        singletonObservationIdByObjectId.has(object.id)
          ? [singletonObservationIdByObjectId.get(object.id)!]
          : [],
      )),
      ...podObjectMatches.map(object => sourceFromObject(
        object,
        body.query,
        'library_fts',
        singletonObservationIdByObjectId.has(object.id)
          ? [singletonObservationIdByObjectId.get(object.id)!]
          : [],
      )),
      ...claims.results
        .filter((result) => Boolean(result.claim))
        .slice(0, 8)
        .map((result) => ({
          id: `claim:${result.claim!.id}`,
          type: 'claim' as const,
          title: result.entity_name,
          snippet: `${result.claim!.predicate}: ${typeof result.claim!.object === 'object' ? JSON.stringify(result.claim!.object) : String(result.claim!.object)}`,
          claim_id: result.claim!.id,
          entity_id: result.entity_id,
          observation_ids: result.claim!.observation_ids,
          scope: result.scope,
          score: result.score,
          confidence: result.claim!.confidence,
          valid_at: result.claim!.valid_at,
          invalid_at: result.claim!.invalid_at,
          recorded_at: result.claim!.recorded_at,
          retrievers: ['lexical'],
          resolver: { method: 'POST' as const, path: '/pod/explain' },
        })),
      ...semanticMatches.map((match) => ({
          id: `claim:${match.claim_id}`,
          type: 'claim' as const,
          title: match.entity,
          snippet: match.text,
          claim_id: match.claim_id,
          entity_id: match.entity_id,
          observation_ids: match.observation_ids,
          scope: match.scope,
          score: semanticMatchScores.get(match.claim_id) ?? 0,
          confidence: match.confidence,
          retrievers: ['hybrid'],
          resolver: { method: 'POST' as const, path: '/pod/explain' },
        })),
      ...observations.slice(0, 5).map((observation) => ({
        id: `observation:${observation.id}`,
        type: 'observation' as const,
        title: observation.snippet?.slice(0, 80) || 'Observation',
        snippet: observation.snippet,
        observation_id: observation.id,
        source_app: observation.source_app,
        source_id: observation.source_id ?? undefined,
        observed_at: observation.observed_at,
        scope: observation.scope,
        retrievers: ['lexical'],
        resolver: {
          method: 'GET' as const,
          path: `/pod/evidence/${encodeURIComponent(observation.id)}?actor_id=${encodeURIComponent(body.actor_id)}`,
        },
      })),
      ...conversationMatches.map((conversation) => ({
        id: `conversation:${conversation.id}`,
        type: 'conversation' as const,
        title: conversation.title,
        snippet: conversation.text,
        scope: conversation.scope,
        ...(conversation.evidence_observation_ids.length === 1
          && objectBackedObservationIds.has(conversation.evidence_observation_ids[0]!)
          ? {}
          : { source_group: `conversation:${conversation.source}:${conversation.conversation_id}` }),
        source_app: conversation.source,
        source_external_id: conversation.conversation_id,
        observed_at: conversation.ended_at,
        observation_ids: conversation.evidence_observation_ids,
        actor_ids: conversation.participants.map(participant => participant.actor_id),
        score: conversation.relevance_score,
        retrievers: ['conversation_projection'],
      })),
      ...externalContext.slice(0, 4).map((result, index) => ({
        id: `external:${result.server_name}:${result.tool_name}:${index}`,
        type: 'external' as const,
        title: `${result.server_name}: ${result.title}`,
        snippet: result.text.slice(0, 1200),
        source_app: result.server_name,
        retrievers: ['external_mcp'],
        server_name: result.server_name,
        tool_name: result.tool_name,
      })),
    ];
    const sources = numberEvidenceSources(selectDiverseEvidenceCandidates(
      reciprocalRankFuseEvidenceCandidates(evidenceCandidates), {
      limit: 32,
      maxPerSourceApp: 6,
      maxPerType: {
        profile: 1,
        object: 12,
        claim: 8,
        observation: 5,
        conversation: 5,
        external: 4,
      },
    }));
    const evidenceTokenEstimate = sources.reduce((total, source) =>
      total + Math.ceil(`${source.title}\n${source.snippet ?? ''}`.length / 4), 0);
    let answer = null as Awaited<ReturnType<typeof generateAskPodAnswer>>;
    let answerStatus: QueryResultPayload['answer_status'] = 'not_requested';
    let providerFailureReason: AIProviderFailureReason | undefined;
    if (body.use_llm) {
      try {
        answer = await generateAskPodAnswer(env, {
          query: body.query,
          history: body.history,
          sources,
          selectedContext: body.context,
          temporalLabel: temporal?.label ?? null,
          mode: body.model_mode ?? 'auto',
        });
        answerStatus = answer ? 'ok' : 'unavailable';
      } catch (error) {
        answerStatus = 'error';
        providerFailureReason = error instanceof AIProviderRequestError
          ? error.reason
          : 'provider_error';
        request.log.error(error, 'ask-pod LLM error');
      }
    }
    const fallback = body.use_llm && !answer
      ? buildAskPodFallback({
          query: conversationQuery,
          sources,
          scopeIsAll: requestsAllScopes,
          temporalLabel: temporal?.label ?? null,
          hasSelectedContext: Boolean(body.context),
          providerStatus: answerStatus === 'error' ? 'error' : 'unavailable',
          providerFailureReason,
        })
      : null;
    const answerText = answer?.answer ?? fallback?.answer;
    const answerMode: QueryResultPayload['answer_mode'] = answer ? 'model' : fallback?.kind;
    const citations = answerText ? citedEvidenceSources(answerText, sources) : [];
    const steps: QueryStep[] = [
      ...(body.context ? [{
        id: 'context',
        label: body.context.kind === 'map_selection' ? 'Read selected graph' : 'Read selected context',
        status: 'done' as const,
        count: selectedObjects.length + normalizedContext.entityIds.length + normalizedContext.labels.length,
      }] : []),
      ...(temporal ? [{
        id: 'temporal',
        label: `Detected time window · ${temporal.label}`,
        status: 'done' as const,
        count: 0,
      }] : []),
      ...(selfProfile && selfProfile.facts.length > 0 ? [{
        id: 'profile',
        label: 'Read your profile',
        status: 'done' as const,
        count: selfProfile.facts.length,
      }] : []),
      ...(!profileFastPath ? [{ id: 'memory', label: 'Search memories', status: 'done' as const, count: claims.results.length }] : []),
      ...(retrievalSettings.semantic_mode === 'fallback' ? [{
        id: 'semantic',
        label: 'Search memory by meaning',
        status: semanticStatus === 'error' ? 'error' : semanticStatus === 'skipped' || semanticStatus === 'unavailable' ? 'skipped' : 'done',
        count: semanticMatches.length,
      } as QueryStep] : []),
      ...(!profileFastPath ? [{ id: 'observations', label: 'Search observations', status: body.include_observations === false ? 'skipped' as const : 'done' as const, count: observations.length }] : []),
      ...(!profileFastPath ? [{ id: 'conversations', label: 'Search conversations', status: 'done' as const, count: conversationMatches.length }] : []),
      ...(queryIntent === 'expertise'
        ? [{ id: 'expertise', label: 'Find demonstrated expertise', status: 'done' as const, count: expertiseMatches.length }]
        : []),
      ...(!profileFastPath ? [{ id: 'pod_docs', label: 'Search docs', status: 'done' as const, count: podObjectMatches.length }] : []),
      ...(!profileFastPath ? [{ id: 'external', label: 'Search connected docs', status: body.include_external_mcp && !registeredAgent ? 'done' as const : 'skipped' as const, count: externalContext.length }] : []),
      ...(body.use_llm ? [{
        id: 'answer',
        label: answer
          ? 'Compose an answer'
          : fallback?.kind === 'no_evidence'
            ? 'Prepare a useful next step'
            : fallback?.kind === 'synthesis_unavailable'
              ? 'Explain why the summary stopped'
            : 'Answer from your Pod',
        status: 'done' as const,
        count: citations.length,
      }] : []),
    ];
    const payload = {
      ...claims,
      observations,
      conversations: conversationMatches,
      experts: expertiseMatches,
      external_context: externalContext,
      sources,
      evidence: sources,
      retrieval: {
        strategy: profileFastPath ? 'profile_fast_path' : 'staged',
        scopes_searched: scopeIds.length,
        token_estimate: evidenceTokenEstimate,
        model: {
          invoked: Boolean(body.use_llm),
          mode: body.use_llm ? body.model_mode ?? 'auto' : null,
        },
        stages: [
          { id: 'profile', executed: Boolean(selfProfile?.facts.length), candidates: selfProfile?.facts.length ?? 0 },
          { id: 'claims', executed: !profileFastPath, candidates: claims.results.length },
          { id: 'observations', executed: !profileFastPath && body.include_observations !== false, candidates: observations.length },
          { id: 'conversations', executed: !profileFastPath, candidates: conversationMatches.length },
          { id: 'objects', executed: !profileFastPath && !registeredAgent, candidates: podObjectMatches.length },
          { id: 'external', executed: Boolean(body.include_external_mcp && !registeredAgent && !profileFastPath), candidates: externalContext.length },
        ],
        conversation_results: conversationMatches.length,
        expertise_results: expertiseMatches.length,
        semantic: {
          mode: retrievalSettings.semantic_mode,
          status: semanticStatus,
          model: semanticModel,
          results: semanticMatches.length,
          shadow_scopes: hybridEvaluations.length,
          selected_hybrid_scopes: hybridSelections,
          applied: semanticMatches.length > 0,
          overlap: hybridOverlap,
          top1_agreement_rate: hybridTop1Comparable.length > 0
            ? hybridTop1Agreements / hybridTop1Comparable.length
            : null,
        },
      },
      citations,
      steps,
      answer: answerText,
      answer_mode: answerMode,
      answer_status: answerStatus,
      answer_provider: answer?.provider,
      answer_model: answer?.model,
    };
    recordActivity({
      workspace_id: workspaceId,
      type: 'recall_completed',
      process: 'recall',
      actor_id: body.actor_id,
      scope: scopeIds.length === 1 ? primaryScope.replace(/^pod\/[^/]+\//, '') : 'all',
      title: `Recalled: ${body.query.slice(0, 100)}`,
      detail: `${sources.length} source${sources.length === 1 ? '' : 's'} found`,
      content: {
        query: body.query,
        source_count: sources.length,
        retrieval_strategy: profileFastPath ? 'profile_fast_path' : 'staged',
        scopes_searched: scopeIds.length,
        token_estimate: evidenceTokenEstimate,
        model_invoked: Boolean(body.use_llm),
      },
    });
    return payload;
  }

  app.get('/pod/capabilities', { schema: { summary: 'Describe Pod protocol capabilities' } }, async () => {
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const reflectCadence = readReflectionCadence(db);
    const dreamCadence = readDreamCadence(db);
    return {
      protocol: {
        name: 'coffee-pod',
        version: '0.1.0',
        substrate: 'smartware',
        verbs: ['OBSERVE', 'RECALL', 'REFLECT', 'WATCH', 'REVISE', 'FORGET', 'ACCESS'],
        recall: {
          cadence: 'request_driven',
          delivery_modes: ['inline', 'file_reference'],
        },
        reflect: {
          modes: ['explicit', 'autonomous'],
          targets: ['page', 'profile:self'],
          cadence: reflectCadence,
        },
        experience: {
          event_kind: 'experience_event',
          events: ['attempt_finished', 'feedback_received'],
          projection: 'source_backed_lessons',
          transfer: 'authorized_scope',
        },
        conversations: {
          event_kind: 'conversation_message',
          projection: 'source_backed_question_resolution',
          transfer: 'authorized_scope',
          canonical_messages_unchanged: true,
        },
        retrieval: {
          evidence_schema: 'normalized_v1',
          fusion: 'reciprocal_rank',
          primitives: ['search_evidence', 'search_conversations', 'who_knows'],
          answer_synthesis_required: false,
        },
        dream: {
          modes: ['manual', 'scheduled'],
          cadence: dreamCadence,
          writes: 'derived_only',
        },
      },
      pod: {
        pod_id: profile.pod_id,
        name: profile.name,
        scopes: profile.scopes,
        memory_policy: profile.memory_policy,
      },
      capabilities: {
        library: ['collections', 'objects', 'object_search'],
        memory: ['events', 'observe', 'recall', 'query', 'reflect', 'compile', 'watch', 'activity', 'read', 'explain', 'revise', 'correct', 'forget', 'access', 'experience_lessons', 'conversation_memory', 'expertise_lookup'],
        maintenance: ['dream_manual', 'dream_scheduled', 'experience_consolidation', 'conversation_consolidation'],
        sessions: ['session_start', 'session_checkpoint', 'session_end'],
        agents: ['action_propose', 'action_approve', 'action_reject', 'approvals'],
        mcp_connectors: ['external_servers', 'external_tools', 'external_context_readonly', 'retrieval_primitives'],
        coffee: ['connect', 'clients', 'client_revoke', 'sync_meetings', 'meeting_brief', 'meeting_capture'],
      },
      human_review: {
        external_actions_require_approval: true,
      },
      // Tells clients (Coffee desktop, third-party MCP) whether they need to send a
      // Bearer token to reach non-public routes. Mirrors the env.apiToken setting.
      auth: {
        api_token_required: Boolean(env.apiToken),
      },
    };
  });

  app.get('/pod/status', { schema: { summary: 'Get Pod status' } }, async (request) => {
    const core = await getSmartwareCore(env);
    const config = core.getConfig();
    const profile = getPodProfile(core, env);
    const status = await core.status(config.owner_id);
    // Paired client tokens use this endpoint as a ping, so we keep it
    // available — but the filesystem path is information a third-party app
    // doesn't need, so it's gated to the owner.
    return {
      pod: { ...profile, data_dir: config.data_dir },
      smartware: status,
    };
  });

  app.get('/pod/experience/lessons', {
    schema: {
      summary: 'List the lessons Pod has derived from agent outcomes',
      querystring: {
        type: 'object',
        properties: {
          scope: { type: 'string' },
          status: { type: 'string', enum: ['candidate', 'validated'] },
          search: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const query = request.query as {
      scope?: string;
      status?: 'candidate' | 'validated';
      search?: string;
      limit?: number | string;
    };
    const scopes = query.scope
      ? [resolveScope(profile, query.scope, query.scope)]
      : [...new Set(Object.values(profile.scopes))];
    const allLessons = await listExperienceLessons(env, scopes);
    const conversationCount = (await Promise.all(scopes.map(scope => readConversationProjection(env, scope))))
      .reduce((count, projection) => count + projection.conversations.length, 0);
    const search = query.search?.trim().toLowerCase();
    const filtered = allLessons.filter(lesson => {
      if (query.status && lesson.validation_status !== query.status) return false;
      if (!search) return true;
      return [
        lesson.task.key,
        lesson.task.title,
        lesson.task.goal,
        lesson.instruction,
        lesson.applies_when,
        lesson.failure,
        ...lesson.task.tags,
      ].filter(Boolean).join(' ').toLowerCase().includes(search);
    });
    const limit = Math.max(1, Math.min(500, Number(query.limit) || 100));
    return {
      summary: {
        total: allLessons.length,
        candidates: allLessons.filter(lesson => lesson.validation_status === 'candidate').length,
        validated: allLessons.filter(lesson => lesson.validation_status === 'validated').length,
        successful_applications: allLessons.reduce((count, lesson) => count + lesson.success_count, 0),
        failed_attempts_learned_from: allLessons.reduce((count, lesson) => count + lesson.failure_count, 0),
        conversations_indexed: conversationCount,
      },
      cadence: readDreamCadence(db),
      lessons: filtered.slice(0, limit),
    };
  });

  app.post('/pod/expertise', {
    schema: {
      summary: 'Find people or agents with demonstrated, cited expertise in the authorized memory view',
      body: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          query: { type: 'string' },
          scope: { type: 'string' },
          scopes: { type: 'array', items: { type: 'string' } },
          limit: { type: 'number' },
        },
        required: ['actor_id', 'query'],
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      actor_id: string;
      query: string;
      scope?: string;
      scopes?: string[];
      limit?: number;
    };
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const agent = getAgent(db, body.actor_id);
    const allScopeNames = Object.keys(profile.scopes);
    const allowedNames = agent
      ? agentAllowedScopeNames(agent, 'read', allScopeNames)
      : allScopeNames;
    const requested = body.scopes ?? (body.scope ? [body.scope] : allowedNames);
    const scopeIds = [...new Set(requested.flatMap(requestedScope => {
      const entry = Object.entries(profile.scopes).find(([name, id]) =>
        name === requestedScope || id === requestedScope);
      if (!entry || !allowedNames.includes(entry[0])) return [];
      return [entry[1]];
    }))];
    if (scopeIds.length === 0) {
      return reply.code(403).send({
        error: 'no_scope_access',
        message: 'No readable memory area is available for this expertise query.',
      });
    }
    const query = body.query.trim();
    if (!query) {
      return reply.code(400).send({ error: 'invalid_query', message: 'query must not be empty' });
    }
    const experts = await findDemonstratedExpertise(env, scopeIds, query, body.limit ?? 8);
    return {
      query,
      scopes_read: Object.entries(profile.scopes)
        .filter(([, id]) => scopeIds.includes(id))
        .map(([name]) => name),
      methodology: 'demonstrated_activity_only',
      experts,
      evidence: experts.flatMap(expert => expert.evidence),
    };
  });

  app.post('/pod/access', {
    schema: {
      summary: 'ACCESS policy decision for a requester, operation, and scope',
      body: {
        type: 'object',
        properties: {
          requester: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string', enum: ['person', 'agent', 'system'] },
            },
            required: ['id'],
          },
          operation: { type: 'string' },
          scope: { type: 'string' },
          target: { type: 'string' },
        },
        required: ['requester', 'operation', 'scope'],
      },
    },
  }, async (request) => {
    const body = request.body as PodAccessBody;
    const core = await getSmartwareCore(env);
    const config = core.getConfig();
    const profile = getPodProfile(core, env);
    // Map spec verb (lowercase) onto the substrate's capability keys, which
    // are the verbs the substrate already knows (observe, recall, etc.).
    const op = (body.operation || '').toLowerCase() as AccessOperation;
    const agent = getAgent(db, body.requester.id);
    const brainOperation: AgentAccessOperation = op === 'observe' || op === 'compile' ? 'write' : 'read';
    const resolvedScope = resolveScope(profile, body.scope);
    const brainAllows = !agent || agentCanAccessResolvedScope(agent, brainOperation, profile, resolvedScope);
    const decision = brainAllows
      ? evaluateAccess(body.requester.id, op, resolvedScope, config)
      : {
          decision: 'deny' as const,
          reason: `Agent access preset does not allow ${brainOperation} access to '${body.scope}'.`,
          code: 'forbidden' as const,
        };
    return {
      decision: decision.decision,
      reason: decision.reason,
      code: decision.code,
      requester: body.requester,
      operation: body.operation,
      scope: body.scope,
      target: body.target,
    };
  });

  app.post('/pod/observe', {
    schema: {
      summary: 'Write an observation into Pod memory',
      body: {
        type: 'object',
        properties: {
          actor: actorSchema,
          actor_id: { type: 'string' },
          operation_id: { type: 'string' },
          actor_display_name: { type: 'string' },
          type: { type: 'string' },
          scope: { type: 'string' },
          scope_alias: { type: 'string' },
          content_format: { type: 'string', enum: ['text/markdown', 'text/plain', 'application/json'] },
          content: {
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  format: { type: 'string', enum: ['text/markdown', 'text/plain', 'application/json'] },
                  body: {},
                },
              },
            ],
          },
          visibility: { type: 'string', enum: ['private', 'scope', 'workspace', 'public'] },
          source_id: { type: 'string' },
          informed_by: { type: 'array', items: { type: 'string' } },
          sensitive: { type: 'boolean' },
          idempotency_key: { type: 'string' },
        },
        required: ['content', 'operation_id'],
      },
    },
  }, async (request, reply) => {
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const workspaceId = requestWorkspaceId(request);
    const workspaceScope = ensureWorkspaceScope(core, env, workspaceId);
    const body = request.body as PodObserveBody & Partial<Parameters<typeof core.observe>[0]>;
    const observationDefaults = resolveObservationDefaults(db, {
      visibility: body.visibility,
      sensitive: body.sensitive,
    });
    const effectiveBody = { ...body, ...observationDefaults };
    const experienceError = validateExperienceEventContent(body.content);
    if (experienceError) {
      return reply.code(400).send({
        error: 'invalid_experience_event',
        message: experienceError,
      });
    }
    if (body.actor && body.scope && body.content && typeof body.content === 'object' && 'format' in body.content && 'body' in body.content) {
      if (!await requireActorAuth(request, reply, env, body.actor.id)) return;
      if (!requireAgentScope(profile, body.actor.id, body.scope, 'write', reply)) return;
      const specResult = await core.observe(effectiveBody as Parameters<typeof core.observe>[0]);
      await refreshSelfProfileAfterObservation(core, profile, body.type, body.content);
      await refreshExperienceAfterObservation(body.scope, body.content, {
        actorId: body.actor.id,
        observationId: specResult.id,
      });
      await refreshConversationAfterObservation(body.scope, body.content);
      try {
        const preview = typeof body.content.body === 'string' ? body.content.body.slice(0, 100) : String(body.content.body).slice(0, 100);
        insertEvent(db, {
          workspace_id: workspaceId,
          type: body.type ?? 'message',
          process: 'observe',
          actor_id: body.actor.id,
          scope: (body.scope ?? '').replace('pod/founder/', ''),
          title: `Observed: ${preview.split('\n')[0] || body.type || 'message'}`,
          detail: preview,
          source_app: 'coffee-pod',
          observation_id: specResult.id,
        });
      } catch { /* best-effort */ }
      return specResult;
    }
    const actorId = body.actor_id;
    if (!actorId) {
      throw new Error('actor_id is required');
    }
    if (!await requireActorAuth(request, reply, env, actorId)) return;

    const agent = getAgent(db, actorId);
    const defaultWriteScope = agent && agent.access_mode !== 'all' && !body.scope && !body.scope_alias
      ? agentAllowedScopeNames(agent, 'write', Object.keys(profile.scopes))[0]
      : undefined;
    const scope = defaultWriteScope
      ? (defaultWriteScope === 'workspace' ? workspaceScope : profile.scopes[defaultWriteScope as keyof typeof profile.scopes])
      : resolveScope(profile, body.scope, body.scope_alias, workspaceScope);
    if (!requireAgentScope(profile, actorId, scope, 'write', reply)) return;
    const substrateCall = () => core.observe({
      actor: { type: 'agent', id: actorId, display_name: body.actor_display_name ?? actorId },
      type: body.type ?? 'message',
      scope,
      content: { format: inferContentFormat(body.content, body.content_format), body: body.content },
      visibility: observationDefaults.visibility,
      source_id: body.source_id,
      informed_by: body.informed_by,
      sensitive: observationDefaults.sensitive,
      app: 'coffee-pod',
      // Smartware owns OBSERVE intent, recovery, and the single canonical
      // ops-log commit. Pod keeps only its compatibility result cache.
      operation_id: body.operation_id,
    });

    // Spec-conformant path: operation_id present → operations_seen cache + ops_log.
    if (body.operation_id) {
      try {
        const result = await wrapMutation(
          {
            db,
            opsDir: core.opsDir,
            operation_id: body.operation_id,
            actor_id: actorId,
            op: 'observe',
            payload: effectiveBody,
            details: { scope },
            append_ops_log: false,
          },
          async (_commit_ts) => substrateCall(),
        );
        await refreshSelfProfileAfterObservation(core, profile, body.type, body.content);
        await refreshExperienceAfterObservation(scope, body.content, {
          actorId,
          observationId: result.id,
        });
        await refreshConversationAfterObservation(scope, body.content);
        return result;
      } catch (err) {
        if (handleOperationError(reply, err)) return;
        throw err;
      }
    }

    // Legacy path: idempotency_key fallback for back-compat with existing
    // callers. Removed in PR-A7 once operation_id is required.
    if (body.idempotency_key) {
      const payloadHash = hashObservePayload(effectiveBody);
      const existing = getObservationIdempotency(db, actorId, body.idempotency_key);
      if (existing) {
        if (existing.payload_hash !== payloadHash) {
          return reply.code(409).send({
            error: 'idempotency_conflict',
            message: 'The same actor and idempotency_key were already used with a different observation payload.',
            observation_id: existing.observation_id,
          });
        }
        return { id: existing.observation_id, status: 'duplicate', existing_id: existing.observation_id, sequence: 0 };
      }
    }
    const result = await substrateCall();
    await refreshSelfProfileAfterObservation(core, profile, body.type, body.content);
    await refreshExperienceAfterObservation(scope, body.content, {
      actorId,
      observationId: result.id,
    });
    await refreshConversationAfterObservation(scope, body.content);
    if (body.idempotency_key) {
      saveObservationIdempotency(db, actorId, body.idempotency_key, hashObservePayload(effectiveBody), result.id);
    }
    try {
      const contentPreview = typeof body.content === 'string'
        ? body.content.slice(0, 100)
        : typeof body.content === 'object' && body.content !== null && 'body' in body.content
          ? String((body.content as { body: unknown }).body).slice(0, 100)
          : '';
      insertEvent(db, {
        workspace_id: workspaceId,
        type: body.type ?? 'message',
        process: 'observe',
        actor_id: actorId,
        scope: scope.replace('pod/founder/', ''),
        title: `Observed: ${contentPreview.split('\n')[0] || body.type || 'message'}`,
        detail: contentPreview,
        source_app: 'coffee-pod',
        observation_id: result.id,
      });
    } catch { /* best-effort */ }
    return result;
  });

  app.post('/pod/query', {
    schema: {
      summary: 'Query Pod memory',
      body: {
        type: 'object',
        properties: {
          actor: actorSchema,
          actor_id: { type: 'string' },
          actor_display_name: { type: 'string' },
          query: { type: 'string' },
          history: {
            type: 'array',
            maxItems: 8,
            items: {
              type: 'object',
              properties: {
                role: { type: 'string', enum: ['user', 'assistant'] },
                content: { type: 'string', maxLength: 1200 },
              },
              required: ['role', 'content'],
            },
          },
          scope: { type: 'string' },
          scope_alias: { type: 'string' },
          limit: { type: 'number' },
          include_sensitive: { type: 'boolean' },
          min_confidence: { type: 'number' },
          include_observations: { type: 'boolean' },
          use_llm: { type: 'boolean' },
          include_external_mcp: { type: 'boolean' },
          model_mode: { type: 'string', enum: ['auto', 'fast', 'deep'] },
          date_start: { type: 'string' },
          date_end: { type: 'string' },
          timeframe_label: { type: 'string' },
          context: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['map_selection', 'doc_selection', 'memory_selection'] },
              node_ids: { type: 'array', items: { type: 'string' } },
              object_ids: { type: 'array', items: { type: 'string' } },
              entity_ids: { type: 'array', items: { type: 'string' } },
              labels: { type: 'array', items: { type: 'string' } },
              edges: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    source: { type: 'string' },
                    target: { type: 'string' },
                    label: { type: 'string' },
                  },
                  required: ['id', 'source', 'target'],
                },
              },
            },
            required: ['kind'],
          },
        },
        required: ['query'],
      },
    },
  }, async (request, reply) => {
    const body = request.body as PodQueryBody & { actor?: { id: string } };
    const actorId = body.actor?.id ?? body.actor_id;
    if (!actorId) {
      throw new Error('actor_id is required');
    }
    if (!await requireActorAuth(request, reply, env, actorId)) return;
    return runPodQuery(request, reply, { ...body, actor_id: actorId });
  });

  app.post('/pod/recall', {
    schema: {
      summary: 'RECALL knowledge from compiled memory and indexed observations',
      body: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          actor_display_name: { type: 'string' },
          query: {
            oneOf: [
              { type: 'string' },
              { type: 'object' },
            ],
          },
          scope: { type: 'string' },
          scope_alias: { type: 'string' },
          depth: { type: 'string', enum: ['oneline', 'paragraph', 'full'] },
          resolution: {
            type: 'object',
            properties: {
              max_results: { type: 'number' },
              include_stale: { type: 'boolean' },
              include_forgotten: { type: 'boolean' },
              // Spec v0.1.2 wire shape: ConfidenceBucket enum, not numeric.
              // Numeric is rejected below with spec invalid_payload (RC-03).
              min_confidence: {},
            },
          },
          delivery_mode: { type: 'string', enum: ['inline', 'file_reference', 'context_bundle'] },
          peek_scopes: { type: 'array', items: { type: 'string' } },
          include_observations: { type: 'boolean' },
          include_external_mcp: { type: 'boolean' },
          use_llm: { type: 'boolean' },
          model_mode: { type: 'string', enum: ['auto', 'fast', 'deep'] },
        },
        required: ['actor_id', 'query'],
      },
    },
  }, async (request, reply) => {
    const body = request.body as PodRecallBody & { as_of?: unknown };

    // ── Spec validation gate (PR-A7 + PR-22) ───────────────────────────
    // PR-22: when spec-shape signals are present (resolution.min_confidence
    // as string, peek_scopes, etc.), run the zod gateway. The inline
    // checks below remain as belt-and-braces for the legacy non-spec
    // numeric path; zod owns the bucket-enum + as_of rejection.
    const recallValidation = validateRecall({
      query: body.query,
      scope: body.scope ?? 'self',
      depth: body.depth,
      resolution: body.resolution,
      delivery_mode: body.delivery_mode,
      peek_scopes: (body as unknown as { peek_scopes?: string[] }).peek_scopes,
      as_of: (body as unknown as { as_of?: unknown }).as_of,
    });
    if (!recallValidation.ok) {
      return specError(reply, 400, recallValidation.error.code, recallValidation.error.message, recallValidation.error.details);
    }
    // RC-11 inline back-compat: as_of is post-beta. Reject with invalid_payload.
    if ((body as { as_of?: unknown }).as_of !== undefined) {
      return specError(reply, 400, 'invalid_payload',
        'RECALL `as_of` is post-beta; not accepted in this version.',
        { path: 'as_of' });
    }
    // RC-03: min_confidence must be the ConfidenceBucket enum (Spec v0.1.2).
    // Numeric scoring is post-beta and rejected with invalid_payload.
    const mc = body.resolution?.min_confidence as unknown;
    if (mc !== undefined && typeof mc !== 'string') {
      return specError(reply, 400, 'invalid_payload',
        'RECALL `resolution.min_confidence` must be a ConfidenceBucket enum (high|medium|low). Numeric scoring is post-beta.',
        { path: 'resolution.min_confidence', received: typeof mc });
    }
    if (typeof mc === 'string' && !['high', 'medium', 'low'].includes(mc)) {
      return specError(reply, 400, 'invalid_payload',
        'RECALL `resolution.min_confidence` must be one of high|medium|low.',
        { path: 'resolution.min_confidence', received: mc });
    }

    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;

    const payload = await runPodQuery(request, reply, {
      actor_id: body.actor_id,
      actor_display_name: body.actor_display_name,
      query: queryToText(body.query),
      scope: body.scope,
      scope_alias: body.scope_alias,
      limit: depthToLimit(body.depth, body.resolution?.max_results),
      include_sensitive: false,
      min_confidence: confidenceBucketThreshold(body.resolution?.min_confidence),
      include_observations: body.include_observations,
      include_external_mcp: body.include_external_mcp,
      use_llm: body.use_llm,
      model_mode: body.model_mode,
    });
    if (!payload) return;

    const deliveryMode = body.delivery_mode ?? 'inline';
    if (deliveryMode === 'file_reference') {
      const filePath = await writeRecallFile(env, payload);
      return {
        results: [],
        provenance: payload.sources,
        delivery: { mode: 'file_reference', file_path: filePath },
      };
    }

    // PR-10 / C2: context_bundle delivery mode. Returns the spec shape
    // { seeds, outbound_relations, inbound_relations, provenance } per
    // Spec v1.5.4.2 §"Context bundle structure". 1-hop traversal via the
    // adjacency table populated in PR-4. Direction rule: source has
    // relation kind to target.
    if (deliveryMode === 'context_bundle') {
      const seeds = payload.results
        .filter((r) => r.claim?.id)
        .slice(0, 5)
        .map((r) => r.claim!);
      const dbPath = (await import('node:path')).default.join(env.dataDir, 'smartware.db');
      const { default: Database } = await import('better-sqlite3');
      const sdb = new Database(dbPath, { readonly: true });
      try {
        const outbound: Array<Record<string, unknown>> = [];
        const inbound: Array<Record<string, unknown>> = [];
        for (const seed of seeds) {
          const out = sdb
            .prepare(
              'SELECT kind, target_claim_id, valid_at, invalid_at FROM claim_relations WHERE source_claim_id = ?',
            )
            .all(seed.id) as Array<Record<string, unknown>>;
          for (const r of out) {
            outbound.push({ seed: seed.id, kind: r['kind'], target: r['target_claim_id'], valid_at: r['valid_at'], invalid_at: r['invalid_at'] });
          }
          const inn = sdb
            .prepare(
              'SELECT source_claim_id, kind, valid_at, invalid_at FROM claim_relations WHERE target_claim_id = ?',
            )
            .all(seed.id) as Array<Record<string, unknown>>;
          for (const r of inn) {
            inbound.push({ source: r['source_claim_id'], kind: r['kind'], seed: seed.id, valid_at: r['valid_at'], invalid_at: r['invalid_at'] });
          }
        }
        return {
          seeds,
          outbound_relations: outbound,
          inbound_relations: inbound,
          provenance: payload.sources,
          delivery: { mode: 'context_bundle' },
        };
      } finally {
        sdb.close();
      }
    }

    // C3 (PR-18): peek_scopes — surface hit counts for ACCESS-permitted
    // adjacent scopes. ACCESS not yet enforced per-peek-scope here;
    // future PR adds the evaluator call. For now, peek runs over the
    // SQLite claims index and returns counts only (no content leak).
    let peek_scopes: Array<{ scope: string; hit_count: number }> | undefined;
    const peekList = (body as unknown as { peek_scopes?: string[] }).peek_scopes;
    if (Array.isArray(peekList) && peekList.length > 0) {
      const { computePeekScopes } = await import('../services/plasticity.js');
      const dbPath = (await import('node:path')).default.join(env.dataDir, 'smartware.db');
      const { default: Database } = await import('better-sqlite3');
      const sdb = new Database(dbPath, { readonly: true });
      try {
        peek_scopes = computePeekScopes(sdb, queryToText(body.query), peekList);
      } finally {
        sdb.close();
      }
    }

    return {
      results: payload.results,
      provenance: payload.sources,
      delivery: { mode: 'inline' },
      observations: payload.observations,
      external_context: payload.external_context,
      sources: payload.sources,
      citations: payload.citations,
      steps: payload.steps,
      retrieval: payload.retrieval,
      peek_scopes,
      answer: payload.answer,
      answer_mode: payload.answer_mode,
      answer_status: payload.answer_status,
      answer_provider: payload.answer_provider,
      answer_model: payload.answer_model,
    };
  });

  app.get('/pod/evidence/:observationId', {
    schema: {
      summary: 'Resolve an Ask Pod observation citation to its source evidence',
      params: {
        type: 'object',
        properties: { observationId: { type: 'string' } },
        required: ['observationId'],
      },
      querystring: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          include_sensitive: { type: 'boolean' },
        },
        required: ['actor_id'],
      },
    },
  }, async (request, reply) => {
    const { observationId } = request.params as { observationId: string };
    const query = request.query as { actor_id: string; include_sensitive?: boolean | string };
    if (!await requireActorAuth(request, reply, env, query.actor_id)) return;
    const core = await getSmartwareCore(env);
    try {
      const evidence = core.readObservationEvidence({
        actor: { type: 'agent', id: query.actor_id, display_name: query.actor_id },
        observation_id: observationId,
        include_sensitive: query.include_sensitive === true || query.include_sensitive === 'true',
      });
      if (!evidence) {
        return specError(reply, 404, 'not_found', 'Observation evidence was not found or is not visible to this actor.');
      }
      const profile = getPodProfile(core, env);
      if (!requireAgentScope(profile, query.actor_id, evidence.scope, 'read', reply)) return;
      return { evidence };
    } catch (err) {
      if (handleOperationError(reply, err)) return;
      throw err;
    }
  });

  app.get('/pod/activity', {
    schema: {
      summary: 'List Pod activity events',
      querystring: {
        type: 'object',
        properties: {
          scope: { type: 'string' },
          scope_alias: { type: 'string' },
          actor_id: { type: 'string' },
          type: {
            anyOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } },
            ],
          },
          limit: { type: 'number' },
          include_sensitive: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const query = request.query as PodActivityQuery;
    const types = Array.isArray(query.type)
      ? query.type
      : query.type
        ? [query.type]
        : undefined;
    const requestedScope = query.scope || query.scope_alias
      ? resolveScope(profile, query.scope, query.scope_alias)
      : undefined;
    const authenticatedActorId = request.coffeePodAuth?.kind === 'agent'
      ? request.coffeePodAuth.actor_id
      : request.coffeePodAuth?.kind === 'client'
        ? request.coffeePodAuth.client.actor_id
        : undefined;
    const policyAgent = authenticatedActorId ? getAgent(db, authenticatedActorId) : null;
    if (policyAgent && requestedScope && !requireAgentScope(profile, policyAgent.id, requestedScope, 'read', reply)) return;
    const allowedScopeIds = policyAgent
      ? new Set(agentAllowedScopeNames(policyAgent, 'read', Object.keys(profile.scopes)).map(name => profile.scopes[name as keyof typeof profile.scopes]))
      : null;
    if (policyAgent && allowedScopeIds?.size === 0) {
      return reply.code(403).send({ error: 'no_scope_access', message: `Agent "${policyAgent.name}" cannot read memory activity.` });
    }
    const limit = query.limit ? Number(query.limit) : undefined;
    const events = core.listActivity({
      scope: requestedScope,
      types,
      actorId: query.actor_id,
      limit: allowedScopeIds && !requestedScope ? Math.max(limit ?? 50, 500) : limit,
      includeSensitive: !policyAgent && (query.include_sensitive === true || query.include_sensitive === 'true'),
    });
    return {
      events: (allowedScopeIds ? events.filter(event => allowedScopeIds.has(event.scope)) : events).slice(0, limit ?? events.length),
    };
  });

  app.post('/pod/conflicts/resolve', {
    schema: {
      summary: 'Choose the current claim in a memory conflict',
      body: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          event_id: { type: 'string' },
          selected_claim_id: { type: 'string' },
          reason: { type: 'string', minLength: 1, maxLength: 500 },
          operation_id: { type: 'string' },
        },
        required: ['actor_id', 'event_id', 'selected_claim_id', 'reason', 'operation_id'],
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const body = request.body as {
      actor_id: string;
      event_id: string;
      selected_claim_id: string;
      reason: string;
      operation_id: string;
    };
    const event = getEvent(db, body.event_id);
    if (!event) {
      return specError(reply, 404, 'not_found', 'The conflict review item no longer exists.');
    }
    const storedConflict = conflictFromActivityContent(event.content);
    if (event.type !== 'memory_conflict_detected' || !storedConflict) {
      return specError(reply, 400, 'invalid_payload', 'The selected activity item is not a resolvable memory conflict.');
    }

    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const actor = { type: 'person' as const, id: profile.owner_id, display_name: profile.owner_id };
    const liveConflicts = groupAskPodConflicts(core.readConflicts({
      actor,
      scopes: [storedConflict.scope],
      include_sensitive: true,
    }).claims);
    const liveConflict = liveConflicts.find(conflict =>
      conflict.id === storedConflict.id
      || conflict.claims.some(claim => claim.claim_id === body.selected_claim_id));

    if (!liveConflict) {
      const resolvedEventIds = resolveConflictEvents(db, storedConflict.id);
      return {
        status: 'already_resolved' as const,
        conflict_id: storedConflict.id,
        resolved_event_ids: resolvedEventIds,
      };
    }

    const selectedClaim = liveConflict.claims.find(claim => claim.claim_id === body.selected_claim_id);
    if (!selectedClaim) {
      return specError(reply, 409, 'conflict', 'This conflict changed while it was open. Review the latest options and try again.');
    }
    const supersededClaims = liveConflict.claims.filter(claim => claim.claim_id !== selectedClaim.claim_id);
    if (supersededClaims.length === 0) {
      return specError(reply, 409, 'conflict', 'There is no longer another current claim to resolve.');
    }

    try {
      const resolvedAt = new Date().toISOString();
      const result = await core.revise({
        actor,
        target: selectedClaim.claim_id,
        expected_base_version: selectedClaim.version,
        add_relations: supersededClaims.map(claim => ({
          kind: 'supersedes' as const,
          target: claim.claim_id,
          valid_at: resolvedAt,
          provenance: { origin: 'user' as const, target_claim_version: claim.version },
        })),
        reason: body.reason,
        operation_id: body.operation_id,
      });
      const resolvedEventIds = resolveConflictEvents(db, liveConflict.id, resolvedAt);
      recordActivity({
        type: 'memory_conflict_resolved',
        process: 'revise',
        actor_id: profile.owner_id,
        scope: event.scope,
        title: `${liveConflict.subject_name} updated`,
        detail: `${displayConflictValue(selectedClaim.object.value)} is now current`,
        content: {
          conflict_id: liveConflict.id,
          selected_claim_id: selectedClaim.claim_id,
          superseded_claim_ids: supersededClaims.map(claim => claim.claim_id),
          reason: body.reason,
        },
      });
      return {
        status: 'resolved' as const,
        conflict_id: liveConflict.id,
        selected_claim_id: selectedClaim.claim_id,
        superseded_claim_ids: supersededClaims.map(claim => claim.claim_id),
        resolved_event_ids: resolvedEventIds,
        revision: result,
      };
    } catch (error) {
      if (handleOperationError(reply, error)) return;
      throw error;
    }
  });

  app.get('/pod/approvals', {
    schema: {
      summary: 'List proposed agent actions awaiting review',
      querystring: {
        type: 'object',
        properties: {
          scope: { type: 'string' },
          scope_alias: { type: 'string' },
          limit: { type: 'number' },
          include_resolved: { anyOf: [{ type: 'boolean' }, { type: 'string' }] },
        },
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const query = request.query as PodApprovalQuery;
    const scope = resolveScope(profile, query.scope, query.scope_alias ?? 'workspace');
    const includeResolved = query.include_resolved === true || query.include_resolved === 'true';
    const events = core.listActivity({
      scope,
      types: ['agent_action_proposed', 'agent_action_approved', 'agent_action_rejected'],
      limit: 500,
      includeSensitive: true,
    });

    const byAction = new Map<string, {
      action_id: string;
      status: 'proposed' | 'approved' | 'rejected';
      proposed_event_id?: string;
      review_event_id?: string;
      title?: string;
      action_type?: string;
      description?: string;
      external_system?: unknown;
      payload?: unknown;
      proposed_at?: string;
      reviewed_at?: string;
      actor_id?: string;
      reviewer_id?: string;
      reason?: unknown;
    }>();

    for (const event of events.slice().reverse()) {
      const content = asRecord(event.content);
      const actionId = String(content['action_id'] ?? event.source_id ?? '');
      if (!actionId) continue;

      const existing = byAction.get(actionId) ?? { action_id: actionId, status: 'proposed' as const };
      if (event.type === 'agent_action_proposed') {
        byAction.set(actionId, {
          ...existing,
          status: existing.status ?? 'proposed',
          proposed_event_id: event.id,
          title: String(content['title'] ?? ''),
          action_type: String(content['action_type'] ?? ''),
          description: String(content['description'] ?? ''),
          external_system: content['external_system'],
          payload: content['payload'],
          proposed_at: event.observed_at,
          actor_id: event.actor_id,
        });
      } else if (event.type === 'agent_action_approved') {
        byAction.set(actionId, {
          ...existing,
          status: 'approved',
          review_event_id: event.id,
          reviewed_at: event.observed_at,
          reviewer_id: event.actor_id,
          reason: content['reason'],
        });
      } else if (event.type === 'agent_action_rejected') {
        byAction.set(actionId, {
          ...existing,
          status: 'rejected',
          review_event_id: event.id,
          reviewed_at: event.observed_at,
          reviewer_id: event.actor_id,
          reason: content['reason'],
        });
      }
    }

    const approvals = [...byAction.values()]
      .filter(action => includeResolved || action.status === 'proposed')
      .sort((a, b) => (b.proposed_at ?? '').localeCompare(a.proposed_at ?? ''))
      .slice(0, query.limit ? Number(query.limit) : 50);

    return { approvals };
  });

  app.post('/pod/compile', {
    schema: {
      summary: 'Compile Pod memory into searchable pages',
      body: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          actor_display_name: { type: 'string' },
          scope: { type: 'string' },
          scope_alias: { type: 'string' },
          use_llm: { type: 'boolean' },
          operation_id: { type: 'string' },
        },
        required: ['actor_id', 'operation_id'],
      },
    },
  }, async (request, reply) => {
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const body = request.body as { actor_id: string; operation_id: string; actor_display_name?: string; scope?: string; scope_alias?: PodScopeAlias; use_llm?: boolean };
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    const workspaceId = requestWorkspaceId(request);
    const workspaceScope = ensureWorkspaceScope(core, env, workspaceId);
    const compileScope = resolveScope(profile, body.scope, body.scope_alias, workspaceScope);
    if (!requireAgentScope(profile, body.actor_id, compileScope, 'write', reply)) return;
    const result = await wrapMutation({
      db,
      opsDir: core.opsDir,
      operation_id: body.operation_id,
      actor_id: body.actor_id,
      op: 'reflect.explicit',
      payload: body,
      append_ops_log: false,
    }, async () => core.compile({
        actor: { type: 'agent', id: body.actor_id, display_name: body.actor_display_name ?? body.actor_id },
        scope: compileScope,
        use_llm: resolveReflectionModelUse(db, body.use_llm),
        operation_id: body.operation_id,
      }));
    try {
      const { syncWikiToObjects } = await import('./wiki.js');
      syncWikiToObjects(core.wikiDir, env, workspaceId, compileScope);
    } catch { /* best-effort */ }
    if (result.claims_created > 0 || result.pages_compiled > 0) {
      try {
        insertEvent(db, {
          workspace_id: workspaceId,
          type: 'reflect',
          process: 'reflect',
          actor_id: body.actor_id,
          scope: (body.scope ?? 'personal').replace('pod/founder/', ''),
          title: `Reflected: ${result.claims_created} claims, ${result.pages_compiled} pages`,
          detail: `Claims created: ${result.claims_created}, pages compiled: ${result.pages_compiled}`,
          source_app: 'smartware',
        });
      } catch { /* best-effort */ }
    }
    return result;
  });

  app.post('/pod/reflect', {
    schema: {
      summary: 'REFLECT by compiling memory artifacts for a scope',
      body: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          actor_display_name: { type: 'string' },
          scope: { type: 'string' },
          scope_alias: { type: 'string' },
          target: {
            type: 'object',
            // Per Protocol Contract v0.4.1 + Conformance REF-11, scope-target
            // is post-beta and rejected with invalid_payload (not 501). The
            // route accepts the field for shape compat but rejects below.
            properties: {
              type: { type: 'string', enum: ['page', 'profile', 'scope', 'claim'] },
              id: { type: 'string' },
            },
          },
          mode: { type: 'string', enum: ['explicit', 'autonomous'] },
          use_llm: { type: 'boolean' },
          operation_id: { type: 'string' },
        },
        required: ['actor_id', 'operation_id'],
      },
    },
  }, async (request, reply) => {
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const workspaceId = requestWorkspaceId(request);
    const workspaceScope = ensureWorkspaceScope(core, env, workspaceId);
    const body = request.body as PodReflectBody;
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    const policyScope = body.target?.type === 'profile'
      ? profile.scopes.personal
      : resolveScope(profile, body.scope, body.scope_alias, workspaceScope);
    if (!requireAgentScope(profile, body.actor_id, policyScope, 'write', reply)) return;
    // REF-11: scope-target is post-beta. Reject with spec envelope.
    if (body.target?.type === 'scope') {
      return specError(
        reply,
        400,
        'invalid_payload',
        'REFLECT target.type "scope" is post-beta; not accepted in this version.',
        { path: 'target.type', received: 'scope' },
      );
    }
    if (body.target?.type === 'profile') {
      if (body.target.id && body.target.id !== 'self') {
        return specError(
          reply,
          400,
          'invalid_payload',
          `REFLECT profile target '${body.target.id}' is not supported; only 'self' is available in beta.`,
          { path: 'target.id', received: body.target.id },
        );
      }
      if (body.mode === 'autonomous') {
        const cadence = readReflectionCadence(db);
        if (cadence.mode === 'manual_only') {
          return {
            status: 'skipped',
            reason: 'Autonomous REFLECT cadence is manual_only.',
            cadence,
            target: { type: 'profile', id: 'self' },
          };
        }
        if (cadence.next_reflect_after && Date.now() < Date.parse(cadence.next_reflect_after)) {
          return {
            status: 'skipped',
            reason: 'Autonomous REFLECT cadence is not due yet.',
            cadence,
            target: { type: 'profile', id: 'self' },
          };
        }
        const result = await wrapMutation({
          db,
          opsDir: core.opsDir,
          operation_id: body.operation_id,
          actor_id: body.actor_id,
          op: 'reflect.profile',
          payload: body,
        }, async () => reflectSelfProfile(env, profile, selfProfileKnowledge(core, profile)));
        return {
          ...result,
          mode: 'autonomous',
          cadence: updateReflectionCadenceAfterRun(db, cadence),
          target: { type: 'profile', id: 'self' },
        };
      }
      const result = await wrapMutation({
        db,
        opsDir: core.opsDir,
        operation_id: body.operation_id,
        actor_id: body.actor_id,
        op: 'reflect.profile',
        payload: body,
      }, async () => reflectSelfProfile(env, profile, selfProfileKnowledge(core, profile)));
      return {
        ...result,
        mode: body.mode ?? 'explicit',
        target: { type: 'profile', id: 'self' },
      };
    }
    if (body.target?.type && body.target.type !== 'page') {
      // 'claim' target lands in Phase C6 (REF-10). Today it's not implemented;
      // surface that with the spec error envelope rather than 501.
      return specError(
        reply,
        400,
        'invalid_payload',
        `REFLECT target.type '${body.target.type}' is not yet implemented.`,
        { path: 'target.type', received: body.target.type },
      );
    }
    if (body.mode === 'autonomous') {
      const cadence = readReflectionCadence(db);
      if (cadence.mode === 'manual_only') {
        return {
          status: 'skipped',
          reason: 'Autonomous REFLECT cadence is manual_only.',
          cadence,
        };
      }
      if (cadence.next_reflect_after && Date.now() < Date.parse(cadence.next_reflect_after)) {
        return {
          status: 'skipped',
          reason: 'Autonomous REFLECT cadence is not due yet.',
          cadence,
        };
      }
      const autoScope = resolveScope(profile, body.scope, body.scope_alias, workspaceScope);
      const result = await wrapMutation({
        db,
        opsDir: core.opsDir,
        operation_id: body.operation_id,
        actor_id: body.actor_id,
        op: 'reflect.explicit',
        payload: body,
        append_ops_log: false,
      }, async () => core.compile({
          actor: { type: 'agent', id: body.actor_id, display_name: body.actor_display_name ?? body.actor_id },
          scope: autoScope,
          use_llm: resolveReflectionModelUse(db, body.use_llm),
          operation_id: body.operation_id,
        }));
      return {
        ...result,
        mode: 'autonomous',
        cadence: updateReflectionCadenceAfterRun(db, cadence),
      };
    }
    const explicitScope = resolveScope(profile, body.scope, body.scope_alias, workspaceScope);
    const result = await wrapMutation({
      db,
      opsDir: core.opsDir,
      operation_id: body.operation_id,
      actor_id: body.actor_id,
      op: 'reflect.explicit',
      payload: body,
      append_ops_log: false,
    }, async () => core.compile({
        actor: { type: 'agent', id: body.actor_id, display_name: body.actor_display_name ?? body.actor_id },
        scope: explicitScope,
        use_llm: resolveReflectionModelUse(db, body.use_llm),
        operation_id: body.operation_id,
      }));
    return { ...result, mode: 'explicit' };
  });

  app.post('/pod/reflect-cycle', {
    schema: {
      summary: 'Run one owner-authorized reflection cycle across every Pod data space',
      body: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          use_llm: { type: 'boolean' },
        },
        required: ['actor_id'],
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const body = request.body as { actor_id: string; use_llm?: boolean };
    try {
      return await runPodReflectionCycle(env, {
        actorId: body.actor_id,
        mode: 'manual',
        useLlm: body.use_llm,
      });
    } catch (error) {
      if (handleOperationError(reply, error)) return;
      throw error;
    }
  });

  app.post('/pod/dream', {
    schema: {
      summary: 'Run the shared derived-only Dream cycle now',
      body: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          scope: { type: 'string' },
          scope_alias: { type: 'string' },
        },
        required: ['actor_id'],
      },
    },
  }, async (request, reply) => {
    const body = request.body as PodDreamBody;
    if (!await requireOwnerAuth(request, reply, env)) return;
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    try {
      const result = await runPodDreamCycle(env, {
        actorId: body.actor_id,
        scope: resolveScope(profile, body.scope, body.scope_alias),
        mode: 'manual',
      });
      const findingCount = result.phases.filter(phase => phase.outcome === 'findings').length;
      recordActivity({
        type: 'dream_completed',
        process: 'dream',
        actor_id: body.actor_id,
        scope: body.scope_alias ?? body.scope ?? 'workspace',
        title: 'Dream inspection completed',
        detail: `${result.phases.length} phases · ${findingCount} with findings`,
        content: { run_id: result.run_id, findings: findingCount },
      });
      return result;
    } catch (error) {
      if (handleOperationError(reply, error)) return;
      throw error;
    }
  });

  // ── Read / Browse ───────────────────────────────────────────────────────
  app.post('/pod/dream-cycle', {
    schema: {
      summary: 'Run owner-authorized memory maintenance across every Pod data space',
      body: {
        type: 'object',
        properties: { actor_id: { type: 'string' } },
        required: ['actor_id'],
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const body = request.body as { actor_id: string };
    try {
      return await runPodDreamCycleAcrossScopes(env, {
        actorId: body.actor_id,
        mode: 'manual',
      });
    } catch (error) {
      if (handleOperationError(reply, error)) return;
      throw error;
    }
  });

  app.post('/pod/read', {
    schema: {
      summary: 'Read a compiled entity page, or browse all entities in a scope',
      body: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          entity_id: { type: 'string' },
          entity_name: { type: 'string' },
          scope: { type: 'string' },
          scope_alias: { type: 'string' },
          resolution: { type: 'string', enum: ['oneliner', 'paragraph', 'full'] },
          include_sensitive: { type: 'boolean' },
        },
        required: ['actor_id'],
      },
    },
  }, async (request, reply) => {
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const body = request.body as PodReadBody;
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    const scope = body.scope || body.scope_alias ? resolveScope(profile, body.scope, body.scope_alias) : undefined;
    if (scope && !requireAgentScope(profile, body.actor_id, scope, 'read', reply)) return;
    try {
      const result = await core.read({
        actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
        entity_id: body.entity_id,
        entity_name: body.entity_name,
        scope,
        resolution: body.resolution ?? 'full',
        include_sensitive: body.include_sensitive,
      });
      if (!requireAgentScope(profile, body.actor_id, result.scope, 'read', reply)) return;
      return result;
    } catch (error) {
      if (handleOperationError(reply, error)) return;
      throw error;
    }
  });

  // ── Explain (provenance tracing) ──────────────────────────────────────
  app.post('/pod/explain', {
    schema: {
      summary: 'Trace provenance of a claim or entity',
      body: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          claim_id: { type: 'string' },
          entity_id: { type: 'string' },
        },
        required: ['actor_id'],
      },
    },
  }, async (request, reply) => {
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const body = request.body as PodExplainBody;
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    try {
      const result = await core.explain({
        actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
        claim_id: body.claim_id,
        entity_id: body.entity_id,
      });
      const scope = result.type === 'claim' ? result.claim?.scope : result.entity?.entity.scope;
      if (scope && !requireAgentScope(profile, body.actor_id, scope, 'read', reply)) return;
      return result;
    } catch (error) {
      if (handleOperationError(reply, error)) return;
      throw error;
    }
  });

  // ── Correct (claim correction) ────────────────────────────────────────
  app.post('/pod/correct', {
    schema: {
      summary: 'Correct an existing claim',
      body: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          target_claim_id: { type: 'string' },
          reason: { type: 'string', enum: ['changed', 'wrong', 'extraction_error', 'duplicate'] },
          corrected_predicate: { type: 'string' },
          corrected_object_type: { type: 'string' },
          corrected_object_value: { type: 'string' },
          corrected_valid_from: { type: 'string' },
          corrected_valid_to: { type: 'string' },
          merge_into_claim_id: { type: 'string' },
        },
        required: ['actor_id', 'target_claim_id', 'reason'],
      },
    },
  }, async (request, reply) => {
    const core = await getSmartwareCore(env);
    const body = request.body as PodCorrectBody;
    if (!await requireOwnerAuth(request, reply, env)) return;
    if (body.reason === 'duplicate') {
      if (!body.merge_into_claim_id) {
        return reply.code(400).send({ error: 'invalid_merge', message: 'merge_into_claim_id is required when reason is duplicate' });
      }
      recordActivity({
        type: 'claim_merged',
        process: 'revise',
        actor_id: body.actor_id,
        scope: 'personal',
        title: 'Merged duplicate claim',
        detail: `${body.target_claim_id} → ${body.merge_into_claim_id}`,
        content: { target_claim_id: body.target_claim_id, merge_into_claim_id: body.merge_into_claim_id, reason: body.reason },
      });
      return {
        original_claim_id: body.target_claim_id,
        merge_into_claim_id: body.merge_into_claim_id,
        status: 'merged',
      };
    }
    const correctedObject = body.corrected_object_type && body.corrected_object_value
      ? { type: body.corrected_object_type, value: body.corrected_object_value }
      : undefined;
    const result = await core.correct({
      actor: { type: 'person', id: body.actor_id, display_name: body.actor_id },
      target_claim_id: body.target_claim_id,
      corrected_predicate: body.corrected_predicate,
      corrected_object: correctedObject as { type: string; value: unknown } | undefined,
      corrected_validity: body.corrected_valid_from
        ? { from: body.corrected_valid_from, to: body.corrected_valid_to ?? null }
        : undefined,
      reason: body.reason,
    });
    recordActivity({
      type: 'claim_revised',
      process: 'revise',
      actor_id: body.actor_id,
      scope: 'personal',
      title: 'Revised claim',
      detail: body.target_claim_id,
      content: { target_claim_id: body.target_claim_id, reason: body.reason },
    });
    return result;
  });

  app.post('/pod/revise', {
    schema: {
      summary: 'REVISE an existing claim while preserving audit history',
      body: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          claim_id: { type: 'string' },
          // Spec shape per Protocol Contract v0.4.1 + Schemas v0.1.2.
          // When `target` is supplied the route validates against the spec
          // if/then/else (dry_run + operation_id interaction); otherwise it
          // falls through to the legacy claim_id path for back-compat.
          target: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['claim', 'page', 'tombstone'] },
              id: { type: 'string' },
            },
            required: ['type', 'id'],
          },
          new_state: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              tag: { type: 'string' },
              confidence: { type: 'number' },
              author: { type: 'string', enum: ['user'] },
              revived: { type: 'boolean' },
            },
          },
          reason: { type: 'string' },
          dry_run: { type: 'boolean' },
          cascade_preview_id: { type: 'string' },
          operation_id: { type: 'string' },
          expected_base_version: { type: 'number' },
          set_confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          set_epistemic_tag: { type: 'string', enum: ['fact', 'inference', 'opinion', 'stale', 'contested'] },
          adopt_body: { type: 'boolean' },
          add_relations: { type: 'array' },
          invalidate_relations: { type: 'array', items: { type: 'string' } },
          add_derived_from: { type: 'array', items: { type: 'string' } },
        },
        // Required is computed inline below — the spec path needs `target`
        // and `reason`; the legacy path needs `claim_id` and `new_state`.
        required: ['reason'],
      },
    },
  }, async (request, reply) => {
    const core = await getSmartwareCore(env);
    const body = request.body as PodReviseBody & {
      operation_id?: string;
      target?: { type: 'claim' | 'page' | 'tombstone'; id: string };
      dry_run?: boolean;
      cascade_preview_id?: string;
    };

    if (body.dry_run !== true && body.operation_id === undefined) {
      return specError(reply, 400, 'invalid_payload',
        'REVISE commit requires operation_id; dry_run preview does not.',
        { path: 'operation_id' });
    }

    // ── Spec validation gate (PR-A7 + PR-22) ───────────────────────────
    // PR-22: when the spec target shape is used, run the zod gateway.
    // It enforces the dry_run + operation_id if/then/else, OperationId
    // pattern, ActorId pattern, and the strict new_state vocabulary.
    const isSpecMode = body.target !== undefined || body.operation_id !== undefined || body.dry_run !== undefined;
    if (isSpecMode && body.target !== undefined) {
      const reviseValidation = validateRevise({
        target: body.target,
        new_state: body.new_state ?? {},
        reason: body.reason,
        dry_run: body.dry_run,
        operation_id: body.operation_id,
        cascade_preview_id: body.cascade_preview_id,
        actor_id: body.actor_id,
      });
      if (!reviseValidation.ok) {
        return specError(reply, 400, reviseValidation.error.code, reviseValidation.error.message, reviseValidation.error.details);
      }
    } else if (isSpecMode) {
      // operation_id or dry_run present but no target — legacy claim_id
      // mode. Apply the if/then/else inline since zod requires target.
      if (body.dry_run === true && body.operation_id !== undefined) {
        return specError(reply, 400, 'invalid_payload',
          'REVISE dry_run preview phase does not consume an operation_id.',
          { path: 'operation_id' });
      }
      if (body.dry_run !== true && body.operation_id === undefined) {
        return specError(reply, 400, 'invalid_payload',
          'REVISE commit requires operation_id; dry_run preview does not.',
          { path: 'operation_id' });
      }
    }

    // Legacy callers without spec mode must supply claim_id + new_state.
    if (!isSpecMode) {
      if (!body.claim_id) {
        return specError(reply, 400, 'invalid_payload',
          'REVISE requires either spec `target: {type, id}` or legacy `claim_id`.',
          { path: 'claim_id' });
      }
      if (!body.new_state || !body.new_state.content) {
        return specError(reply, 400, 'invalid_payload',
          'REVISE requires `new_state.content` in legacy mode.',
          { path: 'new_state.content' });
      }
    }

    // ── REVISE target.type='page' — endorsement cascade (PR-8 / B3) ─────
    if (body.target && body.target.type === 'page') {
      if (!await requireOwnerAuth(request, reply, env)) return;
      const core = await getSmartwareCore(env);
      const actorId = body.actor_id ?? env.ownerId ?? 'user:owner';

      // dry_run: preview the cascade
      if (body.dry_run === true) {
        const result = dryRunEndorsement(core.wikiDir, core.previewStore, {
          page_id: body.target.id,
          actor_id: actorId,
          reason: body.reason,
        });
        if ('code' in result) {
          const status = result.code === 'not_found' ? 404 : result.code === 'forbidden' ? 403 : 400;
          return specError(reply, status, result.code, result.message);
        }
        return result;
      }

      // commit phase
      const commit = await commitEndorsement(core, db, {
        page_id: body.target.id,
        operation_id: body.operation_id!, // schema guard ensured presence
        actor_id: actorId,
        reason: body.reason,
        cascade_preview_id: body.cascade_preview_id,
      });
      if ('code' in commit) {
        const status =
          commit.code === 'not_found' ? 404 :
          commit.code === 'forbidden' ? 403 :
          commit.code === 'cascade_required_ack' ? 428 :
          commit.code === 'preview_not_found' ? 404 :
          commit.code === 'preview_expired' ? 410 :
          commit.code === 'conflict' ? 409 :
          400;
        if (commit.code === 'cascade_required_ack') {
          return reply.code(status).send({
            error: {
              code: commit.code,
              message: commit.message,
              cascade_preview_id: commit.cascade_preview_id,
              cascade: commit.cascade,
            },
          });
        }
        return specError(reply, status, commit.code, commit.message);
      }
      recordActivity({
        type: 'page_endorsed',
        process: 'revise',
        actor_id: actorId,
        scope: 'personal',
        title: 'Endorsed page',
        detail: commit.page_id,
        content: { page_id: commit.page_id, cascade: commit.cascade, reason: body.reason },
      });
      return {
        page_id: commit.page_id,
        cascade: commit.cascade,
        operation_id: commit.operation_id,
        commit_ts: commit.commit_ts,
        status: 'endorsed' as const,
      };
    }

    // ── REVISE target.type='tombstone' — revival (PR-8 / B4) ────────────
    if (body.target && body.target.type === 'tombstone') {
      if (!await requireOwnerAuth(request, reply, env)) return;
      const core = await getSmartwareCore(env);
      const actorId = body.actor_id ?? env.ownerId ?? 'user:owner';
      try {
        const result = await core.revive({
          actor: { type: 'person', id: actorId, display_name: actorId },
          tombstone_id: body.target.id,
          reason: body.reason,
          operation_id: body.operation_id ?? `op_${Date.now()}`,
        });
        const profile = getPodProfile(core, env);
        await refreshExperienceScopes(Object.values(profile.scopes));
        recordActivity({
          type: 'memory_revived',
          process: 'revise',
          actor_id: actorId,
          scope: 'personal',
          title: 'Revived memory',
          detail: body.target.id,
          content: { tombstone_id: body.target.id, reason: body.reason },
        });
        return {
          ...result,
          note: 'Page citations are NOT auto-restored (RV-11). Affected pages must be re-cited manually.',
        };
      } catch (err) {
        if (handleOperationError(reply, err)) return;
        return specError(reply, 500, 'conflict', `Tombstone revival failed: ${(err as Error).message}`);
      }
    }

    // Fall through to existing claim-revise flow for target.type='claim'
    // and legacy claim_id callers.
    if (!body.claim_id && body.target?.type === 'claim') {
      body.claim_id = body.target.id;
    }

    if (!await requireOwnerAuth(request, reply, env)) return;

    // §9 REVISE admission path: when spec-mode fields are present, use
    // core.revise() which implements the full v0.4.2 admission payload.
    const specBody = body as unknown as Record<string, unknown>;
    const hasSpecFields = specBody.set_confidence || specBody.set_epistemic_tag ||
      specBody.adopt_body || specBody.add_relations || specBody.invalidate_relations ||
      specBody.add_derived_from || specBody.expected_base_version;

    if (hasSpecFields && body.operation_id) {
      try {
        const result = await core.revise({
          actor: { type: 'person', id: body.actor_id, display_name: body.actor_id },
          target: body.claim_id ?? body.target?.id ?? '',
          expected_base_version: (specBody.expected_base_version as number) ?? 1,
          set_confidence: specBody.set_confidence as 'high' | 'medium' | 'low' | undefined,
          set_epistemic_tag: specBody.set_epistemic_tag as 'fact' | 'inference' | 'opinion' | 'stale' | 'contested' | undefined,
          adopt_body: specBody.adopt_body as boolean | undefined,
          add_relations: specBody.add_relations as ReviseRelationInput[] | undefined,
          invalidate_relations: specBody.invalidate_relations as string[] | undefined,
          add_derived_from: specBody.add_derived_from as string[] | undefined,
          reason: body.reason,
          operation_id: body.operation_id,
        });
        recordActivity({
          type: 'claim_revised',
          process: 'revise',
          actor_id: body.actor_id,
          scope: 'personal',
          title: 'Revised claim',
          detail: body.claim_id ?? body.target?.id ?? '',
          content: { target_claim_id: body.claim_id ?? body.target?.id, reason: body.reason },
        });
        return result;
      } catch (err) {
        if (handleOperationError(reply, err)) return;
        throw err;
      }
    }

    // Legacy claim-revise: correct the claim object value
    const substrateCall = () => core.correct({
      actor: { type: 'person', id: body.actor_id, display_name: body.actor_id },
      target_claim_id: body.claim_id,
      corrected_object: { type: body.new_state?.tag ?? 'text', value: body.new_state?.content ?? '' },
      reason: body.reason,
    }).then((result) => ({
      revision_id: `rev_${result.audit_observation_id.replace(/^obs_/, '')}`,
      claim_id: body.claim_id,
      new_claim_id: result.new_claim_id,
      audit_observation_id: result.audit_observation_id,
      status: 'revised' as const,
    }));

    if (body.operation_id) {
      try {
        return await wrapMutation(
          {
            db,
            opsDir: core.opsDir,
            operation_id: body.operation_id,
            actor_id: body.actor_id,
            op: 'revise.claim',
            payload: body,
            details: { claim_id: body.claim_id },
          },
          async (_commit_ts) => {
            const result = await substrateCall();
            recordActivity({
              type: 'claim_revised',
              process: 'revise',
              actor_id: body.actor_id,
              scope: 'personal',
              title: 'Revised claim',
              detail: body.claim_id ?? '',
              content: { target_claim_id: body.claim_id, reason: body.reason },
            });
            return result;
          },
        );
      } catch (err) {
        if (handleOperationError(reply, err)) return;
        throw err;
      }
    }
    const result = await substrateCall();
    recordActivity({
      type: 'claim_revised',
      process: 'revise',
      actor_id: body.actor_id,
      scope: 'personal',
      title: 'Revised claim',
      detail: body.claim_id ?? '',
      content: { target_claim_id: body.claim_id, reason: body.reason },
    });
    return result;
  });

  // ── Forget (tombstone / redaction) ────────────────────────────────────
  app.post('/pod/forget', {
    schema: {
      summary: 'Forget a claim, observation, object, source, or collection',
      body: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          target: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['claim', 'observation', 'object', 'source', 'collection'] },
              id: { type: 'string' },
            },
            required: ['type', 'id'],
          },
          mode: { type: 'string', enum: ['tombstone', 'delete_object', 'redact_if_supported'] },
          reason: { type: 'string' },
          redaction_reason: { type: 'string', enum: ['sensitive', 'requested_by_user', 'extraction_error', 'policy_violation'] },
          cascade: { type: 'boolean' },
          operation_id: { type: 'string' },
        },
        required: ['actor_id', 'target', 'mode', 'operation_id'],
      },
    },
  }, async (request, reply) => {
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const body = request.body as PodForgetBody;
    if (!await requireOwnerAuth(request, reply, env)) return;
    const workspaceId = requestWorkspaceId(request);

    try {
      const result = await wrapMutation(
        {
          db,
          opsDir: core.opsDir,
          operation_id: body.operation_id,
          actor_id: body.actor_id,
          op: 'forget',
          payload: body,
          details: { target: body.target, mode: body.mode },
          append_ops_log: body.target.type !== 'claim' && body.target.type !== 'observation',
        },
        async (_commit_ts) => {
          const result = await forgetSubstrateCall(core, body, workspaceId, reply);
          if (reply.statusCode < 400) {
            recordActivity({
              workspace_id: workspaceId,
              type: 'memory_forgotten',
              process: 'forget',
              actor_id: body.actor_id,
              scope: 'personal',
              title: `Forgot ${body.target.type}`,
              detail: body.target.id,
              content: { target: body.target, mode: body.mode, reason: body.reason ?? body.redaction_reason },
            });
          }
          return result;
        },
      );
      if (reply.statusCode < 400 && body.target.type === 'observation') {
        const scopes = Object.values(profile.scopes);
        await Promise.all([
          refreshExperienceScopes(scopes),
          refreshConversationScopes(scopes),
        ]);
      }
      return result;
    } catch (err) {
      if (handleOperationError(reply, err)) return;
      throw err;
    }
  });

  // Extracted to share the substrate-call branch between the spec-conformant
  // (wrapMutation) path and the legacy back-compat path.
  async function forgetSubstrateCall(
    core: Awaited<ReturnType<typeof getSmartwareCore>>,
    body: PodForgetBody,
    workspaceId: string,
    reply: import('fastify').FastifyReply,
  ): Promise<unknown> {
    if (body.target.type === 'claim') {
      if (body.mode === 'delete_object') {
        return reply.code(400).send({ error: 'invalid_mode', message: 'delete_object is not valid for claims' });
      }
      return core.forget({
        actor: { type: 'person', id: body.actor_id, display_name: body.actor_id },
        target: { type: 'claim', id: body.target.id },
        mode: body.mode,
        reason: body.reason ?? body.redaction_reason,
        redaction_reason: body.redaction_reason,
        operation_id: body.operation_id,
      });
    }
    if (body.target.type === 'observation') {
      if (body.mode === 'delete_object') {
        return reply.code(400).send({ error: 'invalid_mode', message: 'delete_object is not valid for observations' });
      }
      return core.forget({
        actor: { type: 'person', id: body.actor_id, display_name: body.actor_id },
        target: { type: 'observation', id: body.target.id },
        mode: body.mode,
        reason: body.reason ?? body.redaction_reason,
        redaction_reason: body.redaction_reason,
        operation_id: body.operation_id,
      });
    }
    if (body.target.type === 'object') {
      const object = getObject(db, body.target.id);
      if (!object || object.workspace_id !== workspaceId) {
        return reply.code(404).send({ error: 'not_found', message: 'Pod object not found' });
      }
      if (body.mode === 'tombstone') {
        return { object: patchObject(db, body.target.id, { deleted_at: new Date().toISOString() }, workspaceId), status: 'tombstoned' };
      }
      if (body.mode === 'redact_if_supported') {
        return {
          object: patchObject(db, body.target.id, {
            content: { redacted: true },
            redacted_at: new Date().toISOString(),
            sensitive: true,
          }, workspaceId),
          status: 'redacted',
        };
      }
      deleteObject(db, body.target.id, workspaceId);
      return { deleted: true, status: 'deleted' };
    }
    if (body.target.type === 'collection') {
      if (body.mode === 'redact_if_supported') {
        return reply.code(400).send({ error: 'invalid_mode', message: 'redact_if_supported is not supported for collections' });
      }
      if (body.mode === 'delete_object' && body.cascade) {
        const objects = listObjects(db, { workspaceId, collectionId: body.target.id, includeArchived: true, limit: 1000 });
        for (const object of objects) {
          deleteObject(db, object.id, workspaceId);
        }
      }
      return { deleted: deleteCollection(db, body.target.id, workspaceId), cascade: body.cascade === true };
    }
    return reply.code(400).send({
      error: 'unsupported_target',
      message: `FORGET for target type '${body.target.type}' is not yet supported by this Pod adapter.`,
    });
  }

  // ── Sessions (Smartware server-anchored) ──────────────────────────────

  app.post('/pod/session/start', { schema: { summary: 'Start a Pod work session' } }, async (request, reply) => {
    const body = request.body as PodSessionStartBody;
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const scope = resolveScope(profile, body.scope, body.scope_alias);
    if (!requireAgentScope(profile, body.actor_id, scope, 'read', reply)) return;
    if (!requireAgentScope(profile, body.actor_id, scope, 'write', reply)) return;
    const query = body.query ?? body.goal;
    const task = body.task ?? {
      key: body.workflow_id ?? `goal:${body.goal.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)}`,
      goal: body.goal,
      tags: [],
    };
    // Session start intentionally exercises the same lane-aware planner as
    // /pod/context. This changes turn-one context: conversation memory now
    // participates alongside claims, lessons, and the scoped self profile.
    const contextHeaders: Record<string, string> = {};
    if (typeof request.headers.authorization === 'string') {
      contextHeaders.authorization = request.headers.authorization;
    }
    if (typeof request.headers.cookie === 'string') {
      contextHeaders.cookie = request.headers.cookie;
    }
    const contextResponse = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: contextHeaders,
      payload: {
        query,
        scope,
        agent_id: body.actor_id,
        task,
        retrieval_mode: 'always',
      },
    });
    if (contextResponse.statusCode !== 200) {
      return reply.code(contextResponse.statusCode).send(contextResponse.json());
    }
    const context = contextResponse.json() as {
      context: unknown[];
      lessons: unknown[];
      conversations: unknown[];
      [key: string]: unknown;
    };
    const sessionId = body.session_id ?? `session_${Date.now()}`;
    await core.observe({
      actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
      type: 'workflow_run_started',
      scope,
      source_id: `${sessionId}:start`,
      content: {
        format: 'application/json',
        body: {
          session_id: sessionId,
          workflow_id: body.workflow_id ?? 'pod-session',
          goal: body.goal,
          query,
          task,
          context_results: context.context.length,
          lesson_results: context.lessons.length,
          conversation_results: context.conversations.length,
        },
      },
      visibility: 'scope',
      app: 'coffee-pod',
    });
    return {
      session: { id: sessionId, goal: body.goal, scope, read_policy: 'task_start_lane_aware' },
      context,
    };
  });

  app.post('/pod/session/checkpoint', { schema: { summary: 'Record a durable session checkpoint' } }, async (request, reply) => {
    const body = request.body as PodSessionCheckpointBody;
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    if (!body.scope && !body.scope_alias) {
      return specError(reply, 400, 'invalid_payload', 'scope or scope_alias is required for a session checkpoint');
    }
    if (body.scope_alias
      && body.scope_alias !== 'workspace'
      && !(body.scope_alias in profile.scopes)) {
      return specError(reply, 400, 'invalid_payload', `Unknown scope_alias '${body.scope_alias}'`);
    }
    const scope = resolveScope(profile, body.scope, body.scope_alias);
    if (!requireAgentScope(profile, body.actor_id, scope, 'write', reply)) return;
    const started = core.listActivity({
      scope,
      types: ['workflow_run_started'],
      actorId: body.actor_id,
      limit: 100,
    }).find(event => event.source_id === `${body.session_id}:start` || event.source_id === body.session_id);
    if (!started) {
      return specError(reply, 404, 'not_found',
        `Session '${body.session_id}' was not started by '${body.actor_id}' in scope '${scope}'`);
    }

    const envelope: SessionCheckpointV1 = {
      kind: 'session_checkpoint',
      version: 1,
      operation_id: body.operation_id,
      checkpoint_id: body.checkpoint_id,
      session_id: body.session_id,
      scope,
      trigger: body.trigger,
      generation: body.generation,
      summary: body.summary,
      decisions: body.decisions,
      open_loops: body.open_loops,
      source_digest: body.source_digest,
    };
    try {
      validateSessionCheckpoint(envelope);
      const result = await core.observe({
        actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
        type: 'compaction',
        scope,
        source_id: envelope.checkpoint_id,
        operation_id: envelope.operation_id,
        content: { format: 'application/json', body: envelope },
        visibility: 'scope',
        app: 'coffee-pod',
      });
      return {
        ...result,
        checkpoint_id: envelope.checkpoint_id,
        session_id: envelope.session_id,
        scope: envelope.scope,
      };
    } catch (error) {
      if (error instanceof SessionCheckpointValidationError) {
        return specError(reply, 400, 'invalid_payload', error.message, {
          expected_checkpoint_id: deriveSessionCheckpointId(
            body.session_id,
            body.trigger,
            body.generation,
          ),
        });
      }
      if (handleOperationError(reply, error)) return;
      throw error;
    }
  });

  app.post('/pod/session/end', { schema: { summary: 'Summarize and close a Pod work session' } }, async (request, reply) => {
    const body = request.body as PodSessionEndBody;
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const lines = [
      body.outcome,
      ...(body.decisions ?? []).map(d => `Decision: ${d}`),
      ...(body.tasks ?? []).map(t => `Task: ${t}`),
    ];
    const sessionId = body.session_id ?? `session_${Date.now()}`;
    const scope = resolveScope(profile, body.scope, body.scope_alias ?? 'workspace');
    if (!requireAgentScope(profile, body.actor_id, scope, 'write', reply)) return;
    const started = core.listActivity({
      scope,
      types: ['workflow_run_started'],
      actorId: body.actor_id,
      limit: 100,
    }).find(event => event.source_id === `${sessionId}:start` || event.source_id === sessionId);
    const startedTask = asRecord(asRecord(started?.content)['task']);
    const experienceTask = body.experience?.task ?? (startedTask['key'] ? startedTask : {
      key: body.workflow_id ?? sessionId,
      tags: [],
    });
    const experienceContent = body.experience ? {
      kind: 'experience_event',
      event: 'attempt_finished',
      task: experienceTask,
      attempt: {
        id: sessionId,
        status: body.experience.status,
        summary: body.outcome,
        error_signature: body.experience.error_signature,
        applied_lesson_ids: body.experience.applied_lesson_ids ?? [],
        reflection: body.experience.reflection,
        recommended_action: body.experience.recommended_action,
        applies_when: body.experience.applies_when,
      },
      session: {
        workflow_id: body.workflow_id ?? null,
        decisions: body.decisions ?? [],
        tasks: body.tasks ?? [],
      },
    } : null;
    const result = await core.observe({
      actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
      type: 'workflow_run_completed',
      scope,
      source_id: `${sessionId}:end`,
      content: experienceContent
        ? { format: 'application/json', body: experienceContent }
        : { format: 'text/plain', body: lines.join('\n') },
      visibility: 'scope',
      app: 'coffee-pod',
    });
    if (experienceContent) {
      await refreshExperienceAfterObservation(scope, experienceContent, {
        actorId: body.actor_id,
        observationId: result.id,
      });
    }
    return { ...result, session_id: sessionId, experience_captured: Boolean(experienceContent) };
  });

  app.post('/pod/agent/action/propose', { schema: { summary: 'Propose an agent action requiring human review' } }, async (request, reply) => {
    const body = request.body as PodAgentActionBody;
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const actionId = body.action_id ?? `action_${Date.now()}`;
    const scope = resolveScope(profile, body.scope, body.scope_alias ?? 'workspace');
    if (!requireAgentScope(profile, body.actor_id, scope, 'write', reply)) return;
    const result = await core.observe({
      actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
      type: 'agent_action_proposed',
      scope,
      source_id: actionId,
      content: {
        format: 'application/json',
        body: {
          action_id: actionId,
          action_type: body.action_type,
          title: body.title,
          description: body.description ?? '',
          external_system: body.external_system ?? null,
          payload: body.payload ?? {},
          requires_review: true,
          status: 'proposed',
        },
      },
      visibility: 'scope',
      app: 'coffee-pod',
    });
    return { ...result, action_id: actionId, review_required: true };
  });

  app.post('/pod/agent/action/approve', { schema: { summary: 'Approve a proposed agent action' } }, async (request, reply) => {
    const body = request.body as PodAgentActionReviewBody;
    if (!await requireOwnerAuth(request, reply, env)) return;
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const result = await core.observe({
      actor: { type: 'person', id: body.actor_id, display_name: body.actor_id },
      type: 'agent_action_approved',
      scope: resolveScope(profile, body.scope, body.scope_alias ?? 'workspace'),
      content: {
        format: 'application/json',
        body: {
          action_id: body.action_id,
          status: 'approved',
          reason: body.reason ?? '',
        },
      },
      visibility: 'scope',
      app: 'coffee-pod',
    });
    return { ...result, action_id: body.action_id, status: 'approved' };
  });

  app.post('/pod/agent/action/reject', { schema: { summary: 'Reject a proposed agent action' } }, async (request, reply) => {
    const body = request.body as PodAgentActionReviewBody;
    if (!await requireOwnerAuth(request, reply, env)) return;
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const result = await core.observe({
      actor: { type: 'person', id: body.actor_id, display_name: body.actor_id },
      type: 'agent_action_rejected',
      scope: resolveScope(profile, body.scope, body.scope_alias ?? 'workspace'),
      content: {
        format: 'application/json',
        body: {
          action_id: body.action_id,
          status: 'rejected',
          reason: body.reason ?? '',
        },
      },
      visibility: 'scope',
      app: 'coffee-pod',
    });
    return { ...result, action_id: body.action_id, status: 'rejected' };
  });
}
