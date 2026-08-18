/**
 * GitHub API helpers for repo/issue/PR ingestion.
 * Uses personal access token or OAuth token from integration config.
 */

import type { CoffeePodEnv } from '../config/env.js';
import { readIntegrationConfig } from '@technodotventures/smartware-connectors';

async function githubFetch<T>(env: CoffeePodEnv, path: string): Promise<T> {
  const config = (await readIntegrationConfig(env, 'github')) as { access_token?: string };
  if (!config.access_token) throw new Error('GitHub is not connected');

  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GitHub API failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface GitHubEvent {
  id: string;
  type: string;
  repo: { name: string };
  actor: { login: string };
  payload: Record<string, unknown>;
  created_at: string;
}

export interface GitHubNotification {
  id: string;
  subject: { title: string; type: string; url: string };
  repository: { full_name: string };
  reason: string;
  updated_at: string;
  unread: boolean;
}

export async function listGitHubNotifications(env: CoffeePodEnv, since?: string): Promise<GitHubNotification[]> {
  const params = since ? `?since=${since}&all=true` : '?all=true';
  return githubFetch<GitHubNotification[]>(env, `/notifications${params}`);
}

export async function listGitHubEvents(env: CoffeePodEnv): Promise<GitHubEvent[]> {
  const user = await githubFetch<{ login: string }>(env, '/user');
  return githubFetch<GitHubEvent[]>(env, `/users/${user.login}/received_events?per_page=30`);
}
