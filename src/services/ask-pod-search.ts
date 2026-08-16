// Ask Pod retrieval helpers — extend the question-answering surface so it
// can ground answers in pod.db objects (not just Smartware L0/L1) and on
// temporal phrases in the user query.
//
// Why pod.db search is needed: Smartware's searchObservations only scans
// its evidence directory. Pod's library objects (calendar events, journal
// entries, wiki rows, seed data) live in pod.db. Without this helper, Ask
// Pod returns "I have no memories" even when 2,000+ objects exist.
//
// Why temporal parsing is needed: a question like "what happened
// yesterday" is satisfied by a date filter, not by literal-text match. We
// extract a date range and apply it to recency filters before keyword
// search.

import type Database from 'better-sqlite3';
import type { PodObject } from '../pod/db.js';

export interface TemporalRange {
  start: string; // ISO
  end: string;   // ISO (exclusive upper bound)
  label: string; // e.g. "yesterday"
}

/**
 * Detect a temporal phrase in the query and return a date range.
 * Returns null if no temporal hint is present.
 *
 * Recognised phrases:
 *   - today / this morning / this afternoon / this evening / tonight
 *   - yesterday
 *   - this week / last week
 *   - this month / last month
 *   - "last N days|weeks|months"
 *   - "N days|weeks|months ago"
 *   - "since <date>"  (best-effort ISO parse)
 *
 * Times are computed against the provided `now` (defaults to new Date()).
 * Ranges are half-open: [start, end). All midnight-aligned UTC.
 */
export function parseTemporalHint(query: string, now: Date = new Date()): TemporalRange | null {
  const q = query.toLowerCase();

  // Midnight in local time of `now` then convert to UTC ISO for SQL comparisons.
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const iso = (d: Date) => d.toISOString();

  const today0 = startOfDay(now);
  const tomorrow0 = addDays(today0, 1);

  if (/\btoday\b|\bthis (morning|afternoon|evening)\b|\btonight\b/.test(q)) {
    return { start: iso(today0), end: iso(tomorrow0), label: 'today' };
  }
  if (/\byesterday\b/.test(q)) {
    return { start: iso(addDays(today0, -1)), end: iso(today0), label: 'yesterday' };
  }
  if (/\blast week\b/.test(q)) {
    const thisWeekStart = addDays(today0, -today0.getDay());
    return {
      start: iso(addDays(thisWeekStart, -7)),
      end: iso(thisWeekStart),
      label: 'last week',
    };
  }
  if (/\bthis week\b/.test(q)) {
    const dow = today0.getDay(); // 0 = Sunday
    const weekStart = addDays(today0, -dow);
    return { start: iso(weekStart), end: iso(tomorrow0), label: 'this week' };
  }
  if (/\blast month\b/.test(q)) {
    const lastMonthStart = new Date(today0.getFullYear(), today0.getMonth() - 1, 1);
    const thisMonthStart = new Date(today0.getFullYear(), today0.getMonth(), 1);
    return { start: iso(lastMonthStart), end: iso(thisMonthStart), label: 'last month' };
  }
  if (/\bthis month\b/.test(q)) {
    const thisMonthStart = new Date(today0.getFullYear(), today0.getMonth(), 1);
    return { start: iso(thisMonthStart), end: iso(tomorrow0), label: 'this month' };
  }

  // "last 7 days", "last 3 weeks", "last 2 months"
  const lastNMatch = q.match(/\blast (\d+)\s*(day|week|month)s?\b/);
  if (lastNMatch) {
    const n = Number(lastNMatch[1]);
    const unit = lastNMatch[2];
    let start: Date;
    if (unit === 'day') start = addDays(today0, -n);
    else if (unit === 'week') start = addDays(today0, -n * 7);
    else start = new Date(today0.getFullYear(), today0.getMonth() - n, today0.getDate());
    return { start: iso(start), end: iso(tomorrow0), label: `last ${n} ${unit}${n > 1 ? 's' : ''}` };
  }

  // "5 days ago", "2 weeks ago"
  const agoMatch = q.match(/\b(\d+)\s*(day|week|month)s?\s+ago\b/);
  if (agoMatch) {
    const n = Number(agoMatch[1]);
    const unit = agoMatch[2];
    let start: Date;
    let end: Date;
    if (unit === 'day') {
      start = addDays(today0, -n);
      end = addDays(start, 1);
    } else if (unit === 'week') {
      start = addDays(today0, -n * 7);
      end = addDays(start, 7);
    } else {
      start = new Date(today0.getFullYear(), today0.getMonth() - n, 1);
      end = new Date(today0.getFullYear(), today0.getMonth() - n + 1, 1);
    }
    return { start: iso(start), end: iso(end), label: agoMatch[0] };
  }

  // "since 2026-05-01" — best-effort ISO parse
  const sinceMatch = q.match(/\bsince\s+(\d{4}-\d{2}-\d{2})/);
  if (sinceMatch) {
    const start = new Date(sinceMatch[1]);
    if (!Number.isNaN(start.getTime())) {
      return { start: iso(start), end: iso(tomorrow0), label: `since ${sinceMatch[1]}` };
    }
  }

  return null;
}

