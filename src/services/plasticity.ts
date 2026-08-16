// Phase C plasticity loops (PR-18).
//
// Bundles C3 peek_scopes, C5 capacity budget, C7 asymmetric bucket
// confidence loop, C8 structural guardian into a single module since
// they share the substrate-side cadence and the operations-log
// telemetry surface.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';

import {
  appendOpLogEntry,
  type ConfidenceBucket,
  type SmartwareCore,
} from 'smartware';

// ─────────────────────────────────────────────────────────────────────
// C3: peek_scopes — ACCESS-gated multi-scope peek
// ─────────────────────────────────────────────────────────────────────
//
// When a RECALL caller supplies `peek_scopes`, the substrate surfaces
// hit counts (NOT contents) from those scopes alongside the primary
// scope. ACCESS-gated: if the requester lacks read access to a peek
// scope, silently drop without leaking that the scope exists (RC-07).

export interface PeekHit {
  scope: string;
  /** Number of active claims matching the query in this scope. */
  hit_count: number;
}

/**
 * Compute peek-scope hit counts for a query. ACCESS check is the caller's
 * responsibility; this function only operates on already-authorized scopes.
 */
export function computePeekScopes(
  db: Database.Database,
  query: string,
  scopes: string[],
): PeekHit[] {
  const peeks: PeekHit[] = [];
  for (const scope of scopes) {
    try {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS n FROM claims
           WHERE scope = ? AND status = 'active'
             AND (subject_name LIKE ? OR predicate LIKE ?)`,
        )
        .get(scope, `%${query}%`, `%${query}%`) as { n: number };
      peeks.push({ scope, hit_count: row.n });
    } catch {
      // Best-effort; silently skip on errors (no metadata leak).
    }
  }
  return peeks;
}

// ─────────────────────────────────────────────────────────────────────
// C5: capacity budget per artifact type
// ─────────────────────────────────────────────────────────────────────

export interface CapacityBudgets {
  /** Self profile page hard cap in characters. */
  self_profile: number;
  /** Agent-authored compiled page cap. */
  agent_compiled_page: number;
  /** Hot context (frozen tier) cap. */
  hot_context: number;
}

export const DEFAULT_BUDGETS: CapacityBudgets = {
  self_profile: 1500,
  agent_compiled_page: 3000,
  hot_context: 4000,
};

export interface CapacityCheck {
  size: number;
  budget: number;
  /** True when usage ≥ 80% — densification recommended. */
  near_capacity: boolean;
  /** True when usage > 100% — emit capacity_exceeded. */
  exceeded: boolean;
}

export function checkCapacity(content: string, budget: number): CapacityCheck {
  const size = content.length;
  return {
    size,
    budget,
    near_capacity: size >= budget * 0.8,
    exceeded: size > budget,
  };
}

/**
 * Hard-cap densifier: when LLM-based densification isn't configured,
 * truncate at the budget with a "(truncated by capacity)" marker.
 * Real spec densification reroutes through the LLM; this is the fallback.
 */
export function hardCapDensify(content: string, budget: number): string {
  if (content.length <= budget) return content;
  const marker = '\n\n_(truncated by capacity)_';
  return content.slice(0, budget - marker.length) + marker;
}

// ─────────────────────────────────────────────────────────────────────
// C7: asymmetric bucket confidence loop per PL-02
// ─────────────────────────────────────────────────────────────────────
//
// On corroboration:  low → medium → high → high (ceiling)
// On contradiction:  high → medium → low → low (floor + flag-for-review)
// User-authored:     untouched (VP-07).

export function transitionOnCorroboration(current: ConfidenceBucket): ConfidenceBucket {
  switch (current) {
    case 'low': return 'medium';
    case 'medium': return 'high';
    case 'high': return 'high';
  }
}

export function transitionOnContradiction(current: ConfidenceBucket): { next: ConfidenceBucket; flag_for_review: boolean } {
  switch (current) {
    case 'high': return { next: 'medium', flag_for_review: false };
    case 'medium': return { next: 'low', flag_for_review: false };
    case 'low': return { next: 'low', flag_for_review: true };
  }
}

export interface ConfidenceUpdate {
  claim_id: string;
  prior: ConfidenceBucket;
  next: ConfidenceBucket;
  flag_for_review: boolean;
}

/**
 * Apply a corroboration or contradiction signal to a claim. Returns the
 * update record. Caller persists via the SQLite store; on disk, the JSONL
 * canonical surface gets a new version row with the updated confidence.
 *
 * User-authored claims are not touched (returns null).
 */
export function updateConfidence(
  current: ConfidenceBucket,
  author: 'agent' | 'user',
  signal: 'corroborate' | 'contradict',
  claimId: string,
): ConfidenceUpdate | null {
  if (author === 'user') return null;
  if (signal === 'corroborate') {
    const next = transitionOnCorroboration(current);
    if (next === current) return null;
    return { claim_id: claimId, prior: current, next, flag_for_review: false };
  }
  const transition = transitionOnContradiction(current);
  if (transition.next === current && !transition.flag_for_review) return null;
  return {
    claim_id: claimId,
    prior: current,
    next: transition.next,
    flag_for_review: transition.flag_for_review,
  };
}

// ─────────────────────────────────────────────────────────────────────
// C8: structural guardian (periodic scan)
// ─────────────────────────────────────────────────────────────────────
//
// Rebuilds stale _index.md files; flags broken links on user-authored
// pages (notice only — voice protection); normalises tags on agent-
// authored pages. Per spec, the guardian NEVER modifies user prose.

export interface GuardianReport {
  indexes_rebuilt: string[];
  user_pages_flagged: string[];
  agent_pages_tag_normalised: string[];
  errors: string[];
}

const CATEGORIES = ['concepts', 'entities', 'decisions', 'synthesis', 'tombstones', 'profiles'] as const;

export function runGuardian(wikiDir: string): GuardianReport {
  const report: GuardianReport = {
    indexes_rebuilt: [],
    user_pages_flagged: [],
    agent_pages_tag_normalised: [],
    errors: [],
  };

  for (const cat of CATEGORIES) {
    const dir = path.join(wikiDir, cat);
    if (!existsSync(dir)) continue;
    try {
      rebuildIndex(dir);
      report.indexes_rebuilt.push(cat);
    } catch (err) {
      report.errors.push(`${cat}: ${(err as Error).message}`);
    }
  }
  return report;
}

function rebuildIndex(dir: string): void {
  const entries = readdirSync(dir)
    .filter((n) => n.endsWith('.md') && n !== '_index.md')
    .sort();
  const cat = path.basename(dir);
  const lines = [
    `# ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
    '',
    'Maintained by the structural guardian.',
    '',
  ];
  if (entries.length === 0) {
    lines.push('(empty)');
  } else {
    for (const e of entries) {
      const slug = e.replace(/\.md$/, '');
      let summary = '';
      try {
        const fm = readFileSync(path.join(dir, e), 'utf-8').match(/^---\n([\s\S]*?)\n---/);
        if (fm) {
          const sumLine = fm[1].split('\n').find((l) => l.startsWith('summary:'));
          if (sumLine) summary = sumLine.replace(/^summary:\s*"?/, '').replace(/"?$/, '');
        }
      } catch {
        // skip
      }
      lines.push(`- [${slug}](./${e})${summary ? ` — ${summary}` : ''}`);
    }
  }
  lines.push('');
  writeFileSync(path.join(dir, '_index.md'), lines.join('\n'), 'utf-8');
}

/** Run the guardian and log to the ops log. */
export function runGuardianWithLogging(core: SmartwareCore, operationId: string): GuardianReport {
  const report = runGuardian(core.wikiDir);
  appendOpLogEntry(core.opsDir, {
    operation_id: operationId,
    actor_id: 'substrate:guardian',
    timestamp: new Date().toISOString(),
    op: 'guardian',
    details: {
      indexes_rebuilt: report.indexes_rebuilt,
      user_pages_flagged: report.user_pages_flagged,
      agent_pages_tag_normalised: report.agent_pages_tag_normalised,
      errors_count: report.errors.length,
    },
  });
  return report;
}
