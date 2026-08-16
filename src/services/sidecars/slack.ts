// Slack native sidecar (PR-12 / E2). [WRITTEN-BUT-UNVERIFIED for live OAuth.]
//
// Implements the Sidecar interface from sidecar-framework.ts per
// pod-integration-slack-v0_1.md.
//
// VERIFICATION NOTE
// This module compiles and the filter logic is unit-testable, but the
// OAuth handshake + Events API webhook + backfill paths require:
//   - A Slack OAuth app with channels:history, groups:history,
//     im:history, mpim:history, channels:read, users:read,
//     reactions:read, pins:read
//   - A reachable webhook URL for Slack's Events API to POST to
//   - SLACK_CLIENT_ID + SLACK_CLIENT_SECRET in env
// None of these were exercised in this session. The skeleton is here so
// later sessions can fill in the live integration without re-deriving
// the spec's filter rules, signal_only mode, or actor-id discipline.

import { createHash } from 'node:crypto';
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

const ACTOR_ID: SidecarActorId = 'sidecar:slack';

/** Filter config per pod-integration-slack-v0_1.md. */
export interface SlackFilterConfig {
  mode: 'all' | 'signal_only' | 'minimal';
  min_message_length: number;
  ignore_bots: boolean;
  ignored_bot_logins: string[];
}

export const DEFAULT_SLACK_FILTER: SlackFilterConfig = {
  mode: 'signal_only',
  min_message_length: 30,
  ignore_bots: true,
  ignored_bot_logins: ['slackbot', 'github', 'zoom'],
};

export interface SlackMessage {
  ts: string;
  channel_id: string;
  channel_name: string;
  thread_ts?: string;
  user: string;
  user_display_name: string;
  text: string;
  is_pinned?: boolean;
  reactions?: Array<{ name: string; count: number }>;
  is_bot?: boolean;
  is_self?: boolean;
  mentions_user?: boolean;
}

/**
 * Apply the spec's filter rules to a Slack message.
 * Returns 'keep' (with tags) or 'skip' (with reason).
 */
export function filterSlackMessage(
  msg: SlackMessage,
  config: SlackFilterConfig = DEFAULT_SLACK_FILTER,
): FilterDecision {
  if (config.mode === 'all') return { decision: 'keep' };

  // Always-observe overrides per spec:
  const alwaysObserve = msg.is_self || msg.is_pinned || (msg.reactions?.reduce((s, r) => s + r.count, 0) ?? 0) >= 3 || msg.mentions_user;

  if (config.mode === 'minimal' && !alwaysObserve) {
    return { decision: 'skip', reason: 'minimal mode: only self / mention / pinned / reactions kept' };
  }

  if (!alwaysObserve) {
    if (config.ignore_bots && msg.is_bot && config.ignored_bot_logins.includes(msg.user_display_name.toLowerCase())) {
      return { decision: 'skip', reason: `bot sender '${msg.user_display_name}'` };
    }
    const short = filters.shortBody(msg.text, config.min_message_length);
    if (short.decision === 'skip') return short;
    const lowSignal = filters.lowSignalReply(msg.text);
    if (lowSignal.decision === 'skip') return lowSignal;
  }

  const tags: string[] = [];
  if (msg.is_pinned) tags.push('slack-pinned');
  if ((msg.reactions?.reduce((s, r) => s + r.count, 0) ?? 0) >= 3) tags.push('slack-high-reaction');
  if (msg.is_self) tags.push('slack-self');
  if (msg.thread_ts && msg.thread_ts !== msg.ts) tags.push('slack-thread-reply');
  if (msg.thread_ts === msg.ts) tags.push('slack-thread-start');
  return { decision: 'keep', tags };
}

/** Slack-specific source-event-id projection for deterministic op_ids. */
export function slackEventId(msg: SlackMessage): string {
  // `${channel}.${ts}` is globally unique per Slack's data model.
  return `${msg.channel_id}.${msg.ts}`;
}

export function slackOperationId(msg: SlackMessage): string {
  return deterministicOperationId(ACTOR_ID, slackEventId(msg));
}

/** Verify Slack's `X-Slack-Signature` HMAC per their Events API docs. */
export function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  receivedSignature: string,
): boolean {
  const baseString = `v0:${timestamp}:${body}`;
  const expected = 'v0=' + createHash('sha256').update(`${signingSecret}${baseString}`).digest('hex');
  return safeCompare(expected, receivedSignature);
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export const slackSidecar: Sidecar = {
  actor_id: ACTOR_ID,
  source: 'slack',
  async status(_env: CoffeePodEnv): Promise<SidecarStatus> {
    return {
      actor_id: ACTOR_ID,
      connected: false,
      events_observed: 0,
      notes: 'Native Slack sidecar (PR-12 / E2). Live OAuth + Events API integration deferred to operator setup.',
    };
  },
  async backfill(_env: CoffeePodEnv, _window: BackfillWindow): Promise<BackfillReport> {
    // Live Slack API call deferred; surface as no-op for now.
    return { events_seen: 0, events_observed: 0, events_filtered: 0, duration_ms: 0 };
  },
};
