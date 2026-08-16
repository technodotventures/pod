import { createHash } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import {
  getDb,
  getObject,
  insertEventIfFresh,
  listObjects,
  upsertCollection,
  upsertObject,
} from '../pod/db.js';
import { ensureAppDataSpace } from '../pod/data-spaces.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { protectIntegrationMemoryContent } from './integration-content-boundary.js';
import { compileConversationProjection } from './conversation-memory.js';
import {
  emailConversationMessage,
  emailMessageSourceUrl,
  groupEmailThreads,
  normalizeEmailAddress,
  prioritizeEmailThreads,
  type EmailMessage,
  type EmailSource,
} from './email-source.js';
import {
  classifySignal,
  metadataOnlySummary,
  setKnownContacts,
  tierContent,
  type SignalTier,
  type UserSignalOverrides,
} from './signal-classifier.js';
import { resolveReflectionModelUse } from './memory-settings.js';

export interface EmailFilters {
  labels?: 'inbox' | 'all' | 'selected';
  exclude_promotions?: boolean;
  exclude_social?: boolean;
  max_age_days?: number;
  include_inbox?: boolean;
  include_sent?: boolean;
}

export interface EmailSignalConfig {
  mode?: 'auto' | 'custom';
  vip_senders?: string[];
  mute_senders?: string[];
  mute_keywords?: string[];
  tier_thresholds?: { high: number; low: number };
  skip_observe_low?: boolean;
}

export interface EmailIngestionConfig {
  filters?: EmailFilters;
  signal_config?: EmailSignalConfig;
  last_sync_at?: string;
}

export interface EmailSyncReport {
  count: number;
  messages: string[];
  classification: Record<SignalTier, number>;
  threads_observed: number;
  owner_reply_threads: number;
}

function accountFingerprint(accountId: string): string {
  return createHash('sha256').update(accountId).digest('hex').slice(0, 12);
}

function sourceId(source: EmailSource, message: EmailMessage): string {
  return `${source.integration_id}:${accountFingerprint(source.account_id)}:${message.id}`;
}

function loadKnownEmailContacts(env: CoffeePodEnv): void {
  const db = getDb(env);
  const contacts = new Set<string>();
  for (const sourceApp of ['gmail', 'icloud-mail']) {
    for (const object of listObjects(db, { sourceApp, limit: 500 })) {
      const from = (object.content as Record<string, unknown> | null)?.['from'];
      if (typeof from === 'string' && from) contacts.add(normalizeEmailAddress(from));
    }
  }
  setKnownContacts(contacts);
}

function signalOverrides(config: EmailSignalConfig | undefined): UserSignalOverrides | undefined {
  if (config?.mode !== 'custom') return undefined;
  return {
    vip_senders: config.vip_senders,
    mute_senders: config.mute_senders,
    mute_keywords: config.mute_keywords,
    tier_thresholds: config.tier_thresholds,
  };
}

function classifyEmail(
  message: EmailMessage,
  thread: ReturnType<typeof groupEmailThreads>[number],
  env: CoffeePodEnv,
  overrides: UserSignalOverrides | undefined,
) {
  if (message.authored_by_owner) {
    return { tier: 'high' as const, score: 100, rules: ['user-authored', 'sent-mail'] };
  }
  return classifySignal({
    sender: message.from.address,
    recipients: [...message.to, ...message.cc].map(recipient => recipient.address),
    subject: message.subject,
    body: message.body,
    labels: message.labels,
    threadDepth: thread.messages.length,
    userReplied: thread.owner_replied,
    directlyAddressed: Boolean(env.userEmail && message.to.some(recipient =>
      normalizeEmailAddress(recipient.address) === normalizeEmailAddress(env.userEmail!))),
    source: 'email',
    headers: message.headers,
  }, overrides);
}

/**
 * Provider-neutral email ingestion. Provider adapters stop at EmailMessage;
 * all filtering, storage, observations, and Dream projections happen here.
 */
