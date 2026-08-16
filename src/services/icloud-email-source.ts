import { ImapFlow, type ListResponse } from 'imapflow';
import { simpleParser, type AddressObject } from 'mailparser';

import type { CoffeePodEnv } from '../config/env.js';
import {
  normalizeEmailAddress,
  type EmailAddress,
  type EmailMessage,
  type EmailSource,
} from './email-source.js';
import { readEmailPassword } from './macos-keychain.js';

export interface ICloudMailConfig {
  account_email: string;
  username?: string;
  aliases?: string[];
  host?: string;
  port?: number;
}

export interface ICloudClientCredentials {
  user: string;
  pass: string;
}

export type ICloudCredentialReader = (account: string) => Promise<string>;

function flattenAddress(value: AddressObject | AddressObject[] | undefined): EmailAddress[] {
  const objects = Array.isArray(value) ? value : value ? [value] : [];
  return objects.flatMap(object => object.value.map(entry => ({
    address: normalizeEmailAddress(entry.address ?? ''),
    ...(entry.name ? { name: entry.name } : {}),
  }))).filter(entry => entry.address.includes('@'));
}

function headerStrings(headers: Map<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of headers) {
    if (typeof value === 'string') result[key.toLowerCase()] = value;
    else if (value instanceof Date) result[key.toLowerCase()] = value.toISOString();
  }
  return result;
}

function normalizeMessageId(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/^<|>$/g, '').toLowerCase();
  return normalized || undefined;
}

function referenceIds(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.flatMap(item => item.match(/<[^>]+>/g) ?? [item])
    .map(item => normalizeMessageId(item))
    .filter((item): item is string => Boolean(item));
}

function sentMailbox(mailboxes: ListResponse[]): ListResponse | undefined {
  return mailboxes.find(mailbox => mailbox.specialUse === '\\Sent')
    ?? mailboxes.find(mailbox => /(^|[/.])sent( items| messages| mail)?$/i.test(mailbox.path));
}

export async function parseICloudMessage(input: {
  source: Buffer;
  uid: number;
  uidValidity: bigint;
  mailbox: string;
  isSent: boolean;
  accountId: string;
  ownerAddresses: Set<string>;
  fallbackDate?: Date | string;
}): Promise<EmailMessage> {
  const parsed = await simpleParser(input.source, { skipHtmlToText: false, skipTextToHtml: true });
  const from = flattenAddress(parsed.from)[0] ?? { address: 'unknown' };
  const to = flattenAddress(parsed.to);
  const cc = flattenAddress(parsed.cc);
  const messageId = normalizeMessageId(parsed.messageId);
  const inReplyTo = normalizeMessageId(parsed.inReplyTo);
  const references = referenceIds(parsed.references);
  const rootId = references[0] ?? inReplyTo ?? messageId ?? `${input.uidValidity}:${input.uid}`;
  const date = parsed.date
    ?? (input.fallbackDate ? new Date(input.fallbackDate) : new Date(0));
  const authoredByOwner = input.isSent || input.ownerAddresses.has(normalizeEmailAddress(from.address));
  return {
    id: `${input.uidValidity}:${input.uid}`,
    thread_id: `icloud:${input.accountId}:${rootId}`,
    provider: 'icloud',
    account_id: input.accountId,
    subject: parsed.subject?.trim() || '(no subject)',
    from,
    to,
    cc,
    occurred_at: Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString(),
    body: parsed.text?.trim() || parsed.subject?.trim() || '(no content)',
    mailbox: input.mailbox,
    labels: input.isSent ? ['SENT'] : ['INBOX'],
    headers: headerStrings(parsed.headers as Map<string, unknown>),
    authored_by_owner: authoredByOwner,
    ...(messageId ? { message_id: messageId } : {}),
    ...(inReplyTo ? { in_reply_to: inReplyTo } : {}),
    references,
  };
}

export async function createICloudCredentials(
  config: ICloudMailConfig,
  readCredential: ICloudCredentialReader = readEmailPassword,
): Promise<ICloudClientCredentials> {
  const account = normalizeEmailAddress(config.account_email);
  return {
    user: config.username?.trim() || account,
    pass: await readCredential(account),
  };
}

export function createICloudEmailSource(
  _env: CoffeePodEnv,
  config: ICloudMailConfig,
  readCredential: ICloudCredentialReader = readEmailPassword,
): EmailSource {
  const accountId = normalizeEmailAddress(config.account_email);
  return {
    provider: 'icloud',
    integration_id: 'icloud-mail',
    account_id: accountId,
    display_name: 'iCloud',
    async fetchRecent(options) {
      const credentials = await createICloudCredentials(config, readCredential);
      const client = new ImapFlow({
        host: config.host ?? 'imap.mail.me.com',
        port: config.port ?? 993,
        secure: true,
        auth: credentials,
        logger: false,
        disableAutoIdle: true,
        connectionTimeout: 15_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
        maxLiteralSize: 10 * 1024 * 1024,
      });
      const messages: EmailMessage[] = [];
      try {
        await client.connect();
        const mailboxes = await client.list({ specialUseHints: { sent: 'Sent Messages' } });
        const selected: Array<{ path: string; sent: boolean }> = [];
        if (options.include_inbox) selected.push({ path: 'INBOX', sent: false });
        const sent = options.include_sent ? sentMailbox(mailboxes) : undefined;
        if (sent && !selected.some(entry => entry.path === sent.path)) selected.push({ path: sent.path, sent: true });
        const ownerAddresses = new Set([accountId, ...(config.aliases ?? []).map(normalizeEmailAddress)]);
        const perMailbox = Math.max(1, Math.ceil(options.max_messages / Math.max(1, selected.length)));
        for (const mailbox of selected) {
          const opened = await client.mailboxOpen(mailbox.path, { readOnly: true });
          const matches = await client.search({ since: options.after }, { uid: true });
          const uids = (matches || []).slice(-perMailbox);
          if (uids.length === 0) continue;
          for await (const item of client.fetch(uids, {
            uid: true,
            internalDate: true,
            source: { maxLength: 2 * 1024 * 1024 },
          }, { uid: true })) {
            if (!item.source) continue;
            messages.push(await parseICloudMessage({
              source: item.source,
              uid: item.uid,
              uidValidity: opened.uidValidity,
              mailbox: mailbox.path,
              isSent: mailbox.sent,
              accountId,
              ownerAddresses,
              fallbackDate: item.internalDate,
            }));
          }
        }
      } finally {
        if (client.usable) await client.logout().catch(() => client.close());
        else client.close();
      }
      return messages
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
        .slice(0, options.max_messages);
    },
  };
}

export async function testICloudMailConnection(
  config: ICloudMailConfig,
  readCredential: ICloudCredentialReader = readEmailPassword,
): Promise<void> {
  const credentials = await createICloudCredentials(config, readCredential);
  const client = new ImapFlow({
    host: config.host ?? 'imap.mail.me.com',
    port: config.port ?? 993,
    secure: true,
    auth: credentials,
    logger: false,
    verifyOnly: true,
    includeMailboxes: true,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
  });
  try {
    await client.connect();
  } finally {
    if (client.usable) await client.logout().catch(() => client.close());
    else client.close();
  }
}
