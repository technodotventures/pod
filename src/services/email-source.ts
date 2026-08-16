import { createHash } from 'node:crypto';

import {
  conversationMessageContent,
  type ConversationMessage,
} from './conversation-memory.js';

export type EmailProvider = 'gmail' | 'icloud';

export interface EmailAddress {
  address: string;
  name?: string;
}

/** Provider-neutral message shape used by every email adapter. */
export interface EmailMessage {
  id: string;
  thread_id: string;
  provider: EmailProvider;
  account_id: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  occurred_at: string;
  body: string;
  mailbox: string;
  labels: string[];
  headers: Record<string, string>;
  authored_by_owner: boolean;
  message_id?: string;
  in_reply_to?: string;
  references: string[];
}

export interface EmailFetchOptions {
  after: Date;
  max_messages: number;
  include_inbox: boolean;
  include_sent: boolean;
}

export interface EmailSource {
  provider: EmailProvider;
  integration_id: 'gmail' | 'icloud-mail';
  account_id: string;
  display_name: string;
  fetchRecent(options: EmailFetchOptions): Promise<EmailMessage[]>;
}

export interface EmailThread {
  id: string;
  messages: EmailMessage[];
  owner_replied: boolean;
}

/** Return a provider-owned link to the exact email thread when one exists. */
export function emailMessageSourceUrl(message: EmailMessage): string | undefined {
  if (message.provider !== 'gmail') return undefined;
  const threadId = message.thread_id.split(':').at(-1)?.trim();
  if (!threadId) return undefined;
  const accountSelector = message.account_id === 'google-account'
    ? '0'
    : encodeURIComponent(message.account_id);
  return `https://mail.google.com/mail/u/${accountSelector}/#all/${encodeURIComponent(threadId)}`;
}

export function normalizeEmailAddress(value: string): string {
  const bracketed = /<([^<>\s]+@[^<>\s]+)>/.exec(value)?.[1];
  const direct = /[^\s<>]+@[^\s<>]+/.exec(value)?.[0];
  return (bracketed ?? direct ?? value).trim().toLowerCase();
}

export function emailActorId(address: string, ownerId: string, authoredByOwner: boolean): string {
  if (authoredByOwner) return ownerId;
  const normalized = normalizeEmailAddress(address);
  const suffix = createHash('sha256').update(normalized).digest('hex').slice(0, 20);
  return `person:email-${suffix}`;
}

export function groupEmailThreads(messages: EmailMessage[]): EmailThread[] {
  const grouped = new Map<string, EmailMessage[]>();
  for (const message of messages) {
    const group = grouped.get(message.thread_id) ?? [];
    group.push(message);
    grouped.set(message.thread_id, group);
  }
  return [...grouped.entries()].map(([id, threadMessages]) => {
    threadMessages.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.id.localeCompare(b.id));
    return {
      id,
      messages: threadMessages,
      owner_replied: threadMessages.some(message => message.authored_by_owner),
    };
  }).sort((a, b) => {
    const aTime = a.messages.at(-1)?.occurred_at ?? '';
    const bTime = b.messages.at(-1)?.occurred_at ?? '';
    return bTime.localeCompare(aTime);
  });
}

export function emailConversationMessage(
  message: EmailMessage,
  ownerId: string,
): ConversationMessage {
  const sender = message.from.address || 'unknown';
  const text = message.body.trim() || message.subject.trim();
  return conversationMessageContent({
    source: message.provider === 'icloud' ? 'icloud-mail' : 'gmail',
    conversation_id: message.thread_id,
    message_id: message.id,
    text,
    actor_id: emailActorId(sender, ownerId, message.authored_by_owner),
    ...(message.from.name ? { actor_name: message.from.name } : { actor_name: sender }),
    channel_id: message.account_id,
    channel_name: message.subject || '(no subject)',
    subject: message.subject || '(no subject)',
    occurred_at: message.occurred_at,
    authored_by_owner: message.authored_by_owner,
    direction: message.authored_by_owner ? 'outbound' : 'inbound',
  });
}

/** Prefer threads the owner actively participated in, then keep recent context. */
export function prioritizeEmailThreads(threads: EmailThread[], maxMessages: number): EmailMessage[] {
  return [...threads]
    .sort((a, b) => Number(b.owner_replied) - Number(a.owner_replied)
      || (b.messages.at(-1)?.occurred_at ?? '').localeCompare(a.messages.at(-1)?.occurred_at ?? ''))
    .flatMap(thread => thread.messages)
    .slice(0, Math.max(1, maxMessages));
}
