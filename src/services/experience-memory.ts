import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { CoffeePodEnv } from '../config/env.js';

export interface ExperienceTask {
  key: string;
  title?: string;
  goal?: string;
  environment?: string;
  tags: string[];
}

export interface ExperienceAttempt {
  id: string;
  status: 'success' | 'failure';
  summary: string;
  error_signature?: string;
  applied_lesson_ids: string[];
  reflection?: string;
  recommended_action?: string;
  applies_when?: string;
}

export interface ExperienceEvent {
  kind: 'experience_event';
  event: 'attempt_finished' | 'feedback_received';
  task: ExperienceTask;
  attempt?: ExperienceAttempt;
  attempt_id?: string;
  feedback?: string;
  recommended_action?: string;
  applies_when?: string;
}

export interface ExperienceLesson {
  id: string;
  scope: string;
  task: ExperienceTask;
  instruction: string;
  applies_when: string;
  failure: string;
  error_signature?: string;
  feedback: string;
  evidence_observation_ids: string[];
  learned_from_actor_ids: string[];
  failure_count: number;
  success_count: number;
  origin: 'agent_reflection' | 'user_feedback';
  validation_status: 'candidate' | 'validated';
  confidence: number;
  utility_score: number;
  learned_at: string;
  last_validated_at?: string;
  last_applied_at?: string;
}

export interface ExperienceProjection {
  version: 1;
  scope: string;
  generated_at: string;
  lessons: ExperienceLesson[];
}

export interface ExperienceTaskQuery {
  key?: string;
  goal?: string;
  environment?: string;
  tags?: string[];
}

export interface ApplicableExperienceLesson extends ExperienceLesson {
  relevance_score: number;
}

interface EvidenceObservation {
  id: string;
  type: string;
  status: string;
  scope: string;
  visibility?: string;
  source?: {
    actor?: { id?: string };
    observed_at?: string;
  };
  content?: { body?: unknown };
  provenance?: { informed_by?: string[] };
  policy?: { sensitive?: boolean };
}

interface RecordedExperienceEvent {
  observation: EvidenceObservation;
  event: ExperienceEvent;
}

interface MutableLesson extends ExperienceLesson {
  failed_attempt_ids: Set<string>;
  successful_attempt_ids: Set<string>;
}

const MAX_FIELD_LENGTH = 2_000;
const MAX_KEY_LENGTH = 160;
const MAX_TAGS = 20;
const MAX_LESSONS_PER_SCOPE = 500;
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'before', 'being', 'could', 'from', 'have', 'into',
  'should', 'that', 'their', 'there', 'these', 'this', 'those', 'when', 'where',
  'which', 'with', 'would', 'your',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function unwrapContent(value: unknown): unknown {
  const record = asRecord(value);
  if (record && 'format' in record && 'body' in record) return record['body'];
  return value;
}

function boundedString(value: unknown, maxLength = MAX_FIELD_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function normalizedTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map(tag => boundedString(tag, 80)?.toLowerCase())
    .filter((tag): tag is string => Boolean(tag)))]
    .slice(0, MAX_TAGS);
}

function parseTask(value: unknown): ExperienceTask | null {
  const task = asRecord(value);
  if (!task) return null;
  const key = boundedString(task['key'], MAX_KEY_LENGTH);
  if (!key) return null;
  const title = boundedString(task['title']);
  const goal = boundedString(task['goal']);
  const environment = boundedString(task['environment']);
  return {
    key,
    ...(title ? { title } : {}),
    ...(goal ? { goal } : {}),
    ...(environment ? { environment } : {}),
    tags: normalizedTags(task['tags']),
  };
}

function parseAttempt(value: unknown): ExperienceAttempt | null {
  const attempt = asRecord(value);
  if (!attempt) return null;
  const id = boundedString(attempt['id'], MAX_KEY_LENGTH);
  const status = attempt['status'];
  const summary = boundedString(attempt['summary']);
  if (!id || (status !== 'success' && status !== 'failure') || !summary) return null;
  const errorSignature = boundedString(attempt['error_signature'], 500);
  const reflection = boundedString(attempt['reflection']);
  const recommendedAction = boundedString(attempt['recommended_action']);
  const appliesWhen = boundedString(attempt['applies_when']);
  return {
    id,
    status,
    summary,
    ...(errorSignature ? { error_signature: errorSignature } : {}),
    ...(reflection ? { reflection } : {}),
    ...(recommendedAction ? { recommended_action: recommendedAction } : {}),
    ...(appliesWhen ? { applies_when: appliesWhen } : {}),
    applied_lesson_ids: Array.isArray(attempt['applied_lesson_ids'])
      ? [...new Set(attempt['applied_lesson_ids']
          .map(idValue => boundedString(idValue, MAX_KEY_LENGTH))
          .filter((idValue): idValue is string => Boolean(idValue)))]
      : [],
  };
}

