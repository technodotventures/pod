/**
 * Linear API helpers for issue/project ingestion.
 * Uses API key from integration config. Linear uses GraphQL.
 */

import type { CoffeePodEnv } from '../config/env.js';
import { readIntegrationConfig } from '@technodotventures/smartware-connectors';

async function linearQuery<T>(env: CoffeePodEnv, query: string, variables?: Record<string, unknown>): Promise<T> {
  const config = (await readIntegrationConfig(env, 'linear')) as { api_key?: string; access_token?: string };
  const token = config.api_key ?? config.access_token;
  if (!token) throw new Error('Linear is not connected');

  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear API failed: ${res.status}`);
  const data = (await res.json()) as { data: T; errors?: Array<{ message: string }> };
  if (data.errors?.length) throw new Error(data.errors[0]!.message);
  return data.data;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  state: { name: string };
  priority: number;
  assignee?: { name: string };
  team: { name: string };
  updatedAt: string;
  createdAt: string;
  url: string;
}

export async function listLinearIssues(env: CoffeePodEnv, options: { updatedAfter?: string; limit?: number } = {}): Promise<LinearIssue[]> {
  const filter: Record<string, unknown> = {};
  if (options.updatedAfter) filter.updatedAt = { gt: options.updatedAfter };

  const result = await linearQuery<{ issues: { nodes: LinearIssue[] } }>(env, `
    query($first: Int, $filter: IssueFilter) {
      issues(first: $first, filter: $filter, orderBy: updatedAt) {
        nodes {
          id identifier title description
          state { name }
          priority
          assignee { name }
          team { name }
          updatedAt createdAt url
        }
      }
    }
  `, { first: options.limit ?? 30, filter: Object.keys(filter).length ? filter : undefined });

  return result.issues.nodes;
}
