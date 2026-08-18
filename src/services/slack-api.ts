/**
 * Slack API helpers for message ingestion.
 * Uses Slack Web API with bot token from integration config.
 */

import type { CoffeePodEnv } from '../config/env.js';
import { readIntegrationConfig } from '@technodotventures/smartware-connectors';

interface SlackConfig {
  access_token?: string;
  bot_token?: string;
  [key: string]: unknown;
}

async function slackFetch<T>(env: CoffeePodEnv, endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const config = (await readIntegrationConfig(env, 'slack')) as SlackConfig;
  const token = config.bot_token ?? config.access_token;
  if (!token) throw new Error('Slack is not connected (no token)');

  const url = new URL(`https://slack.com/api/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!data.ok) throw new Error(data.error ?? `Slack API ${endpoint} failed`);
  return data;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_member: boolean;
  is_private: boolean;
  num_members: number;
}

export interface SlackMessage {
  type: string;
  user?: string;
  bot_id?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
  reactions?: Array<{ name: string; count: number }>;
}

export async function listSlackChannels(env: CoffeePodEnv): Promise<SlackChannel[]> {
  const result = await slackFetch<{ channels: SlackChannel[] }>(env, 'conversations.list', {
    types: 'public_channel',
    exclude_archived: 'true',
    limit: '200',
  });
  return result.channels ?? [];
}

export async function listSlackMessages(
  env: CoffeePodEnv,
  channelId: string,
  options: { oldest?: string; limit?: number } = {},
): Promise<SlackMessage[]> {
  const params: Record<string, string> = {
    channel: channelId,
    limit: String(options.limit ?? 20),
  };
  if (options.oldest) params.oldest = options.oldest;

  const result = await slackFetch<{ messages: SlackMessage[] }>(env, 'conversations.history', params);
  return (result.messages ?? []).filter(m => m.type === 'message' && !m.bot_id);
}

export async function listSlackThreadReplies(
  env: CoffeePodEnv,
  channelId: string,
  threadTimestamp: string,
  limit = 50,
): Promise<SlackMessage[]> {
  const result = await slackFetch<{ messages: SlackMessage[] }>(env, 'conversations.replies', {
    channel: channelId,
    ts: threadTimestamp,
    limit: String(limit),
  });
  return (result.messages ?? []).filter(message => message.type === 'message' && !message.bot_id);
}
