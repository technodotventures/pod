/**
 * Notion API helpers for page/database ingestion.
 * Uses integration token from integration config.
 */

import type { CoffeePodEnv } from '../config/env.js';
import { readIntegrationConfig } from '@technodotventures/smartware-connectors';

async function notionFetch<T>(env: CoffeePodEnv, path: string, method = 'GET', body?: unknown): Promise<T> {
  const config = (await readIntegrationConfig(env, 'notion')) as { access_token?: string };
  if (!config.access_token) throw new Error('Notion is not connected');

  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Notion API failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface NotionPage {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, { title?: Array<{ plain_text: string }>; [key: string]: unknown }>;
  parent: { type: string; [key: string]: unknown };
}

export interface NotionBlock {
  id: string;
  type: string;
  [key: string]: unknown;
}

export async function searchNotionPages(env: CoffeePodEnv, query?: string): Promise<NotionPage[]> {
  const body: Record<string, unknown> = { page_size: 20, filter: { property: 'object', value: 'page' } };
  if (query) body.query = query;
  const result = await notionFetch<{ results: NotionPage[] }>(env, '/search', 'POST', body);
  return result.results ?? [];
}

export async function getNotionPageBlocks(env: CoffeePodEnv, pageId: string): Promise<NotionBlock[]> {
  const result = await notionFetch<{ results: NotionBlock[] }>(env, `/blocks/${pageId}/children?page_size=100`);
  return result.results ?? [];
}

export function extractNotionTitle(page: NotionPage): string {
  for (const prop of Object.values(page.properties)) {
    if (prop.title?.length) return prop.title.map(t => t.plain_text).join('');
  }
  return 'Untitled';
}

export function blocksToText(blocks: NotionBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    const richText = (block[block.type] as { rich_text?: Array<{ plain_text: string }> })?.rich_text;
    if (richText) lines.push(richText.map(t => t.plain_text).join(''));
  }
  return lines.join('\n');
}
