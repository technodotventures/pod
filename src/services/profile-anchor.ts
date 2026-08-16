import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SmartwareKnowledgeGraphSnapshot } from 'smartware';
import type { CoffeePodEnv } from '../config/env.js';
import type { PodScopeAlias } from '../pod/types.js';
import type { WatchEvent } from './watch-events.js';
import { publishWatchEvent } from './watch-events.js';

export type ProfileFactCategory = 'identity' | 'preference' | 'instruction' | 'trait';

export interface ProfileFact {
  id: string;
  category: ProfileFactCategory;
  text: string;
  source_ids: string[];
  observed_at: string;
  scope: string;
  source_app?: string;
  origin: 'claim' | 'observation' | 'correction';
  confidence?: number;
}

export interface SelfProfile {
  profile_id: 'self';
  path: string;
  scope: string;
  summary: string;
  facts: ProfileFact[];
  created_at: string;
  updated_at: string;
  version: number;
}

interface ProfileObservation {
  id: string;
  type: string;
  status: string;
  scope: string;
  source?: {
    app?: string;
    actor?: { id?: string; display_name?: string };
    observed_at?: string;
  };
  policy?: {
    sensitive?: boolean;
  };
  content?: {
    body?: unknown;
  };
}

interface ProfileCorrection {
  kind: 'profile_correction';
  action: 'add' | 'replace' | 'remove';
  target_fact_id?: string;
  text?: string;
  category?: ProfileFactCategory;
}

interface PodProfileLike {
  scopes: Record<PodScopeAlias, string>;
}

export interface SelfProfileResult extends SelfProfile {
  sources: string[];
  bytes: number;
  event: WatchEvent;
}

/**
 * A profile is a cross-task anchor, but each fact keeps the authorization
 * boundary of the evidence that produced it. This lets an agent carry an
 * authorized peer card across task scopes without leaking a fact from a data
 * space it cannot otherwise read.
 */
export function filterSelfProfileByScopes(
  profile: SelfProfile,
  allowedScopeIds: Iterable<string>,
): SelfProfile {
  const allowed = new Set(allowedScopeIds);
  const facts = profile.facts.filter(fact => allowed.has(fact.scope));
  return {
    ...profile,
    facts,
    summary: facts.length === 0
      ? 'Pod has not learned any profile facts visible to this client.'
      : `${facts.length} authorized profile fact${facts.length === 1 ? '' : 's'} available to this client.`,
  };
}

const PROFILE_MAX_FACTS = 40;
const PROFILE_BUDGET_CHARS = 4_800;
const PROFILE_CATEGORY_ORDER: ProfileFactCategory[] = ['identity', 'preference', 'instruction', 'trait'];
const PROFILE_CATEGORY_LABELS: Record<ProfileFactCategory, string> = {
  identity: 'Identity',
  preference: 'Preferences',
  instruction: 'Instructions',
  trait: 'Traits',
};

function unwrapBody(value: unknown): unknown {
  if (value && typeof value === 'object' && 'format' in value && 'body' in value) {
    return (value as { body: unknown }).body;
  }
  return value;
}

function bodyText(value: unknown): string {
  const unwrapped = unwrapBody(value);
  if (typeof unwrapped === 'string') return unwrapped;
  return '';
}

