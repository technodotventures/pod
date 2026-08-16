import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import {
  getDb,
  getObject,
  upsertObject,
  listObjects,
  getCollection,
  upsertCollection,
  getSettings,
  setSettings,
  DEFAULT_WORKSPACE_ID,
} from '../pod/db.js';
import { requireActorAuth } from '../security/auth.js';
import { generateAskPodAnswer } from '../services/ask-pod.js';
import { resolveActiveAIProvider, requestProviderText } from '../services/ai-provider.js';
import { ensureWorkspaceScope, requestWorkspaceId } from './workspaces.js';
import { getSmartwareCore } from '../smartware/core.js';
import { resolveObservationDefaults } from '../services/memory-settings.js';
import { syncArtifactMemory } from '../services/artifact-memory.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const JOURNAL_COLLECTION_ID = 'journal';
const PROMPT_NAMESPACE = 'journal_prompt';

function journalId(date: string, workspaceId = DEFAULT_WORKSPACE_ID): string {
  const base = `journal_${date}`;
  return workspaceId === DEFAULT_WORKSPACE_ID ? base : `${workspaceId}:${base}`;
}

function ensureJournalCollection(db: ReturnType<typeof getDb>): void {
  if (!getCollection(db, JOURNAL_COLLECTION_ID)) {
    upsertCollection(db, {
      id: JOURNAL_COLLECTION_ID,
      name: 'Journal',
      description: 'Daily notes and reflections',
    });
  }
}

function humanDateTitle(date: string): string {
  const parts = date.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function extractMarkdown(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    const c = content as Record<string, unknown>;
    if (typeof c['markdown'] === 'string') return c['markdown'] as string;
    if (typeof c['text'] === 'string') return c['text'] as string;
  }
  return '';
}

function previewFromMarkdown(markdown: string): string {
  const cleaned = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#'));
  if (!cleaned) return '';
  return cleaned.length > 180 ? `${cleaned.slice(0, 177).trimEnd()}...` : cleaned;
}

interface JournalEntryRow {
  date: string;
  id: string;
  has_content: boolean;
  updated_at: string;
  preview: string;
  title: string;
}

function listJournalEntries(db: ReturnType<typeof getDb>, workspaceId = DEFAULT_WORKSPACE_ID): JournalEntryRow[] {
  const objects = listObjects(db, {
    workspaceId,
    collectionId: JOURNAL_COLLECTION_ID,
    kind: 'journal_entry',
    limit: 500,
  });
  return objects
    .map((obj) => {
      const markdown = extractMarkdown(obj.content);
      const journalPrefix = workspaceId === DEFAULT_WORKSPACE_ID ? 'journal_' : `${workspaceId}:journal_`;
      const date = obj.id.startsWith(journalPrefix) ? obj.id.slice(journalPrefix.length) : null;
      if (!date || !DATE_RE.test(date)) return null;
      return {
        date,
        id: obj.id,
        has_content: markdown.trim().length > 0,
        updated_at: obj.updated_at,
        preview: previewFromMarkdown(markdown),
        title: obj.title,
      } satisfies JournalEntryRow;
    })
    .filter((row): row is JournalEntryRow => row !== null);
}

/* ── Curated fallback prompts ── */

