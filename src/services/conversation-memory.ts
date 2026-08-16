import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { CoffeePodEnv } from '../config/env.js';

export interface ConversationMessage {
  kind: 'conversation_message';
  source: string;
  conversation_id: string;
  message_id: string;
  text: string;
  actor_id: string;
  actor_name?: string;
  channel_id?: string;
  channel_name?: string;
  occurred_at?: string;
  reactions_count: number;
  /** True when the message was authored by the Pod owner. */
  authored_by_owner?: boolean;
  /** Direction is useful for conversational sources such as email. */
  direction?: 'inbound' | 'outbound';
  /** Human-readable subject for sources that are not channel based. */
  subject?: string;
}

export interface ConversationParticipant {
  actor_id: string;
  actor_name?: string;
  message_count: number;
}

export interface ConversationBurst {
  actor_id: string;
  actor_name?: string;
  text: string;
  reasons: Array<'detailed' | 'endorsed' | 'distinctive'>;
  evidence_observation_ids: string[];
}

export interface ConversationArtifact {
  id: string;
  scope: string;
  source: string;
  conversation_id: string;
  title: string;
  question: string;
  question_actor_id: string;
  question_observation_id: string;
  summary: string;
  resolution: string | null;
  resolution_actor_id: string | null;
  resolution_observation_id: string | null;
  code_refs: string[];
  participants: ConversationParticipant[];
  bursts: ConversationBurst[];
  message_count: number;
  started_at: string;
  ended_at: string;
  evidence_observation_ids: string[];
}

export interface ConversationProjection {
  version: 1;
  scope: string;
  generated_at: string;
  conversations: ConversationArtifact[];
}

export interface ConversationMatch extends ConversationArtifact {
  text: string;
  relevance_score: number;
}

interface EvidenceObservation {
  id: string;
  type: string;
  status: string;
  scope: string;
  visibility?: string;
  source?: {
    app?: string;
    source_id?: string | null;
    actor?: { id?: string };
    observed_at?: string;
  };
  content?: { body?: unknown };
  policy?: { sensitive?: boolean };
}

interface RecordedMessage {
  observation: EvidenceObservation;
  message: ConversationMessage;
  occurred_at: string;
}

const MAX_FIELD_LENGTH = 4_000;
const MAX_CONVERSATIONS_PER_SCOPE = 1_000;
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'before', 'being', 'could', 'from', 'have', 'into',
  'should', 'that', 'their', 'there', 'these', 'this', 'those', 'when', 'where',
  'which', 'with', 'would', 'your', 'what', 'will', 'just', 'then', 'than',
]);
const RESOLUTION_PATTERN = /\b(resolved|fixed|solution|decided|decision|we(?:'ll| will) use|works now|completed|root cause|the fix|done)\b/i;

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

function validDate(value: unknown): string | undefined {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : undefined;
}

export function parseConversationMessage(value: unknown): ConversationMessage | null {
  const body = asRecord(unwrapContent(value));
  if (!body || body['kind'] !== 'conversation_message') return null;
  const source = boundedString(body['source'], 80);
  const conversationId = boundedString(body['conversation_id'], 500);
  const messageId = boundedString(body['message_id'], 500);
  const text = boundedString(body['text']);
  const actorId = boundedString(body['actor_id'], 500);
  if (!source || !conversationId || !messageId || !text || !actorId) return null;
  const actorName = boundedString(body['actor_name'], 500);
  const channelId = boundedString(body['channel_id'], 500);
  const channelName = boundedString(body['channel_name'], 500);
  const reactionsCount = typeof body['reactions_count'] === 'number' && Number.isFinite(body['reactions_count'])
    ? Math.max(0, Math.floor(body['reactions_count']))
    : 0;
  return {
    kind: 'conversation_message',
    source,
    conversation_id: conversationId,
    message_id: messageId,
    text,
    actor_id: actorId,
    ...(actorName ? { actor_name: actorName } : {}),
    ...(channelId ? { channel_id: channelId } : {}),
    ...(channelName ? { channel_name: channelName } : {}),
    ...(validDate(body['occurred_at']) ? { occurred_at: body['occurred_at'] as string } : {}),
    ...(typeof body['authored_by_owner'] === 'boolean' ? { authored_by_owner: body['authored_by_owner'] } : {}),
    ...(body['direction'] === 'inbound' || body['direction'] === 'outbound'
      ? { direction: body['direction'] }
      : {}),
    ...(boundedString(body['subject'], 1_000) ? { subject: boundedString(body['subject'], 1_000)! } : {}),
    reactions_count: reactionsCount,
  };
}

export function conversationMessageContent(input: Omit<ConversationMessage, 'kind' | 'reactions_count'> & { reactions_count?: number }): ConversationMessage {
  return {
    kind: 'conversation_message',
    ...input,
    reactions_count: Math.max(0, Math.floor(input.reactions_count ?? 0)),
  };
}

export function slackTimestampToIso(timestamp: string): string | undefined {
  const seconds = Number.parseFloat(timestamp);
  if (!Number.isFinite(seconds)) return undefined;
  return new Date(seconds * 1_000).toISOString();
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
      try {
        observations.push(JSON.parse(line) as EvidenceObservation);
      } catch {
        // One malformed line must not prevent rebuilding other conversations.
      }
    }
  }
  return observations;
}