export function parseExperienceEvent(value: unknown): ExperienceEvent | null {
  const body = asRecord(unwrapContent(value));
  if (!body || body['kind'] !== 'experience_event') return null;
  const task = parseTask(body['task']);
  if (!task) return null;

  if (body['event'] === 'attempt_finished') {
    const attempt = parseAttempt(body['attempt']);
    if (!attempt) return null;
    return { kind: 'experience_event', event: 'attempt_finished', task, attempt };
  }

  if (body['event'] === 'feedback_received') {
    const attemptId = boundedString(body['attempt_id'], MAX_KEY_LENGTH);
    const feedback = boundedString(body['feedback']);
    const recommendedAction = boundedString(body['recommended_action']);
    if (!attemptId || !feedback || !recommendedAction) return null;
    const appliesWhen = boundedString(body['applies_when']);
    return {
      kind: 'experience_event',
      event: 'feedback_received',
      task,
      attempt_id: attemptId,
      feedback,
      recommended_action: recommendedAction,
      ...(appliesWhen ? { applies_when: appliesWhen } : {}),
    };
  }

  return null;
}

export function isExperienceEventContent(value: unknown): boolean {
  return asRecord(unwrapContent(value))?.['kind'] === 'experience_event';
}

export function validateExperienceEventContent(value: unknown): string | null {
  if (!isExperienceEventContent(value)) return null;
  return parseExperienceEvent(value)
    ? null
    : 'Invalid experience_event. Supply a task key and either a completed attempt or linked feedback with a recommended action.';
}

async function readEvidence(env: CoffeePodEnv): Promise<EvidenceObservation[]> {
  const evidenceDir = path.join(env.dataDir, 'evidence');
  let files: string[];
  try {
    files = await readdir(evidenceDir);
  } catch {
    return [];
  }

  const observations: EvidenceObservation[] = [];
  for (const file of files.filter(name => name.endsWith('.jsonl')).sort()) {
    const raw = await readFile(path.join(evidenceDir, file), 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      observations.push(JSON.parse(line) as EvidenceObservation);
    }
  }
  return observations;
}

function projectionPath(env: CoffeePodEnv, scope: string): string {
  const slug = scope.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120);
  const suffix = createHash('sha256').update(scope).digest('hex').slice(0, 10);
  return path.join(env.dataDir, 'derived', 'experience', `${slug}-${suffix}.json`);
}

function lessonId(scope: string, taskKey: string, instruction: string): string {
  const fingerprint = `${scope}\u0000${taskKey.toLowerCase()}\u0000${instruction.toLowerCase()}`;
  return `lesson_${createHash('sha256').update(fingerprint).digest('hex').slice(0, 24)}`;
}

function effectiveExperienceEvents(observations: EvidenceObservation[], scope: string): RecordedExperienceEvent[] {
  const scoped = observations.filter(observation => observation.scope === scope && observation.status === 'accepted');
  const suppressedIds = new Set<string>();

  for (const observation of scoped) {
    if (observation.type !== 'tombstone' && observation.type !== 'redaction') continue;
    const body = asRecord(unwrapContent(observation.content?.body));
    const targetId = boundedString(body?.['target_id'], MAX_KEY_LENGTH);
    const targetKind = body?.['target_kind'] ?? 'observation';
    if (targetId && targetKind === 'observation') suppressedIds.add(targetId);
  }

  return scoped.flatMap((observation): RecordedExperienceEvent[] => {
    if (suppressedIds.has(observation.id)
      || observation.policy?.sensitive
      || observation.visibility === 'private') return [];
    const event = parseExperienceEvent(observation.content?.body);
    return event ? [{ observation, event }] : [];
  });
}

function mergeTask(primary: ExperienceTask, fallback: ExperienceTask): ExperienceTask {
  return {
    key: primary.key,
    ...(primary.title ?? fallback.title ? { title: primary.title ?? fallback.title } : {}),
    ...(primary.goal ?? fallback.goal ? { goal: primary.goal ?? fallback.goal } : {}),
    ...(primary.environment ?? fallback.environment ? { environment: primary.environment ?? fallback.environment } : {}),
    tags: [...new Set([...primary.tags, ...fallback.tags])],
  };
}