const CURATED_PROMPTS = [
  'What\'s one thing you noticed today that you want to remember?',
  'If today were the start of something, what would it be?',
  'What surprised you today, even a little?',
  'What\'s sitting on your mind right now?',
  'What did you learn this week worth keeping?',
  'What patterns are you noticing in yourself lately?',
  'If you could send one message to next week\'s you, what would it be?',
  'What did you give your attention to today, and was it worth it?',
  'What\'s a small win from today that\'s easy to overlook?',
  'What energised you today? What drained you?',
  'What feels unresolved? Even naming it helps.',
  'If today had a title, what would it be?',
];

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function rotationPrompt(date: string, recent: JournalEntryRow[]): { prompt: string; source: 'rotation' } {
  // If there's an entry from a previous month on the same day, surface it.
  const [, mm, dd] = date.split('-');
  const sameDayLastMonth = recent.find((row) => {
    if (row.date === date) return false;
    const [, rm, rd] = row.date.split('-');
    return rm !== mm && rd === dd && row.preview;
  });
  if (sameDayLastMonth) {
    const niceDate = humanDateTitle(sameDayLastMonth.date).split(',')[0];
    return { prompt: `On ${niceDate} you wrote: "${sameDayLastMonth.preview}". Where are you with that now?`, source: 'rotation' };
  }
  const idx = hashString(date) % CURATED_PROMPTS.length;
  return { prompt: CURATED_PROMPTS[idx]!, source: 'rotation' };
}