function projectionPath(env: CoffeePodEnv, scope: string): string {
  const slug = scope.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120);
  const suffix = createHash('sha256').update(scope).digest('hex').slice(0, 10);
  return path.join(env.dataDir, 'derived', 'retrieval', 'conversations', `${slug}-${suffix}.json`);
}

function artifactId(scope: string, source: string, conversationId: string): string {
  const fingerprint = `${scope}\u0000${source}\u0000${conversationId}`;
  return `conversation_${createHash('sha256').update(fingerprint).digest('hex').slice(0, 24)}`;
}

function effectiveMessages(observations: EvidenceObservation[], scope: string): RecordedMessage[] {
  const scoped = observations.filter(observation => observation.scope === scope && observation.status === 'accepted');
  const suppressedIds = new Set<string>();
  for (const observation of scoped) {
    if (observation.type !== 'tombstone' && observation.type !== 'redaction') continue;
    const body = asRecord(unwrapContent(observation.content?.body));
    const targetId = boundedString(body?.['target_id'], 500);
    if (targetId && (body?.['target_kind'] ?? 'observation') === 'observation') suppressedIds.add(targetId);
  }

  return scoped.flatMap((observation): RecordedMessage[] => {
    if (suppressedIds.has(observation.id)
      || observation.policy?.sensitive
      || observation.visibility === 'private') return [];
    const message = parseConversationMessage(observation.content?.body)
      ?? parseLegacySlackMessage(observation);
    if (!message) return [];
    return [{
      observation,
      message,
      occurred_at: message.occurred_at ?? observation.source?.observed_at ?? new Date(0).toISOString(),
    }];
  });
}

