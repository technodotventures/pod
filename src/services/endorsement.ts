// Two-phase page endorsement (PR-8 / B3).
//
// Implements REVISE target.type=page per Protocol Contract v0.4.1:
//   1. dry_run: true  → snapshot cascade, store with cascade_preview_id, return.
//   2. commit         → validate preview, atomically flip page + contained
//                       claims to author=user, append ops-log entry.
//
// COMPROMISE NOTE. The substrate's L1 today uses INSERT OR REPLACE keyed on
// claim_id; there is no on-disk version chain. We approximate the spec's
// "append new L1 version" semantics with "update author to user + record
// operation_id + version_at + actor_id" — preserving the cascade audit in
// the ops log. Full claim-version-chain support is post-PR-8 work.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Database } from 'better-sqlite3';

import {
  CascadePreviewStore,
  isValidCascadePreviewId,
  type SmartwareCore,
} from 'smartware';

export interface PageReference {
  page_id: string;
  /** Absolute path on disk. */
  path: string;
  /** Category dir name (concepts | entities | decisions | synthesis). */
  category: string;
  /** ClaimIds the page cites (= frontmatter.sources_claim_ids OR claim_ids). */
  contained_claim_ids: string[];
  /** Current page-level author. */
  author: 'agent' | 'user';
}

export type EndorsementError =
  | { code: 'not_found'; message: string }
  | { code: 'invalid_payload'; message: string }
  | { code: 'forbidden'; message: string }
  | { code: 'cascade_required_ack'; message: string; cascade_preview_id: string; cascade: CascadeSummary }
  | { code: 'preview_not_found'; message: string }
  | { code: 'preview_expired'; message: string }
  | { code: 'conflict'; message: string };

export interface CascadeSummary {
  page_id: string;
  claims_reauthored: string[];
  shared_claims: string[];
}

export interface DryRunResult {
  cascade_preview_id: string;
  cascade: CascadeSummary;
}

export interface CommitResult {
  page_id: string;
  cascade: CascadeSummary;
  operation_id: string;
  commit_ts: string;
}

/**
 * Locate an L2 page on disk by PageId. Pages live in
 * wiki/<category>/<slug>.md (PR-6 / A5).
 */
export function findPage(wikiDir: string, pageId: string): PageReference | null {
  const expectedSlug = pageId.replace(/^page_/, '');
  for (const category of ['concepts', 'entities', 'decisions', 'synthesis']) {
    const dir = join(wikiDir, category);
    let files: string[];
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of files) {
      if (!name.endsWith('.md') || name === '_index.md') continue;
      const slug = name.replace(/\.md$/, '');
      if (slug !== expectedSlug) continue;
      const filePath = join(dir, name);
      const ref = readPageReference(filePath, category);
      if (ref) return ref;
    }
  }
  return null;
}

function readPageReference(filePath: string, category: string): PageReference | null {
  const content = readFileSync(filePath, 'utf-8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];
  const pick = (key: string): string | undefined => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    if (!m) return undefined;
    return m[1].trim().replace(/^"(.*)"$/, '$1');
  };
  const pickList = (key: string): string[] => {
    // Match either inline array `key: [a, b]` or YAML list
    const inline = fm.match(new RegExp(`^${key}:\\s*\\[([^\\]]*)\\]`, 'm'));
    if (inline) {
      return inline[1]
        .split(',')
        .map((s) => s.trim().replace(/^"(.*)"$/, '$1'))
        .filter(Boolean);
    }
    const block = fm.match(new RegExp(`^${key}:([\\s\\S]*?)(?=\\n[a-z_]+:|$)`, 'm'));
    if (!block) return [];
    return block[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => line.replace(/^- /, '').replace(/^"(.*)"$/, '$1'));
  };

  const pageId = pick('page_id') ?? `page_${filePath.split('/').pop()!.replace(/\.md$/, '')}`;
  const author = (pick('author') as 'agent' | 'user' | undefined) ?? 'agent';
  // Prefer the spec-shaped sources_claim_ids; fall back to legacy claim_ids.
  let containedClaimIds = pickList('sources_claim_ids');
  if (containedClaimIds.length === 0) containedClaimIds = pickList('claim_ids');

  return {
    page_id: pageId,
    path: filePath,
    category,
    contained_claim_ids: containedClaimIds,
    author,
  };
}

/** Find pages that cite the given ClaimId (for shared-claim cascade detection). */
export function findPagesCitingClaim(wikiDir: string, claimId: string): string[] {
  const pages: string[] = [];
  for (const category of ['concepts', 'entities', 'decisions', 'synthesis']) {
    const dir = join(wikiDir, category);
    let files: string[];
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of files) {
      if (!name.endsWith('.md') || name === '_index.md') continue;
      const filePath = join(dir, name);
      const ref = readPageReference(filePath, category);
      if (ref && ref.contained_claim_ids.includes(claimId)) {
        pages.push(ref.page_id);
      }
    }
  }
  return pages;
}