async function buildJournalPrompt(
  env: CoffeePodEnv,
  date: string,
  recent: JournalEntryRow[],
): Promise<{ prompt: string; source: 'ai' | 'rotation' }> {
  const provider = await resolveActiveAIProvider(env, 'fast').catch(() => null);
  if (!provider) return rotationPrompt(date, recent);

  const recentForPrompt = recent
    .filter((row) => row.date !== date && row.preview)
    .slice(0, 7)
    .map((row, idx) => `${idx + 1}. [${row.date}] ${row.preview}`)
    .join('\n');

  const userPrompt = [
    `Today's date: ${date}.`,
    '',
    'Recent journal snippets:',
    recentForPrompt || 'None yet — this is the user\'s first day journalling.',
    '',
    'Generate ONE short (≤25 words) reflection prompt or inspirational nudge for today\'s entry.',
    'Pull from the themes in the snippets when possible; otherwise offer a fresh, open prompt.',
    'No quotes around the response, no preamble, no sign-off — just the prompt itself.',
  ].join('\n');

  try {
    const answer = await requestProviderText(provider, {
      system: 'You are a thoughtful daily-journal companion. You write short, warm reflection prompts that help the user open up.',
      prompt: userPrompt,
      maxTokens: 120,
    });
    const cleaned = answer.trim().replace(/^["'`]|["'`]$/g, '').trim();
    if (cleaned.length > 0) return { prompt: cleaned, source: 'ai' };
  } catch {
    // fall through
  }
  return rotationPrompt(date, recent);
}

export async function registerJournalRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);
  ensureJournalCollection(db);

  /* ── List entries (optionally within a date range) ── */
  app.get('/pod/journal/entries', {
    schema: {
      summary: 'List Pod journal entries (optionally filtered by date range)',
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        },
      },
    },
  }, async (request) => {
    const { from, to } = request.query as { from?: string; to?: string };
    const rows = listJournalEntries(db, requestWorkspaceId(request));
    const filtered = rows.filter((row) => {
      if (from && row.date < from) return false;
      if (to && row.date > to) return false;
      return true;
    });
    return { entries: filtered };
  });

  /* ── Get a single day's entry ── */
  app.get('/pod/journal/entry/:date', {
    schema: {
      summary: 'Get the journal entry for a specific date',
      params: {
        type: 'object',
        required: ['date'],
        properties: { date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
      },
    },
  }, async (request, reply) => {
    const { date } = request.params as { date: string };
    if (!DATE_RE.test(date)) return reply.code(400).send({ error: 'invalid_date' });
    const workspaceId = requestWorkspaceId(request);
    const obj = getObject(db, journalId(date, workspaceId));
    if (!obj) {
      return {
        entry: null,
        date,
        title: humanDateTitle(date),
        markdown: '',
      };
    }
    return {
      entry: obj,
      date,
      title: obj.title,
      markdown: extractMarkdown(obj.content),
    };
  });

  /* ── Upsert a day's entry ── */
  app.post('/pod/journal/entry/:date', {
    schema: {
      summary: 'Create or update the journal entry for a specific date',
      params: {
        type: 'object',
        required: ['date'],
        properties: { date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
      },
      body: {
        type: 'object',
        required: ['markdown'],
        properties: {
          markdown: { type: 'string' },
          actor_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { date } = request.params as { date: string };
    if (!DATE_RE.test(date)) return reply.code(400).send({ error: 'invalid_date' });
    const body = request.body as { markdown: string; actor_id?: string };
    const actorId = body.actor_id ?? 'person-local';
    // Always run actor auth — if the caller omits actor_id we still demand a
    // valid token for `person-local` so an unauthenticated tab can't write to
    // the journal.
    if (!await requireActorAuth(request, reply, env, actorId)) return;
    const workspaceId = requestWorkspaceId(request);

    ensureJournalCollection(db);

    const obj = upsertObject(db, {
      id: journalId(date, workspaceId),
      workspace_id: workspaceId,
      collection_id: JOURNAL_COLLECTION_ID,
      kind: 'journal_entry',
      title: humanDateTitle(date),
      content: { markdown: body.markdown },
      origin: 'written',
      created_origin: 'written',
      last_modified_by: actorId,
      metadata: { journal_date: date },
    });
    const core = await getSmartwareCore(env);
    const workspaceScope = ensureWorkspaceScope(core, env, workspaceId);
    const memoryPolicy = resolveObservationDefaults(db, { sensitive: obj.sensitive });
    const memory = await syncArtifactMemory({
      db,
      core,
      object: obj,
      actor: {
        type: actorId === 'person-local' || actorId.startsWith('person_') ? 'person' : 'agent',
        id: actorId,
        display_name: actorId,
      },
      type: 'message',
      scope: workspaceScope,
      content: {
        format: 'application/json',
        body: {
          action: 'journal_entry_versioned',
          date,
          title: obj.title,
          markdown: body.markdown,
        },
      },
      visibility: memoryPolicy.visibility,
      sensitive: memoryPolicy.sensitive,
      app: 'coffee-pod',
      observed_at: `${date}T12:00:00.000Z`,
      legacy_sources: [{ app: 'coffee-pod', source_id: `journal:${date}` }],
    });

    // Invalidate any cached prompt for this date so it can re-draw context.
    setSettings(db, PROMPT_NAMESPACE, { [`${workspaceId}:${date}`]: null });

    return {
      entry: obj,
      date,
      title: obj.title,
      markdown: extractMarkdown(obj.content),
      memory,
    };
  });

  /* ── Inspiration prompt for a given date ── */
  app.get('/pod/journal/prompt', {
    schema: {
      summary: 'Get an inspiration prompt for a journal date (AI-generated, cached per day)',
      querystring: {
        type: 'object',
        properties: {
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          refresh: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { date, refresh } = request.query as { date?: string; refresh?: string };
    const workspaceId = requestWorkspaceId(request);
    const targetDate = date && DATE_RE.test(date) ? date : new Date().toISOString().slice(0, 10);
    const cacheKey = `${workspaceId}:${targetDate}`;
    const forceRefresh = refresh === 'true' || refresh === '1';

    if (!forceRefresh) {
      const cache = getSettings(db, PROMPT_NAMESPACE);
      const cached = cache[cacheKey];
      if (cached && typeof cached === 'object') {
        const value = cached as { prompt?: string; source?: 'ai' | 'rotation' };
        if (typeof value.prompt === 'string' && value.prompt.trim()) {
          return { prompt: value.prompt, source: value.source ?? 'rotation', cached: true };
        }
      }
    }

    const recent = listJournalEntries(db, workspaceId);
    const result = await buildJournalPrompt(env, targetDate, recent);

    setSettings(db, PROMPT_NAMESPACE, {
      [cacheKey]: { prompt: result.prompt, source: result.source, generated_at: new Date().toISOString() },
    });

    return { prompt: result.prompt, source: result.source, cached: false };
  });
}