export async function syncEmailSource(
  env: CoffeePodEnv,
  log: FastifyInstance['log'],
  source: EmailSource,
  config: EmailIngestionConfig = {},
): Promise<EmailSyncReport> {
  const filters = config.filters ?? {};
  const maxAgeDays = Math.max(1, Math.min(365, filters.max_age_days ?? 30));
  const now = Date.now();
  const historyCutoff = now - maxAgeDays * 24 * 60 * 60 * 1_000;
  const lastSync = config.last_sync_at ? Date.parse(config.last_sync_at) : Number.NaN;
  // A short overlap makes polling resilient to clock skew and messages that
  // arrive around the previous sync boundary. Object and observation IDs keep
  // the overlap idempotent.
  const incrementalCutoff = Number.isFinite(lastSync)
    ? Math.min(lastSync, now) - 5 * 60 * 1_000
    : historyCutoff;
  const fetched = await source.fetchRecent({
    after: new Date(Math.max(historyCutoff, incrementalCutoff)),
    max_messages: 40,
    include_inbox: filters.include_inbox ?? true,
    include_sent: filters.include_sent ?? true,
  });
  const threads = groupEmailThreads(fetched);
  const messages = prioritizeEmailThreads(threads, 60);
  if (messages.length === 0) {
    return {
      count: 0,
      messages: [],
      classification: { high: 0, medium: 0, low: 0 },
      threads_observed: 0,
      owner_reply_threads: 0,
    };
  }

  const db = getDb(env);
  const core = await getSmartwareCore(env);
  const profile = getPodProfile(core, env);
  const appSpace = ensureAppDataSpace(core, env, source.integration_id);
  const actorId = `sync:${source.integration_id}`;
  core.ensureTrustedClientGrant(actorId, 'agent', [appSpace.scope]);
  upsertCollection(db, {
    id: source.integration_id,
    name: source.provider === 'icloud' ? 'Email · iCloud' : 'Email · Google',
    description: `Private email context synced from ${source.display_name}.`,
    metadata: { app: source.integration_id, kind: 'email', provider: source.provider },
  });
  loadKnownEmailContacts(env);

  const byThread = new Map(threads.map(thread => [thread.id, thread]));
  const overrides = signalOverrides(config.signal_config);
  const skipObserveLow = config.signal_config?.skip_observe_low ?? true;
  const synced: string[] = [];
  const syncedItems: Array<{
    title: string;
    object_id: string;
    source_url?: string;
    sender: string;
    occurred_at: string;
  }> = [];
  const tierCounts: Record<SignalTier, number> = { high: 0, medium: 0, low: 0 };
  const observedThreads = new Set<string>();

  for (const message of messages) {
    const thread = byThread.get(message.thread_id)!;
    const classification = classifyEmail(message, thread, env, overrides);
    tierCounts[classification.tier] += 1;
    const id = sourceId(source, message);
    const sourceUrl = emailMessageSourceUrl(message);
    const metadataText = metadataOnlySummary({
      subject: message.subject,
      sender: message.from.address,
      date: message.occurred_at,
    });
    const tieredBody = tierContent(classification.tier, message.body);
    const contentBody = classification.tier === 'low'
      ? metadataText
      : `From: ${message.from.address}\nTo: ${message.to.map(recipient => recipient.address).join(', ')}\nDate: ${message.occurred_at}\nSubject: ${message.subject}\n\n${tieredBody}`;
    const alreadyStored = Boolean(getObject(db, id));
    upsertObject(db, {
      id,
      collection_id: source.integration_id,
      kind: 'page',
      title: message.subject,
      content: {
        text: contentBody,
        from: message.from.address,
        to: message.to.map(recipient => recipient.address),
        cc: message.cc.map(recipient => recipient.address),
        date: message.occurred_at,
        subject: message.subject,
      },
      source: {
        app: source.integration_id,
        external_id: message.id,
        ...(sourceUrl ? { url: sourceUrl } : {}),
      },
      origin: 'imported',
      tags: ['email', source.provider, message.authored_by_owner ? 'sent' : 'received'],
      metadata: {
        account_fingerprint: accountFingerprint(source.account_id),
        thread_id: message.thread_id,
        mailbox: message.mailbox,
        labels: message.labels,
        authored_by_owner: message.authored_by_owner,
        owner_replied: thread.owner_replied,
        signal_tier: classification.tier,
        signal_score: classification.score,
        signal_rules: classification.rules,
      },
    });

    if (!alreadyStored && (classification.tier !== 'low' || !skipObserveLow)) {
      try {
        const conversation = emailConversationMessage({
          ...message,
          body: classification.tier === 'medium' ? tieredBody : message.body,
        }, profile.owner_id);
        const protectedContent = protectIntegrationMemoryContent(
          source.integration_id,
          id,
          { format: 'application/json', body: conversation },
        );
        await core.observe({
          actor: { type: 'agent', id: actorId, display_name: `${source.display_name} Email Sync` },
          type: 'message',
          scope: appSpace.scope,
          source_id: id,
          content: protectedContent.content,
          // The provider-owned data space is the privacy boundary. It is not
          // readable by agents unless the owner explicitly grants that space.
          visibility: 'scope',
          app: source.integration_id,
          observed_at: message.occurred_at,
        });
        observedThreads.add(message.thread_id);
      } catch (error) {
        log.warn({ error, source_id: id }, 'email sync: observe failed');
      }
    }
    synced.push(message.subject);
    syncedItems.push({
      title: message.subject,
      object_id: id,
      ...(sourceUrl ? { source_url: sourceUrl } : {}),
      sender: message.from.name ?? message.from.address,
      occurred_at: message.occurred_at,
    });
  }

  if (synced.length > 0) {
    const ownerReplyThreads = threads.filter(thread => thread.owner_replied).length;
    insertEventIfFresh(db, {
      type: source.provider === 'gmail' ? 'gmail_sync' : 'icloud_mail_sync',
      process: 'observe',
      actor_id: actorId,
      scope: appSpace.id,
      title: `Synced ${synced.length} email${synced.length === 1 ? '' : 's'} from ${source.display_name}`,
      detail: `${ownerReplyThreads} replied thread${ownerReplyThreads === 1 ? '' : 's'} prioritised`,
      content: {
        messages: synced.slice(0, 20),
        items: syncedItems.slice(0, 20),
        classification: tierCounts,
        owner_reply_threads: ownerReplyThreads,
      },
    });
    if (tierCounts.high > 0) {
      void core.compile({
        actor: { type: 'agent', id: actorId, display_name: `${source.display_name} Email Sync` },
        scope: appSpace.scope,
        use_llm: resolveReflectionModelUse(db),
      }).catch(error => log.warn({ error }, 'email sync: background compile failed'));
    }
    await compileConversationProjection(env, appSpace.scope)
      .catch(error => log.warn({ error }, 'email sync: conversation projection failed'));
  }

  return {
    count: synced.length,
    messages: synced,
    classification: tierCounts,
    threads_observed: observedThreads.size,
    owner_reply_threads: threads.filter(thread => thread.owner_replied).length,
  };
}