function deriveLessons(observations: EvidenceObservation[], scope: string): ExperienceLesson[] {
  const events = effectiveExperienceEvents(observations, scope);
  const attempts = new Map<string, RecordedExperienceEvent>();
  for (const recorded of events) {
    if (recorded.event.event === 'attempt_finished' && recorded.event.attempt) {
      attempts.set(recorded.event.attempt.id, recorded);
    }
  }

  const lessons = new Map<string, MutableLesson>();
  for (const recorded of events) {
    const attempt = recorded.event.attempt;
    if (recorded.event.event !== 'attempt_finished'
      || !attempt
      || attempt.status !== 'failure'
      || !attempt.recommended_action) continue;
    const id = lessonId(scope, recorded.event.task.key, attempt.recommended_action);
    const observedAt = recorded.observation.source?.observed_at ?? new Date(0).toISOString();
    const actorId = recorded.observation.source?.actor?.id;
    lessons.set(id, {
      id,
      scope,
      task: recorded.event.task,
      instruction: attempt.recommended_action,
      applies_when: attempt.applies_when
        ?? recorded.event.task.goal
        ?? recorded.event.task.title
        ?? `Working on ${recorded.event.task.key}`,
      failure: attempt.summary,
      ...(attempt.error_signature ? { error_signature: attempt.error_signature } : {}),
      feedback: attempt.reflection ?? 'The agent proposed this lesson after reviewing its failed attempt.',
      evidence_observation_ids: [recorded.observation.id],
      learned_from_actor_ids: actorId ? [actorId] : [],
      failure_count: 1,
      success_count: 0,
      origin: 'agent_reflection',
      validation_status: 'candidate',
      confidence: 0,
      utility_score: 0,
      learned_at: observedAt,
      failed_attempt_ids: new Set([attempt.id]),
      successful_attempt_ids: new Set(),
    });
  }

  for (const recorded of events) {
    const feedback = recorded.event;
    if (feedback.event !== 'feedback_received'
      || !feedback.attempt_id
      || !feedback.feedback
      || !feedback.recommended_action) continue;
    const failed = attempts.get(feedback.attempt_id);
    const attempt = failed?.event.attempt;
    if (!failed || !attempt || attempt.status !== 'failure' || failed.event.task.key !== feedback.task.key) continue;

    const id = lessonId(scope, feedback.task.key, feedback.recommended_action);
    const actorIds = [
      failed.observation.source?.actor?.id,
      recorded.observation.source?.actor?.id,
    ].filter((actorId): actorId is string => Boolean(actorId));
    const evidenceIds = [
      failed.observation.id,
      recorded.observation.id,
    ];
    const observedAt = recorded.observation.source?.observed_at ?? new Date(0).toISOString();
    const existing = lessons.get(id);
    if (existing) {
      existing.failed_attempt_ids.add(attempt.id);
      existing.failure_count = existing.failed_attempt_ids.size;
      existing.evidence_observation_ids = [...new Set([...existing.evidence_observation_ids, ...evidenceIds])];
      existing.learned_from_actor_ids = [...new Set([...existing.learned_from_actor_ids, ...actorIds])];
      existing.origin = 'user_feedback';
      existing.feedback = feedback.feedback;
      existing.applies_when = feedback.applies_when ?? existing.applies_when;
      existing.task = mergeTask(feedback.task, existing.task);
      if (observedAt > existing.learned_at) existing.learned_at = observedAt;
      continue;
    }

    lessons.set(id, {
      id,
      scope,
      task: mergeTask(feedback.task, failed.event.task),
      instruction: feedback.recommended_action,
      applies_when: feedback.applies_when
        ?? feedback.task.goal
        ?? feedback.task.title
        ?? `Working on ${feedback.task.key}`,
      failure: attempt.summary,
      ...(attempt.error_signature ? { error_signature: attempt.error_signature } : {}),
      feedback: feedback.feedback,
      evidence_observation_ids: [...new Set(evidenceIds)],
      learned_from_actor_ids: [...new Set(actorIds)],
      failure_count: 1,
      success_count: 0,
      origin: 'user_feedback',
      validation_status: 'candidate',
      confidence: 0,
      utility_score: 0,
      learned_at: observedAt,
      failed_attempt_ids: new Set([attempt.id]),
      successful_attempt_ids: new Set(),
    });
  }

  for (const recorded of events) {
    const attempt = recorded.event.attempt;
    if (recorded.event.event !== 'attempt_finished' || !attempt || attempt.status !== 'success') continue;
    for (const id of attempt.applied_lesson_ids) {
      const lesson = lessons.get(id);
      if (!lesson || lesson.task.key !== recorded.event.task.key) continue;
      lesson.successful_attempt_ids.add(attempt.id);
      lesson.success_count = lesson.successful_attempt_ids.size;
      lesson.validation_status = 'validated';
      lesson.last_validated_at = recorded.observation.source?.observed_at ?? new Date(0).toISOString();
      lesson.last_applied_at = lesson.last_validated_at;
      lesson.evidence_observation_ids = [...new Set([...lesson.evidence_observation_ids, recorded.observation.id])];
      const actorId = recorded.observation.source?.actor?.id;
      if (actorId) lesson.learned_from_actor_ids = [...new Set([...lesson.learned_from_actor_ids, actorId])];
    }
  }

  const generatedAt = Date.now();
  return [...lessons.values()]
    .map(({ failed_attempt_ids: _failed, successful_attempt_ids: _successful, ...lesson }) => {
      const baseConfidence = lesson.origin === 'user_feedback' ? 0.65 : 0.4;
      const confidence = Math.min(0.98,
        baseConfidence
        + Math.min(0.15, Math.max(0, lesson.failure_count - 1) * 0.05)
        + Math.min(0.3, lesson.success_count * 0.15));
      const applications = lesson.success_count + lesson.failure_count;
      const observedUtility = (lesson.success_count + 1) / (applications + 2);
      const ageDays = Math.max(0, (generatedAt - Date.parse(lesson.last_applied_at ?? lesson.learned_at)) / 86_400_000);
      const ageDecay = Math.pow(0.5, ageDays / 365);
      return {
        ...lesson,
        confidence: Number(confidence.toFixed(3)),
        utility_score: Number((confidence * observedUtility * ageDecay).toFixed(3)),
      };
    })
    .sort((a, b) => b.utility_score - a.utility_score || b.learned_at.localeCompare(a.learned_at))
    .slice(0, MAX_LESSONS_PER_SCOPE);
}

