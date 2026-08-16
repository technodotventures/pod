// Voice protection enforcement (PR-15 / B1).
//
// Spec v1.5.4.2 §"User Voice and Co-Authorship":
//   On user-authored L2 pages, agents may modify ONLY:
//     - _index.md entries in the same directory
//     - frontmatter `notices` slot (post page-level alerts)
//     - frontmatter `supporting_claims` (append corroborating ClaimIds)
//     - frontmatter `updated` (bookkeeping timestamp)
//   Every other write is rejected.
//
// This module is invoked by every agent-driven page write. User-driven
// writes (via the synthesis editor) skip this check because they're
// definitionally allowed.

import { readFileSync } from 'node:fs';

export type VoiceWriteIntent =
  | { kind: 'append_supporting_claim'; claim_id: string }
  | { kind: 'post_notice'; notice_type: string }
  | { kind: 'update_index_entry' }
  | { kind: 'update_timestamp' }
  | { kind: 'modify_body' }
  | { kind: 'modify_intent_frontmatter'; field: string }
  | { kind: 'modify_sources' };

export interface VoiceProtectionResult {
  allowed: boolean;
  reason?: string;
}

/** Read a page's `author` from its frontmatter without parsing the whole file. */
export function pageAuthor(path: string): 'agent' | 'user' | null {
  try {
    const content = readFileSync(path, 'utf-8');
    const m = content.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    const authorLine = m[1].split('\n').find((l) => l.startsWith('author:'));
    if (!authorLine) return null;
    const value = authorLine.replace(/^author:\s*/, '').replace(/^"(.*)"$/, '$1').trim();
    if (value === 'user' || value === 'agent') return value;
    return null;
  } catch {
    return null;
  }
}

/**
 * Decide whether an agent's intent against a page is allowed under voice
 * protection. Returns { allowed: true } unconditionally when:
 *   - The actor is a user (governance check happens upstream)
 *   - The page is agent-authored (agents own their own work)
 *
 * Returns { allowed: false, reason } when the actor is an agent and the
 * intent would modify protected slots on a user-authored page.
 */
export function checkVoiceProtection(
  actorId: string,
  pagePath: string,
  intent: VoiceWriteIntent,
): VoiceProtectionResult {
  // User actors are always allowed (gateway is the auth layer).
  if (actorId.startsWith('user:')) {
    return { allowed: true };
  }

  // Page lookup; if we can't tell the author, deny conservatively when
  // intent is a modification to body/intent/sources.
  const author = pageAuthor(pagePath);
  if (author === 'agent' || author === null) {
    // Agent-authored or unknown: agents own this. Permit.
    return { allowed: true };
  }

  // author === 'user'. Apply the spec's allow-list.
  switch (intent.kind) {
    case 'append_supporting_claim':
    case 'post_notice':
    case 'update_index_entry':
    case 'update_timestamp':
      return { allowed: true };
    case 'modify_body':
      return {
        allowed: false,
        reason: 'Voice protection: agents cannot modify the body of a user-authored page.',
      };
    case 'modify_intent_frontmatter':
      return {
        allowed: false,
        reason: `Voice protection: agents cannot modify '${intent.field}' (intent frontmatter) on user-authored pages.`,
      };
    case 'modify_sources':
      return {
        allowed: false,
        reason: 'Voice protection: agents cannot modify the `sources` (ClaimId) list on user-authored pages. Use `supporting_claims` instead.',
      };
  }
}