function computeCascade(wikiDir: string, page: PageReference): CascadeSummary {
  const shared: string[] = [];
  for (const claimId of page.contained_claim_ids) {
    const citing = findPagesCitingClaim(wikiDir, claimId);
    if (citing.length > 1) shared.push(claimId);
  }
  return {
    page_id: page.page_id,
    claims_reauthored: page.contained_claim_ids,
    shared_claims: shared,
  };
}

export function dryRunEndorsement(
  wikiDir: string,
  previewStore: CascadePreviewStore,
  args: { page_id: string; actor_id: string; reason?: string },
): DryRunResult | EndorsementError {
  const page = findPage(wikiDir, args.page_id);
  if (!page) {
    return { code: 'not_found', message: `Page '${args.page_id}' not found.` };
  }
  if (page.category === 'profiles') {
    return { code: 'forbidden', message: 'Profile pages cannot be endorsed (Spec RV-14).' };
  }
  const cascade = computeCascade(wikiDir, page);
  const previewId = previewStore.put({
    page_id: page.page_id,
    sources_snapshot: cascade.claims_reauthored,
    shared_claims_snapshot: cascade.shared_claims,
    actor_id: args.actor_id,
    reason: args.reason,
  });
  return { cascade_preview_id: previewId, cascade };
}

export interface CommitArgs {
  page_id: string;
  operation_id: string;
  actor_id: string;
  reason: string;
  cascade_preview_id?: string;
}

/**
 * Commit endorsement. Validates the cascade preview, then flips author
 * to 'user' on the page frontmatter and each contained claim. Atomic at
 * the storage level (ops-log entry written last per A0).
 */
export async function commitEndorsement(
  core: SmartwareCore,
  _db: Database,
  args: CommitArgs,
): Promise<CommitResult | EndorsementError> {
  const page = findPage(core.wikiDir, args.page_id);
  if (!page) {
    return { code: 'not_found', message: `Page '${args.page_id}' not found.` };
  }
  if (page.category === 'profiles') {
    return { code: 'forbidden', message: 'Profile pages cannot be endorsed (Spec RV-14).' };
  }

  const cascade = computeCascade(core.wikiDir, page);

  // Cascade with shared claims requires acknowledgement (RV-06).
  if (cascade.shared_claims.length > 0) {
    if (!args.cascade_preview_id) {
      const previewId = core.previewStore.put({
        page_id: page.page_id,
        sources_snapshot: cascade.claims_reauthored,
        shared_claims_snapshot: cascade.shared_claims,
        actor_id: args.actor_id,
        reason: args.reason,
      });
      return {
        code: 'cascade_required_ack',
        message: 'Page endorsement affects shared claims; supply a cascade_preview_id from a prior dry-run.',
        cascade_preview_id: previewId,
        cascade,
      };
    }
    if (!isValidCascadePreviewId(args.cascade_preview_id)) {
      return { code: 'invalid_payload', message: 'cascade_preview_id is malformed.' };
    }
    const lookup = core.previewStore.lookup(args.cascade_preview_id);
    if (lookup.kind === 'not_found' || lookup.kind === 'consumed') {
      return { code: 'preview_not_found', message: 'cascade_preview_id not found or already consumed.' };
    }
    if (lookup.kind === 'expired') {
      return { code: 'preview_expired', message: 'cascade_preview_id has expired (5-minute TTL).' };
    }
    // Drift detection (RV-18): if the cascade set changed since preview,
    // refuse commit and surface a fresh preview.
    const prev = lookup.payload;
    if (
      !sameList(prev.sources_snapshot, cascade.claims_reauthored) ||
      !sameList(prev.shared_claims_snapshot, cascade.shared_claims)
    ) {
      const freshId = core.previewStore.put({
        page_id: page.page_id,
        sources_snapshot: cascade.claims_reauthored,
        shared_claims_snapshot: cascade.shared_claims,
        actor_id: args.actor_id,
        reason: args.reason,
      });
      return {
        code: 'cascade_required_ack',
        message: 'Cascade set has drifted since the preview; re-acknowledge with the fresh cascade_preview_id.',
        cascade_preview_id: freshId,
        cascade,
      };
    }
  }

  try {
    const result = await core.endorse({
      actor: { type: 'person', id: args.actor_id, display_name: args.actor_id },
      page_id: args.page_id,
      page_path: page.path,
      dry_run: false,
      cascade_preview_id: args.cascade_preview_id,
      reason: args.reason,
      operation_id: args.operation_id,
    });
    if (result.status !== 'endorsed') {
      return { code: 'conflict', message: 'Endorsement did not produce a commit result.' };
    }
    return {
      page_id: result.page_id,
      cascade,
      operation_id: result.operation_id,
      commit_ts: result.commit_ts,
    };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'preview_not_found' || code === 'preview_expired') {
      return { code, message: (err as Error).message };
    }
    return {
      code: 'conflict',
      message: `Endorsement commit failed mid-flight: ${(err as Error).message}. The recovery scan will detect partial state.`,
    };
  }
}

function sameList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const aSorted = [...a].sort();
  const bSorted = [...b].sort();
  return aSorted.every((v, i) => v === bSorted[i]);
}
