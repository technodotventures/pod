import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { CoffeePodEnv } from '../config/env.js';

interface StoredClientToken {
  client_id: string;
  client_name: string;
  actor_id: string;
  grant_id: string;
  token_hash: string;
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
  revoked_at?: string;
}

export interface ClientTokenSummary {
  client_id: string;
  client_name: string;
  actor_id: string;
  grant_id: string;
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
  revoked_at?: string;
}

interface ClientTokenStore {
  clients: StoredClientToken[];
}

function storePath(env: CoffeePodEnv): string {
  return path.join(env.dataDir, 'coffee-clients.json');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function readStore(env: CoffeePodEnv): Promise<ClientTokenStore> {
  try {
    const raw = await fs.readFile(storePath(env), 'utf8');
    const parsed = JSON.parse(raw) as Partial<ClientTokenStore>;
    return { clients: Array.isArray(parsed.clients) ? parsed.clients : [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { clients: [] };
    }
    throw error;
  }
}

async function writeStore(env: CoffeePodEnv, store: ClientTokenStore): Promise<void> {
  await fs.mkdir(env.dataDir, { recursive: true });
  const file = storePath(env);
  await fs.writeFile(file, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  // writeFile ignores `mode` when the file already exists; chmod handles the
  // existing-file case so we never leave issued token hashes world-readable
  // under macOS's default umask.
  await fs.chmod(file, 0o600);
}

export async function issueClientToken(env: CoffeePodEnv, input: {
  clientId: string;
  clientName: string;
  actorId: string;
  grantId: string;
  /** ISO timestamp at which this token stops verifying. Omit for never-expires. */
  expiresAt?: string | null;
}): Promise<{ token: string; token_prefix: string; created_at: string; expires_at: string | null }> {
  const token = `cpod_${crypto.randomBytes(32).toString('base64url')}`;
  const createdAt = new Date().toISOString();
  const expiresAt = input.expiresAt ?? null;
  const store = await readStore(env);
  const nextClient: StoredClientToken = {
    client_id: input.clientId,
    client_name: input.clientName,
    actor_id: input.actorId,
    grant_id: input.grantId,
    token_hash: hashToken(token),
    created_at: createdAt,
    ...(expiresAt ? { expires_at: expiresAt } : {}),
  };

  store.clients = [
    ...store.clients.filter(client => client.client_id !== input.clientId),
    nextClient,
  ];
  await writeStore(env, store);
  return { token, token_prefix: token.slice(0, 10), created_at: createdAt, expires_at: expiresAt };
}

export async function verifyClientToken(env: CoffeePodEnv, token: string): Promise<ClientTokenSummary | null> {
  const tokenHash = hashToken(token);
  const store = await readStore(env);
  const client = store.clients.find(entry => !entry.revoked_at && entry.token_hash === tokenHash);
  if (!client) return null;
  // Expired tokens never verify, even if not yet revoked.
  if (client.expires_at && new Date(client.expires_at).getTime() <= Date.now()) return null;

  client.last_used_at = new Date().toISOString();
  await writeStore(env, store);
  const { token_hash: _tokenHash, ...summary } = client;
  return summary;
}

export async function listClientTokens(env: CoffeePodEnv): Promise<ClientTokenSummary[]> {
  const store = await readStore(env);
  return store.clients
    .map(({ token_hash: _tokenHash, ...client }) => client)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function revokeClientToken(env: CoffeePodEnv, clientId: string): Promise<ClientTokenSummary | null> {
  const store = await readStore(env);
  const client = store.clients.find(entry => entry.client_id === clientId && !entry.revoked_at);
  if (!client) return null;

  client.revoked_at = new Date().toISOString();
  await writeStore(env, store);
  const { token_hash: _tokenHash, ...summary } = client;
  return summary;
}
