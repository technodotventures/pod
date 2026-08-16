import type { CoffeePodEnv } from '../config/env.js';
import {
  extractGmailText,
  getGmailThread,
  listGmailMessages,
  type GmailMessage,
} from './google-api.js';
import {
  normalizeEmailAddress,
  type EmailAddress,
  type EmailMessage,
  type EmailSource,
} from './email-source.js';

export interface GmailEmailSourceOptions {
  exclude_promotions?: boolean;
  exclude_social?: boolean;
  labels?: 'inbox' | 'all' | 'selected';
}

function parseAddresses(value: string): EmailAddress[] {
  if (!value.trim()) return [];
  const candidates = value.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
  return candidates.map(candidate => {
    const address = normalizeEmailAddress(candidate);
    const name = candidate.replace(/<[^>]+>/, '').replace(/^\s*"|"\s*$/g, '').trim();
    return { address, ...(name && name !== address ? { name } : {}) };
  }).filter(candidate => candidate.address.includes('@'));
}

export function canonicalGmailMessage(
  msg: GmailMessage,
  accountId: string,
  ownerEmail?: string,
): EmailMessage {
  const extracted = extractGmailText(msg);
  const from = parseAddresses(extracted.from)[0] ?? { address: extracted.from || 'unknown' };
  const occurredAt = Number.isFinite(Number(msg.internalDate))
    ? new Date(Number(msg.internalDate)).toISOString()
    : (Number.isFinite(Date.parse(extracted.date)) ? new Date(extracted.date).toISOString() : new Date(0).toISOString());
  const labels = msg.labelIds ?? [];
  const authoredByOwner = labels.includes('SENT')
    || Boolean(ownerEmail && normalizeEmailAddress(from.address) === normalizeEmailAddress(ownerEmail));
  return {
    id: msg.id,
    thread_id: `gmail:${accountId}:${msg.threadId}`,
    provider: 'gmail',
    account_id: accountId,
    subject: extracted.subject || '(no subject)',
    from,
    to: parseAddresses(extracted.to),
    cc: parseAddresses(extracted.cc),
    occurred_at: occurredAt,
    body: extracted.body.trim() || msg.snippet || extracted.subject,
    mailbox: authoredByOwner ? 'Sent' : 'Inbox',
    labels,
    headers: extracted.rawHeaders,
    authored_by_owner: authoredByOwner,
    ...(extracted.messageId ? { message_id: extracted.messageId } : {}),
    ...(extracted.inReplyTo ? { in_reply_to: extracted.inReplyTo } : {}),
    references: extracted.references,
  };
}

export function createGmailEmailSource(
  env: CoffeePodEnv,
  config: GmailEmailSourceOptions = {},
): EmailSource {
  const accountId = env.userEmail?.trim().toLowerCase() || 'google-account';
  return {
    provider: 'gmail',
    integration_id: 'gmail',
    account_id: accountId,
    display_name: 'Google',
    async fetchRecent(options) {
      const common: string[] = [];
      if (config.exclude_promotions) common.push('-category:promotions');
      if (config.exclude_social) common.push('-category:social');
      const perMailbox = Math.max(1, Math.ceil(options.max_messages / 2));
      const requests: Array<Promise<GmailMessage[]>> = [];
      const after = `${options.after.getFullYear()}/${String(options.after.getMonth() + 1).padStart(2, '0')}/${String(options.after.getDate()).padStart(2, '0')}`;
      if (options.include_inbox) {
        requests.push(listGmailMessages(env, {
          query: [config.labels === 'all' ? '-in:spam -in:trash' : 'in:inbox', ...common].join(' '),
          maxResults: perMailbox,
          after,
        }));
      }
      if (options.include_sent) {
        requests.push(listGmailMessages(env, {
          query: ['in:sent', ...common].join(' '),
          maxResults: perMailbox,
          after,
        }));
      }
      const seeds = (await Promise.all(requests)).flat();
      const threadIds = [...new Set(seeds.map(message => message.threadId))];
      const threadMessages: GmailMessage[] = [];
      for (const threadId of threadIds) {
        try {
          threadMessages.push(...await getGmailThread(env, threadId));
        } catch {
          threadMessages.push(...seeds.filter(message => message.threadId === threadId));
        }
      }
      const byId = new Map(threadMessages.map(message => [message.id, message]));
      return [...byId.values()]
        .map(message => canonicalGmailMessage(message, accountId, env.userEmail))
        .filter(message => Date.parse(message.occurred_at) >= options.after.getTime())
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
        .slice(0, options.max_messages);
    },
  };
}
