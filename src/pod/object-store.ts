import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { CoffeePodEnv } from '../config/env.js';

export interface PodCollection {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface PodObject {
  id: string;
  collection_id: string;
  kind: string;
  title: string;
  content?: unknown;
  source?: {
    app?: string;
    external_id?: string;
    url?: string;
  };
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PodObjectInput {
  id?: string;
  collection_id?: string;
  kind: string;
  title: string;
  content?: unknown;
  source?: PodObject['source'];
  metadata?: Record<string, unknown>;
}

interface ObjectStore {
  collections: PodCollection[];
  objects: PodObject[];
}

function objectStorePath(env: CoffeePodEnv): string {
  return path.join(env.dataDir, 'pod-objects.json');
}

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString('base64url')}`;
}

async function readStore(env: CoffeePodEnv): Promise<ObjectStore> {
  try {
    const raw = await fs.readFile(objectStorePath(env), 'utf8');
    const parsed = JSON.parse(raw) as Partial<ObjectStore>;
    return {
      collections: Array.isArray(parsed.collections) ? parsed.collections : [],
      objects: Array.isArray(parsed.objects) ? parsed.objects : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { collections: [], objects: [] };
    }
    throw error;
  }
}

async function writeStore(env: CoffeePodEnv, store: ObjectStore): Promise<void> {
  await fs.mkdir(env.dataDir, { recursive: true });
  await fs.writeFile(objectStorePath(env), `${JSON.stringify(store, null, 2)}\n`);
}

export async function upsertCollection(env: CoffeePodEnv, input: {
  id?: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}): Promise<PodCollection> {
  const store = await readStore(env);
  const now = new Date().toISOString();
  const id = input.id ?? makeId('collection');
  const existing = store.collections.find(collection => collection.id === id);
  const collection: PodCollection = {
    id,
    name: input.name,
    description: input.description,
    metadata: input.metadata,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  store.collections = [
    ...store.collections.filter(entry => entry.id !== id),
    collection,
  ];
  await writeStore(env, store);
  return collection;
}

export async function listCollections(env: CoffeePodEnv): Promise<PodCollection[]> {
  const store = await readStore(env);
  return store.collections.sort((a, b) => a.name.localeCompare(b.name));
}

export async function upsertObject(env: CoffeePodEnv, input: PodObjectInput): Promise<PodObject> {
  const store = await readStore(env);
  const now = new Date().toISOString();
  const id = input.id ?? makeId('object');
  const existing = store.objects.find(object => object.id === id);
  const object: PodObject = {
    id,
    collection_id: input.collection_id ?? 'library',
    kind: input.kind,
    title: input.title,
    content: input.content,
    source: input.source,
    metadata: input.metadata,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  store.objects = [
    ...store.objects.filter(entry => entry.id !== id),
    object,
  ];
  await writeStore(env, store);
  return object;
}

export async function getObject(env: CoffeePodEnv, objectId: string): Promise<PodObject | null> {
  const store = await readStore(env);
  return store.objects.find(object => object.id === objectId) ?? null;
}

export async function listObjects(env: CoffeePodEnv, options: {
  collectionId?: string;
  kind?: string;
  query?: string;
  limit?: number;
} = {}): Promise<PodObject[]> {
  const store = await readStore(env);
  const query = options.query?.toLowerCase();
  return store.objects
    .filter(object => !options.collectionId || object.collection_id === options.collectionId)
    .filter(object => !options.kind || object.kind === options.kind)
    .filter(object => {
      if (!query) return true;
      const haystack = `${object.title}\n${JSON.stringify(object.content ?? {})}\n${JSON.stringify(object.metadata ?? {})}`.toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, options.limit ?? 50);
}