function parseLegacySlackMessage(observation: EvidenceObservation): ConversationMessage | null {
  if (observation.type !== 'message' || observation.source?.app !== 'slack') return null;
  const text = boundedString(unwrapContent(observation.content?.body));
  const sourceId = observation.source.source_id;
  if (!text || !sourceId) return null;
  const syncMatch = /^slack:([^:]+):(.+)$/.exec(sourceId);
  const webhookMatch = /^([^.]+)\.(.+)$/.exec(sourceId);
  const channelId = syncMatch?.[1] ?? webhookMatch?.[1];
  const messageId = syncMatch?.[2] ?? webhookMatch?.[2];
  if (!channelId || !messageId) return null;
  const channelName = /^\[#([^\]]+)\]\s*/.exec(text)?.[1];
  return {
    kind: 'conversation_message',
    source: 'slack',
    conversation_id: `${channelId}:${messageId}`,
    message_id: messageId,
    text: text.replace(/^\[#[^\]]+\]\s*/, ''),
    actor_id: 'unknown:slack',
    ...(channelId ? { channel_id: channelId } : {}),
    ...(channelName ? { channel_name: channelName } : {}),
    ...(observation.source.observed_at ? { occurred_at: observation.source.observed_at } : {}),
    reactions_count: 0,
  };
}

function excerpt(text: string, maxLength = 360): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function searchTokens(value: string): Set<string> {
  return new Set(value
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/)
    .filter(token => token.length >= 3 && !STOP_WORDS.has(token)));
}

function extractCodeRefs(messages: RecordedMessage[]): string[] {
  const refs: string[] = [];
  const patterns = [
    /`([^`\n]{2,120})`/g,
    /\b(?:ERR_[A-Z0-9_]+|[A-Z][A-Z0-9_]{4,}|[\w.-]+\/(?:[\w.-]+\/)*[\w.-]+\.[a-z0-9]{1,8})\b/g,
    /https?:\/\/[^\s<>]+/g,
  ];
  for (const { message } of messages) {
    for (const pattern of patterns) {
      for (const match of message.text.matchAll(pattern)) refs.push((match[1] ?? match[0]).replace(/[.,;)]+$/, ''));
    }
  }
  return [...new Set(refs)].slice(0, 30);
}

function deriveBursts(messages: RecordedMessage[]): ConversationBurst[] {
  const documentFrequency = new Map<string, number>();
  for (const recorded of messages) {
    for (const token of searchTokens(recorded.message.text)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const grouped: RecordedMessage[][] = [];
  for (const recorded of messages) {
    const current = grouped.at(-1);
    if (current?.[0]?.message.actor_id === recorded.message.actor_id) current.push(recorded);
    else grouped.push([recorded]);
  }

  return grouped.flatMap((group): ConversationBurst[] => {
    const text = group.map(recorded => recorded.message.text).join('\n');
    const reactions = Math.max(...group.map(recorded => recorded.message.reactions_count), 0);
    const distinctiveTokens = [...searchTokens(text)].filter(token => (documentFrequency.get(token) ?? 0) <= 1);
    const reasons: ConversationBurst['reasons'] = [];
    if (text.length >= 160) reasons.push('detailed');
    if (reactions >= 3) reasons.push('endorsed');
    if (text.length >= 80 && distinctiveTokens.length >= 3) reasons.push('distinctive');
    if (reasons.length === 0) return [];
    return [{
      actor_id: group[0]!.message.actor_id,
      ...(group[0]!.message.actor_name ? { actor_name: group[0]!.message.actor_name } : {}),
      text: excerpt(text, 800),
      reasons,
      evidence_observation_ids: group.map(recorded => recorded.observation.id),
    }];
  }).slice(0, 5);
}

function deriveConversations(observations: EvidenceObservation[], scope: string): ConversationArtifact[] {
  const grouped = new Map<string, RecordedMessage[]>();
  for (const recorded of effectiveMessages(observations, scope)) {
    const key = `${recorded.message.source}\u0000${recorded.message.conversation_id}`;
    const group = grouped.get(key) ?? [];
    group.push(recorded);
    grouped.set(key, group);
  }

  return [...grouped.values()].map((messages): ConversationArtifact => {
    messages.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.message.message_id.localeCompare(b.message.message_id));
    const first = messages[0]!;
    const last = messages.at(-1)!;
    const question = messages.find(recorded => recorded.message.text.includes('?')) ?? first;
    const resolution = [...messages].reverse().find(recorded => RESOLUTION_PATTERN.test(recorded.message.text))
      ?? [...messages].reverse().find(recorded => recorded.message.authored_by_owner === true);
    const summaryParts = [excerpt(first.message.text)];
    if (last !== first) summaryParts.push(excerpt(last.message.text));
    const participantCounts = new Map<string, ConversationParticipant>();
    for (const { message } of messages) {
      const existing = participantCounts.get(message.actor_id);
      if (existing) existing.message_count += 1;
      else participantCounts.set(message.actor_id, {
        actor_id: message.actor_id,
        ...(message.actor_name ? { actor_name: message.actor_name } : {}),
        message_count: 1,
      });
    }
    const channelName = first.message.channel_name;
    const isEmail = messages.some(recorded => recorded.message.direction !== undefined)
      || first.message.source === 'gmail'
      || first.message.source === 'icloud-mail';
    const title = first.message.subject ?? channelName;
    return {
      id: artifactId(scope, first.message.source, first.message.conversation_id),
      scope,
      source: first.message.source,
      conversation_id: first.message.conversation_id,
      title: title
        ? (isEmail ? `Email · ${title}` : `#${title}`)
        : `${first.message.source} conversation`,
      question: excerpt(question.message.text),
      question_actor_id: question.message.actor_id,
      question_observation_id: question.observation.id,
      summary: summaryParts.join('\n…\n'),
      resolution: resolution ? excerpt(resolution.message.text) : null,
      resolution_actor_id: resolution?.message.actor_id ?? null,
      resolution_observation_id: resolution?.observation.id ?? null,
      code_refs: extractCodeRefs(messages),
      participants: [...participantCounts.values()].sort((a, b) => b.message_count - a.message_count),
      bursts: deriveBursts(messages),
      message_count: messages.length,
      started_at: first.occurred_at,
      ended_at: last.occurred_at,
      evidence_observation_ids: messages.map(recorded => recorded.observation.id),
    };
  })
    .sort((a, b) => b.ended_at.localeCompare(a.ended_at))
    .slice(0, MAX_CONVERSATIONS_PER_SCOPE);
}