export interface PodObjectMatch extends PodObject {
  match_score: number;
  temporal_start?: string;
  temporal_end?: string | null;
  temporal_basis?: 'valid_time' | 'observed_time' | 'recorded_time';
}

export interface PodObjectTemporalInterval {
  start: string;
  end: string | null;
  basis: PodObjectMatch['temporal_basis'];
}

function recordValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function validInstant(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function firstInstant(
  records: Record<string, unknown>[],
  keys: string[],
): string | null {
  for (const key of keys) {
    for (const record of records) {
      const parsed = validInstant(record[key]);
      if (parsed) return parsed;
    }
  }
  return null;
}

function exclusiveDayEnd(start: string): string {
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

/**
 * Resolve an artifact's represented-world interval independently from its
 * storage lifecycle. Connector event/message timestamps win; created_at is a
 * final recorded-time fallback. updated_at is deliberately never treated as
 * "when this happened".
 */
export function podObjectTemporalInterval(
  object: Pick<PodObject, 'content' | 'metadata' | 'created_at'>,
): PodObjectTemporalInterval | null {
  const records = [recordValue(object.metadata), recordValue(object.content)];
  const observed = firstInstant(records, ['occurred_at', 'sent_at', 'received_at']);
  const start = observed ?? firstInstant(records, [
    'start',
    'start_at',
    'start_time',
    'published_at',
    'date',
    'journal_date',
  ]);
  const end = firstInstant(records, ['end', 'end_at', 'end_time']);
  if (start) {
    const dateOnly = records.some(record =>
      ['date', 'journal_date', 'start'].some(key =>
        typeof record[key] === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(record[key] as string)));
    return {
      start,
      end: end ?? (dateOnly ? exclusiveDayEnd(start) : null),
      basis: observed ? 'observed_time' : 'valid_time',
    };
  }
  const recorded = validInstant(object.created_at);
  return recorded
    ? { start: recorded, end: null, basis: 'recorded_time' }
    : null;
}

function overlapsTemporalRange(
  interval: PodObjectTemporalInterval | null,
  range: TemporalRange,
): boolean {
  if (!interval) return false;
  return interval.start < range.end
    && (interval.end === null || range.start < interval.end);
}

function parseStoredJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function podObjectFromSearchRow(row: Record<string, unknown>): PodObject {
  return {
    ...(row as unknown as PodObject),
    content: parseStoredJson(row['content']) ?? null,
    metadata: recordValue(row['metadata']),
    tags: Array.isArray(parseStoredJson(row['tags']))
      ? parseStoredJson(row['tags']) as string[]
      : [],
    sensitive: Boolean(row['sensitive']),
    needs_review: Boolean(row['needs_review']),
  };
}

const CONVERSATIONAL_SEARCH_WORDS = new Set([
  'a', 'about', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'been', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'for', 'from', 'give', 'had', 'has',
  'have', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'me', 'my', 'of',
  'on', 'or', 'our', 'please', 'should', 'show', 'tell', 'that', 'the',
  'their', 'them', 'there', 'these', 'they', 'this', 'those', 'to', 'was',
  'we', 'were', 'what', 'when', 'where', 'which', 'who', 'why', 'will',
  'with', 'would', 'you', 'your',
]);

const TEMPORAL_SEARCH_WORDS = new Set([
  'ago', 'afternoon', 'day', 'days', 'evening', 'happened', 'last', 'month',
  'months', 'morning', 'since', 'today', 'tonight', 'week', 'weeks',
  'yesterday',
]);

/**
 * Keep only words that can distinguish one memory from another. Questions
 * naturally contain filler ("what is my…") which should never make an
 * unrelated document count as a hit. When a date range has already been
 * parsed, its temporal wording is represented by the range and is removed too.
 */
export function meaningfulSearchTerms(
  query: string,
  temporalRange?: TemporalRange | null,
): string[] {
  const words = query.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];
  return [...new Set(words.filter(word =>
    word.length > 1
    && !CONVERSATIONAL_SEARCH_WORDS.has(word)
    && !(temporalRange && TEMPORAL_SEARCH_WORDS.has(word))))];
}

/**
 * Scan pod.db `objects` table for matches against the user query.
 * Strategy:
 *   - If a temporal range is given, filter by represented-world time carried
 *     in content/metadata; created_at is the recorded-time fallback.
 *   - Otherwise, do a LIKE-match on title/summary/content with one row per
 *     term-hit-bucket. Crude but deterministic and 10ms on 2k rows.
 *
 * Returns top `limit` results (default 20), sorted by score desc.
 */
export function searchPodObjects(
  db: Database.Database,
  query: string,
  options: {
    workspaceId?: string;
    limit?: number;
    temporalRange?: TemporalRange | null;
    excludeArchived?: boolean;
  } = {},
): PodObjectMatch[] {
  const limit = options.limit ?? 20;
  const excludeArchived = options.excludeArchived !== false;
  const terms = meaningfulSearchTerms(query, options.temporalRange);
  if (terms.length === 0 && !options.temporalRange) return [];

  const conditions: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];

  if (options.workspaceId) {
    conditions.push('workspace_id = ?');
    params.push(options.workspaceId);
  }
  if (excludeArchived) conditions.push('archived_at IS NULL');

  // Keyword OR-match across title / summary / content_text. Skip the LIKE
  // clauses entirely when terms is empty (pure-temporal query like
  // "what happened yesterday" → return everything in the date range).
  if (terms.length > 0) {
    const likeClauses: string[] = [];
    for (const t of terms) {
      const p = `%${t}%`;
      likeClauses.push("(LOWER(title) LIKE ? OR LOWER(IFNULL(summary, '')) LIKE ? OR LOWER(IFNULL(content, '')) LIKE ?)");
      params.push(p, p, p);
    }
    conditions.push(`(${likeClauses.join(' OR ')})`);
  }

  const rows = db.prepare(`
    SELECT * FROM objects
    WHERE ${conditions.join(' AND ')}
    ORDER BY updated_at DESC
    ${options.temporalRange ? '' : 'LIMIT ?'}
  `).all(...params, ...(options.temporalRange ? [] : [limit * 3])) as Array<Record<string, unknown>>;

  // Score: count how many terms appear in title/summary/content. Temporal-
  // only queries collapse to score=1 for everything in-range (caller can
  // sort by recency).
  const scored: PodObjectMatch[] = rows.flatMap(r => {
    const object = podObjectFromSearchRow(r);
    const interval = podObjectTemporalInterval(object);
    if (options.temporalRange && !overlapsTemporalRange(interval, options.temporalRange)) {
      return [];
    }
    const text = `${r.title ?? ''} ${r.summary ?? ''} ${r.content ?? ''}`.toLowerCase();
    const score = terms.length === 0
      ? 1
      : terms.reduce((acc, t) => acc + (text.includes(t) ? 1 : 0), 0);
    return [{
      ...object,
      match_score: score,
      ...(interval ? {
        temporal_start: interval.start,
        temporal_end: interval.end,
        temporal_basis: interval.basis,
      } : {}),
    }];
  }).filter(r => r.match_score > 0);

  scored.sort((a, b) => {
    if (b.match_score !== a.match_score) return b.match_score - a.match_score;
    return (b.temporal_start ?? b.created_at ?? '')
      .localeCompare(a.temporal_start ?? a.created_at ?? '');
  });

  return scored.slice(0, limit);
}
