// GitHub native sidecar (PR-12 / E3). [WRITTEN-BUT-UNVERIFIED for live OAuth.]
//
// Implements the Sidecar interface from sidecar-framework.ts per
// pod-integration-github-v0_1.md.
//
// VERIFICATION NOTE — same caveat as the Slack sidecar. The OAuth
// handshake, webhook receiver, and backfill paths require a real
// GitHub OAuth app, webhook URL, and credentials.

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CoffeePodEnv } from '../../config/env.js';
import {
  deterministicOperationId,
  filters,
  type BackfillReport,
  type BackfillWindow,
  type FilterDecision,
  type Sidecar,
  type SidecarActorId,
  type SidecarStatus,
} from '../sidecar-framework.js';

const ACTOR_ID: SidecarActorId = 'sidecar:github';

export type GithubEventType =
  | 'pull_request'
  | 'issue'
  | 'comment'
  | 'pr_review'
  | 'commit'
  | 'release';

export interface GithubEvent {
  type: GithubEventType;
  repo: string;
  number?: number;
  sha?: string;
  author: string;
  author_login: string;
  is_bot?: boolean;
  title?: string;
  body?: string;
  labels?: string[];
  reactions_count?: number;
  state?: string;
  mentions_user?: boolean;
  is_self?: boolean;
}

export interface GithubFilterConfig {
  ignore_bots: boolean;
  ignored_bot_logins: string[];
  min_body_length: number;
}

export const DEFAULT_GITHUB_FILTER: GithubFilterConfig = {
  ignore_bots: true,
  ignored_bot_logins: ['dependabot', 'github-actions', 'renovate-bot', 'codecov-commenter'],
  min_body_length: 50,
};

export function filterGithubEvent(
  event: GithubEvent,
  config: GithubFilterConfig = DEFAULT_GITHUB_FILTER,
): FilterDecision {
  // Always-observe overrides per spec:
  const alwaysObserve =
    event.is_self ||
    event.mentions_user ||
    event.type === 'release' ||
    (event.type === 'pr_review' && (event.state === 'approved' || event.state === 'changes_requested'));

  if (!alwaysObserve) {
    if (config.ignore_bots && event.is_bot && config.ignored_bot_logins.includes(event.author_login.toLowerCase())) {
      return { decision: 'skip', reason: `bot author '${event.author_login}'` };
    }
    if (event.type === 'comment' && event.body) {
      const short = filters.shortBody(event.body, config.min_body_length);
      if (short.decision === 'skip') return short;
      const low = filters.lowSignalReply(event.body);
      if (low.decision === 'skip') return low;
    }
  }

  const tags: string[] = [];
  if (event.is_self) tags.push('gh-self');
  if (event.mentions_user) tags.push('gh-mention');
  if (event.state === 'merged') tags.push('gh-merged');
  if ((event.labels ?? []).some((l) => l === 'decision' || l === 'architecture')) tags.push('gh-decision');
  if ((event.reactions_count ?? 0) >= 5) tags.push('gh-high-reaction');
  return { decision: 'keep', tags };
}

/** Deterministic source id per GitHub event for op_id derivation. */
export function githubEventId(event: GithubEvent): string {
  if (event.sha) return `${event.repo}@${event.sha}`;
  if (event.number !== undefined) return `${event.repo}#${event.type}.${event.number}`;
  return `${event.repo}.${event.type}.${event.author_login}.${Date.now()}`;
}

export function githubOperationId(event: GithubEvent): string {
  return deterministicOperationId(ACTOR_ID, githubEventId(event));
}

/** Verify GitHub's `X-Hub-Signature-256` HMAC per their webhook docs. */
export function verifyGithubSignature(secret: string, body: string, signature: string): boolean {
  if (!signature.startsWith('sha256=')) return false;
  const hmac = createHmac('sha256', secret).update(body).digest('hex');
  const expected = `sha256=${hmac}`;
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export const githubSidecar: Sidecar = {
  actor_id: ACTOR_ID,
  source: 'github',
  async status(_env: CoffeePodEnv): Promise<SidecarStatus> {
    return {
      actor_id: ACTOR_ID,
      connected: false,
      events_observed: 0,
      notes: 'Native GitHub sidecar (PR-12 / E3). Live OAuth + webhook integration deferred to operator setup.',
    };
  },
  async backfill(_env: CoffeePodEnv, _window: BackfillWindow): Promise<BackfillReport> {
    return { events_seen: 0, events_observed: 0, events_filtered: 0, duration_ms: 0 };
  },
};
