// Sidecar framework (PR-11 / E1).
//
// Reusable abstractions for native sidecars (Slack, GitHub, Calendar,
// Drive). Establishes the contract: each sidecar has a stable spec
// actor_id, an OAuth lifecycle, an opt-in selector, a filter pipeline,
// and an idempotent OBSERVE call per source event.
//
// The existing Calendar/Drive flows in src/services/connection-pipeline.ts
// are NOT migrated to this framework yet — they predate it and continue
// to use their own paths. New native sidecars (Slack PR-12, GitHub PR-12)
// implement this interface from scratch.

import { ulid } from 'ulid';
import type { CoffeePodEnv } from '../config/env.js';

/** Stable spec-conformant actor id for each sidecar. */
export type SidecarActorId =
  | 'sidecar:slack'
  | 'sidecar:github'
  | 'sidecar:calendar'
  | 'sidecar:drive';

/** Common shape every sidecar implements. */
export interface Sidecar {
  readonly actor_id: SidecarActorId;
  readonly source: string;
  /** Return current connection status for the operator dashboard. */
  status(env: CoffeePodEnv): Promise<SidecarStatus>;
  /** OAuth + opt-in setup. Returns the next-step URL or a token. */
  connect?(env: CoffeePodEnv, opts: Record<string, unknown>): Promise<unknown>;
  /** Run a backfill against the source. */
  backfill?(env: CoffeePodEnv, window: BackfillWindow): Promise<BackfillReport>;
  /** Process a webhook payload from the provider. */
  receiveWebhook?(env: CoffeePodEnv, body: unknown, headers: Record<string, string>): Promise<void>;
  /** Run a single polling tick (when webhooks aren't available). */
  poll?(env: CoffeePodEnv): Promise<void>;
}

export interface SidecarStatus {
  actor_id: SidecarActorId;
  connected: boolean;
  last_event_at?: string;
  events_observed: number;
  notes?: string;
}

export type BackfillWindow = '1d' | '7d' | '30d' | '90d' | 'all';

export interface BackfillReport {
  events_seen: number;
  events_observed: number;
  events_filtered: number;
  duration_ms: number;
}

/**
 * Deterministic operation_id from a source event id. Two sidecar ingests of
 * the same source event produce the same operation_id, so the
 * operations_seen cache deduplicates retries.
 *
 * Encoding: SHA-256 of `${actor_id}:${event_id}`, projected onto the
 * Crockford ULID alphabet, truncated to 26 chars. Idempotent and
 * collision-resistant for the deduplication purpose.
 */
import { createHash } from 'node:crypto';
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function deterministicOperationId(actorId: string, sourceEventId: string): string {
  const hash = createHash('sha256').update(`${actorId}:${sourceEventId}`).digest('hex');
  let body = '';
  for (let i = 0; i < 26; i += 1) {
    const byteIndex = (i * 2) % hash.length;
    const byte = parseInt(hash.slice(byteIndex, byteIndex + 2), 16);
    body += CROCKFORD[byte % CROCKFORD.length];
  }
  return `op_${body}`;
}

/** Generate a fresh non-deterministic operation_id (for cases without a stable source id). */
export function freshOperationId(): string {
  return `op_${ulid()}`;
}

/**
 * Standard filter result. Sidecars return `keep` for ingest, `skip` for
 * filtered-out events with a reason for the operations log.
 */
export type FilterDecision =
  | { decision: 'keep'; tags?: string[] }
  | { decision: 'skip'; reason: string };

/**
 * Shared filter primitives used by Slack signal_only mode and GitHub
 * bot filtering.
 */
export const filters = {
  shortBody(text: string, minLength = 30): FilterDecision {
    if (text.trim().length < minLength) {
      return { decision: 'skip', reason: `body shorter than ${minLength} chars` };
    }
    return { decision: 'keep' };
  },
  botSender(login: string, knownBots: string[]): FilterDecision {
    if (knownBots.includes(login.toLowerCase())) {
      return { decision: 'skip', reason: `sender '${login}' on bot deny-list` };
    }
    return { decision: 'keep' };
  },
  /** "+1", "thanks", "lgtm", single-emoji reactions-as-substitutes. */
  lowSignalReply(text: string): FilterDecision {
    const stripped = text.replace(/\s+/g, '').toLowerCase();
    const lowSignal = ['+1', '-1', 'lgtm', 'thanks', 'ty', 'tysm', '👍', '❤️', '🙏'];
    if (lowSignal.some((sig) => stripped === sig || stripped === sig + '!')) {
      return { decision: 'skip', reason: 'low-signal reply' };
    }
    return { decision: 'keep' };
  },
};