export async function compileExperienceProjection(env: CoffeePodEnv, scope: string): Promise<ExperienceProjection> {
  const projection: ExperienceProjection = {
    version: 1,
    scope,
    generated_at: new Date().toISOString(),
    lessons: deriveLessons(await readEvidence(env), scope),
  };
  const filePath = projectionPath(env, scope);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(projection, null, 2)}\n`, 'utf8');
  return projection;
}

async function readExperienceProjection(env: CoffeePodEnv, scope: string): Promise<ExperienceProjection> {
  try {
    const parsed = JSON.parse(await readFile(projectionPath(env, scope), 'utf8')) as ExperienceProjection;
    if (parsed.version === 1 && parsed.scope === scope && Array.isArray(parsed.lessons)) return parsed;
  } catch {
    // Missing or disposable derived state is rebuilt from canonical evidence.
  }
  return compileExperienceProjection(env, scope);
}

export async function listExperienceLessons(env: CoffeePodEnv, scopes: string[]): Promise<ExperienceLesson[]> {
  const projections = await Promise.all([...new Set(scopes)].map(scope => readExperienceProjection(env, scope)));
  return projections
    .flatMap(projection => projection.lessons)
    .sort((a, b) => b.utility_score - a.utility_score || b.learned_at.localeCompare(a.learned_at));
}

function searchTokens(value: string): Set<string> {
  return new Set(value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 3 && !STOP_WORDS.has(token)));
}

function relevanceScore(lesson: ExperienceLesson, query: string, task?: ExperienceTaskQuery): number {
  let score = 0;
  if (task?.key && task.key.toLowerCase() === lesson.task.key.toLowerCase()) score += 100;
  if (task?.environment && lesson.task.environment
    && task.environment.toLowerCase() === lesson.task.environment.toLowerCase()) score += 20;

  const requestedTags = new Set((task?.tags ?? []).map(tag => tag.toLowerCase()));
  for (const tag of lesson.task.tags) {
    if (requestedTags.has(tag.toLowerCase())) score += 10;
  }

  const needle = searchTokens([
    query,
    task?.key ?? '',
    task?.goal ?? '',
    task?.environment ?? '',
    ...(task?.tags ?? []),
  ].join(' '));
  const haystack = searchTokens([
    lesson.task.key,
    lesson.task.title ?? '',
    lesson.task.goal ?? '',
    lesson.task.environment ?? '',
    ...lesson.task.tags,
    lesson.applies_when,
    lesson.failure,
    lesson.error_signature ?? '',
    lesson.instruction,
  ].join(' '));
  for (const token of needle) {
    if (haystack.has(token)) score += 3;
  }
  if (lesson.validation_status === 'validated' && score > 0) score += 5;
  if (score > 0) score += Math.round(lesson.utility_score * 20);
  return score;
}

export async function findApplicableLessons(
  env: CoffeePodEnv,
  scopes: string[],
  input: { query?: string; task?: ExperienceTaskQuery; limit?: number },
): Promise<ApplicableExperienceLesson[]> {
  const query = typeof input.query === 'string' ? input.query.trim() : '';
  const task = input.task;
  if (!query && !task?.key && !task?.goal && !task?.environment && !(task?.tags?.length)) return [];

  const projections = await Promise.all(scopes.map(scope => readExperienceProjection(env, scope)));
  return projections
    .flatMap(projection => projection.lessons)
    .map(lesson => ({ ...lesson, relevance_score: relevanceScore(lesson, query, task) }))
    .filter(lesson => lesson.relevance_score > 0)
    .sort((a, b) => b.relevance_score - a.relevance_score || b.learned_at.localeCompare(a.learned_at))
    .slice(0, input.limit ?? 8);
}