export async function compileConversationProjection(env: CoffeePodEnv, scope: string): Promise<ConversationProjection> {
  const projection: ConversationProjection = {
    version: 1,
    scope,
    generated_at: new Date().toISOString(),
    conversations: deriveConversations(await readEvidence(env), scope),
  };
  const filePath = projectionPath(env, scope);
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(tempPath, `${JSON.stringify(projection, null, 2)}\n`, 'utf8');
  await rename(tempPath, filePath);
  return projection;
}

export async function readConversationProjection(env: CoffeePodEnv, scope: string): Promise<ConversationProjection> {
  try {
    const parsed = JSON.parse(await readFile(projectionPath(env, scope), 'utf8')) as ConversationProjection;
    if (parsed.version === 1 && parsed.scope === scope && Array.isArray(parsed.conversations)) return parsed;
  } catch {
    // Missing or disposable derived state is rebuilt from canonical evidence.
  }
  return compileConversationProjection(env, scope);
}

function relevanceScore(conversation: ConversationArtifact, query: string): number {
  if (!query.trim()) return 1;
  const needle = searchTokens(query);
  if (needle.size === 0) return 0;
  const weightedFields: Array<[string, number]> = [
    [conversation.question, 5],
    [conversation.resolution ?? '', 6],
    [conversation.summary, 2],
    [conversation.title, 2],
    [conversation.code_refs.join(' '), 8],
    [conversation.bursts.map(burst => burst.text).join(' '), 3],
  ];
  let score = 0;
  for (const [value, weight] of weightedFields) {
    const haystack = searchTokens(value);
    for (const token of needle) if (haystack.has(token)) score += weight;
  }
  return score;
}

function conversationText(conversation: ConversationArtifact): string {
  return [
    `${conversation.title} · ${conversation.message_count} messages`,
    `Question: ${conversation.question}`,
    conversation.resolution ? `Resolution: ${conversation.resolution}` : `Latest context: ${excerpt(conversation.summary, 500)}`,
    conversation.code_refs.length > 0 ? `References: ${conversation.code_refs.join(', ')}` : '',
  ].filter(Boolean).join('\n');
}

export async function findConversationEvidence(
  env: CoffeePodEnv,
  scopes: string[],
  query: string,
  limit = 8,
): Promise<ConversationMatch[]> {
  const projections = await Promise.all([...new Set(scopes)].map(scope => readConversationProjection(env, scope)));
  return projections
    .flatMap(projection => projection.conversations)
    .map(conversation => ({
      ...conversation,
      text: conversationText(conversation),
      relevance_score: relevanceScore(conversation, query),
    }))
    .filter(conversation => conversation.relevance_score > 0)
    .sort((a, b) => b.relevance_score - a.relevance_score || b.ended_at.localeCompare(a.ended_at))
    .slice(0, limit);
}