function compactLine(value: string): string {
  return value
    .replace(/^profile-correction\s*:\s*/i, '')
    .replace(/^(identity|preference|instruction|trait)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function isProfileFactCategory(value: unknown): value is ProfileFactCategory {
  return typeof value === 'string' && PROFILE_CATEGORY_ORDER.includes(value as ProfileFactCategory);
}

function parseCorrection(value: unknown): ProfileCorrection | null {
  const unwrapped = unwrapBody(value);
  if (!unwrapped || typeof unwrapped !== 'object') return null;
  const candidate = unwrapped as Record<string, unknown>;
  if (candidate['kind'] !== 'profile_correction') return null;
  const action = candidate['action'];
  if (action !== 'add' && action !== 'replace' && action !== 'remove') return null;
  return {
    kind: 'profile_correction',
    action,
    ...(typeof candidate['target_fact_id'] === 'string' ? { target_fact_id: candidate['target_fact_id'] } : {}),
    ...(typeof candidate['text'] === 'string' ? { text: candidate['text'] } : {}),
    ...(isProfileFactCategory(candidate['category']) ? { category: candidate['category'] } : {}),
  };
}

function classifyProfileText(value: string, observationType?: string): ProfileFactCategory | null {
  const text = value.trim();
  if (/^identity\s*:/i.test(text)) return 'identity';
  if (/^preference\s*:/i.test(text)) return 'preference';
  if (/^instruction\s*:/i.test(text)) return 'instruction';
  if (/^trait\s*:/i.test(text)) return 'trait';
  if (/\b(my name is|call me|i work (?:as|at|for)|i live (?:in|at)|my (?:role|job|timezone|location) is)\b/i.test(text)) return 'identity';
  if (/\b(always|never|do not|don't|address me|reply to me|when you (?:answer|respond))\b/i.test(text)) return 'instruction';
  if (/\b(i prefer|prefer(?:s|ence)?|i like|i want|works best for me|my preferred)\b/i.test(text)) return 'preference';
  if (/\b(i am|i'm)\s+(?:detail-oriented|direct|concise|analytical|visual|pragmatic|creative|technical|non-technical)\b/i.test(text)) return 'trait';
  if (observationType === 'preference') return 'preference';
  return null;
}

export function observationMayAffectProfile(type: string | undefined, content: unknown): boolean {
  if (parseCorrection(content)) return true;
  const text = bodyText(content);
  return Boolean(text && classifyProfileText(text, type));
}

async function readObservations(env: CoffeePodEnv): Promise<ProfileObservation[]> {
  const evidenceDir = path.join(env.dataDir, 'evidence');
  let files: string[];
  try {
    files = await readdir(evidenceDir);
  } catch {
    return [];
  }

  const observations: ProfileObservation[] = [];
  for (const file of files.filter(name => name.endsWith('.jsonl')).sort()) {
    const raw = await readFile(path.join(evidenceDir, file), 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      observations.push(JSON.parse(line) as ProfileObservation);
    }
  }
  return observations;
}

function selfProfilePath(env: CoffeePodEnv): string {
  return path.join(env.dataDir, 'wiki', 'profiles', 'self.md');
}

async function readProfileMetadata(filePath: string): Promise<{ created_at?: string; updated_at?: string; version: number }> {
  try {
    const raw = await readFile(filePath, 'utf8');
    const created = raw.match(/^created:\s*"?([^"\n]+)"?$/m)?.[1];
    const updated = raw.match(/^updated:\s*"?([^"\n]+)"?$/m)?.[1];
    const version = Number(raw.match(/^version:\s*(\d+)$/m)?.[1] ?? 0);
    return { created_at: created, updated_at: updated, version };
  } catch {
    return { version: 0 };
  }
}

function claimFacts(knowledge?: SmartwareKnowledgeGraphSnapshot): ProfileFact[] {
  if (!knowledge) return [];
  const selfNames = new Set(['self', 'user', 'owner', 'pod owner', 'person-local']);
  return knowledge.claims.flatMap((claim): ProfileFact[] => {
    const isPreference = claim.predicate === 'preference_is';
    const isSelfIdentity = selfNames.has(claim.subject_name.trim().toLowerCase())
      && ['description_is', 'located_in', 'type_is'].includes(claim.predicate);
    if (!isPreference && !isSelfIdentity) return [];
    const raw = typeof claim.object.value === 'string'
      ? claim.object.value
      : JSON.stringify(claim.object.value);
    const text = compactLine(raw);
    if (!text) return [];
    return [{
      id: claim.claim_id,
      category: isPreference ? 'preference' : 'identity',
      text,
      source_ids: claim.provenance.observation_ids,
      observed_at: claim.created_at,
      scope: claim.scope,
      origin: 'claim',
      confidence: claim.confidence,
    }];
  });
}

function observationFact(obs: ProfileObservation): ProfileFact | null {
  const textValue = bodyText(obs.content?.body);
  const category = classifyProfileText(textValue, obs.type);
  const text = compactLine(textValue);
  if (!category || !text) return null;
  return {
    id: obs.id,
    category,
    text,
    source_ids: [obs.id],
    observed_at: obs.source?.observed_at ?? new Date(0).toISOString(),
    scope: obs.scope,
    source_app: obs.source?.app,
    origin: /^profile-correction\s*:/i.test(textValue) ? 'correction' : 'observation',
  };
}

function correctionFact(obs: ProfileObservation, correction: ProfileCorrection): ProfileFact | null {
  if (correction.action === 'remove') return null;
  const text = compactLine(correction.text ?? '');
  const category = correction.category ?? classifyProfileText(text, 'preference');
  if (!category || !text) return null;
  return {
    id: obs.id,
    category,
    text,
    source_ids: [obs.id],
    observed_at: obs.source?.observed_at ?? new Date().toISOString(),
    scope: obs.scope,
    source_app: obs.source?.app,
    origin: 'correction',
  };
}

function selectFacts(
  observations: ProfileObservation[],
  profile: PodProfileLike,
  knowledge?: SmartwareKnowledgeGraphSnapshot,
): ProfileFact[] {
  const scopes = new Set(Object.values(profile.scopes));
  const scoped = observations
    .filter(obs => obs.status === 'accepted' && scopes.has(obs.scope) && !obs.policy?.sensitive);
  const suppressedObservationIds = new Set<string>();
  for (const obs of scoped) {
    if (obs.type !== 'tombstone' && obs.type !== 'redaction') continue;
    const body = unwrapBody(obs.content?.body);
    if (!body || typeof body !== 'object') continue;
    const targetId = (body as Record<string, unknown>)['target_id'];
    const targetKind = (body as Record<string, unknown>)['target_kind'] ?? 'observation';
    if (typeof targetId === 'string' && targetKind === 'observation') suppressedObservationIds.add(targetId);
  }

  const byId = new Map<string, ProfileFact>();
  const backedObservationIds = new Set<string>();
  for (const fact of claimFacts(knowledge)) {
    byId.set(fact.id, fact);
    for (const sourceId of fact.source_ids) backedObservationIds.add(sourceId);
  }

  for (const obs of scoped) {
    if (suppressedObservationIds.has(obs.id)) continue;
    const correction = parseCorrection(obs.content?.body);
    if (correction) {
      if (correction.target_fact_id) byId.delete(correction.target_fact_id);
      const fact = correctionFact(obs, correction);
      if (fact) byId.set(fact.id, fact);
      continue;
    }
    if (backedObservationIds.has(obs.id)) continue;
    const fact = observationFact(obs);
    if (fact) byId.set(fact.id, fact);
  }

  const deduped = new Map<string, ProfileFact>();
  for (const fact of [...byId.values()].sort((a, b) => a.observed_at.localeCompare(b.observed_at))) {
    const key = `${fact.category}:${fact.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
    deduped.delete(key);
    deduped.set(key, fact);
  }

  const selected: ProfileFact[] = [];
  let usedChars = 0;
  for (const fact of [...deduped.values()].sort((a, b) => b.observed_at.localeCompare(a.observed_at))) {
    if (selected.length >= PROFILE_MAX_FACTS) break;
    if (usedChars + fact.text.length > PROFILE_BUDGET_CHARS) continue;
    selected.push(fact);
    usedChars += fact.text.length;
  }
  return selected;
}

function renderProfileMarkdown(profile: SelfProfile): string {
  const lines = [
    '---',
    'title: "Self profile"',
    'page_id: "page_self"',
    'category: "profile"',
    'author: "agent"',
    'scope: "self"',
    `created: "${profile.created_at.slice(0, 10)}"`,
    `updated: "${profile.updated_at.slice(0, 10)}"`,
    `summary: ${JSON.stringify(profile.summary)}`,
    `version: ${profile.version}`,
    `observation_count: ${profile.facts.length}`,
    '---',
    '',
    '# Self profile',
    '',
    'The compact, source-backed context Pod carries into owner-facing conversations.',
    '',
  ];

  if (profile.facts.length === 0) {
    lines.push('No stable profile facts have been observed yet.', '');
    return lines.join('\n');
  }

  for (const category of PROFILE_CATEGORY_ORDER) {
    const facts = profile.facts.filter(fact => fact.category === category);
    if (facts.length === 0) continue;
    lines.push(`## ${PROFILE_CATEGORY_LABELS[category]}`, '');
    for (const fact of facts) {
      lines.push(`- ${fact.text}`);
      lines.push(`  - Evidence: ${fact.source_ids.join(', ')} · observed ${fact.observed_at}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function buildSelfProfile(
  env: CoffeePodEnv,
  profile: PodProfileLike,
  knowledge: SmartwareKnowledgeGraphSnapshot | undefined,
  incrementVersion: boolean,
): Promise<SelfProfile> {
  const filePath = selfProfilePath(env);
  const metadata = await readProfileMetadata(filePath);
  const observations = await readObservations(env);
  const facts = selectFacts(observations, profile, knowledge);
  const now = new Date().toISOString();
  const updatedAt = incrementVersion ? now : metadata.updated_at ?? now;
  const createdAt = metadata.created_at
    ? `${metadata.created_at}T00:00:00.000Z`
    : updatedAt;
  return {
    profile_id: 'self',
    path: filePath,
    scope: profile.scopes.personal,
    summary: facts.length === 0
      ? 'Pod has not learned any stable profile facts yet.'
      : `${facts.length} stable fact${facts.length === 1 ? '' : 's'} Pod carries into owner-facing conversations.`,
    facts,
    created_at: createdAt,
    updated_at: updatedAt,
    version: Math.max(1, metadata.version + (incrementVersion ? 1 : 0)),
  };
}

export async function readSelfProfile(
  env: CoffeePodEnv,
  profile: PodProfileLike,
  knowledge?: SmartwareKnowledgeGraphSnapshot,
): Promise<SelfProfile | null> {
  try {
    await readFile(selfProfilePath(env), 'utf8');
  } catch {
    return null;
  }
  return buildSelfProfile(env, profile, knowledge, false);
}

export async function reflectSelfProfile(
  env: CoffeePodEnv,
  profile: PodProfileLike,
  knowledge?: SmartwareKnowledgeGraphSnapshot,
): Promise<SelfProfileResult> {
  const selfProfile = await buildSelfProfile(env, profile, knowledge, true);
  const markdown = renderProfileMarkdown(selfProfile);
  await mkdir(path.dirname(selfProfile.path), { recursive: true });
  await writeFile(selfProfile.path, `${markdown.trimEnd()}\n`, 'utf8');
  const sources = [...new Set(selfProfile.facts.flatMap(fact => fact.source_ids))];
  const event = publishWatchEvent({
    type: 'compile',
    scope: profile.scopes.personal,
    target: 'profile:self',
    payload: {
      profile_id: 'self',
      path: selfProfile.path,
      sources,
      fact_count: selfProfile.facts.length,
    },
  });
  return {
    ...selfProfile,
    sources,
    bytes: Buffer.byteLength(markdown, 'utf8'),
    event,
  };
}
