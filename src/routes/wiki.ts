// L2 wiki browse routes (PR-16). Backs the F2/F3/F4 UI views.
//
// Read-only HTTP surface over pod_data/wiki/<category>/*.md.
//
// Endpoints
//   GET /pod/wiki/categories            — list categories + page counts
//   GET /pod/wiki/pages?category=...    — pages in a category with summaries
//   GET /pod/wiki/page/:slug            — full page content + frontmatter
//   GET /pod/wiki/profile               — alias for pages/profiles/self.md

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { DEFAULT_WORKSPACE_ID, getDb, upsertObject } from '../pod/db.js';
import { readSelfProfile } from '../services/profile-anchor.js';
import { ensureWorkspaceScope, requestWorkspaceId } from './workspaces.js';

interface PageSummary {
  slug: string;
  page_id: string;
  category: string;
  title: string;
  summary: string;
  author: 'agent' | 'user' | 'unknown';
  updated?: string;
  endorsed_by?: string;
  endorsed_at?: string;
  sources_count: number;
  scope?: string;
}

function readFrontmatter(filePath: string): Record<string, string> {
  const content = readFileSync(filePath, 'utf-8');
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1');
    fm[key] = value;
  }
  return fm;
}

function readPageBody(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  const m = content.match(/^---\n[\s\S]*?\n---\n(.*)$/s);
  return m ? m[1] : content;
}

function summariseDir(wikiDir: string, category: string): PageSummary[] {
  const dir = path.join(wikiDir, category);
  if (!existsSync(dir)) return [];
  const out: PageSummary[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md') || name === '_index.md') continue;
    const slug = name.replace(/\.md$/, '');
    const filePath = path.join(dir, name);
    const fm = readFrontmatter(filePath);
    const sourceCount = (fm['sources_claim_ids'] ?? fm['claim_ids'] ?? '').replace(/^\[|\]$/g, '').split(',').filter(Boolean).length;
    out.push({
      slug,
      page_id: fm['page_id'] ?? `page_${slug}`,
      category,
      title: fm['title'] ?? fm['entity'] ?? slug,
      summary: fm['summary'] ?? '',
      author: (fm['author'] as 'agent' | 'user') ?? 'unknown',
      updated: fm['updated'] ?? fm['compiled_at'],
      endorsed_by: fm['endorsed_by'],
      endorsed_at: fm['endorsed_at'],
      sources_count: sourceCount,
      scope: fm['scope'],
    });
  }
  return out.sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''));
}

const CATEGORIES = ['concepts', 'entities', 'decisions', 'synthesis', 'tombstones', 'profiles'] as const;

export function syncWikiToObjects(
  wikiDir: string,
  env: CoffeePodEnv,
  workspaceId: string,
  scope: string,
): number {
  const db = getDb(env);
  let synced = 0;
  for (const cat of CATEGORIES) {
    if (cat === 'tombstones') continue;
    for (const page of summariseDir(wikiDir, cat)) {
      if (page.scope !== scope) continue;
      const baseId = `wiki_${page.slug}`;
      const objId = workspaceId === DEFAULT_WORKSPACE_ID ? baseId : `${workspaceId}:${baseId}`;
      const filePath = path.join(wikiDir, cat, `${page.slug}.md`);
      if (!existsSync(filePath)) continue;
      const body = readPageBody(filePath);
      upsertObject(db, {
        id: objId,
        workspace_id: workspaceId,
        kind: 'page',
        title: page.title,
        content: body,
        origin: 'reflected',
        last_modified_by: 'substrate',
        summary: page.summary || null,
        tags: [cat, 'wiki', 'smartware'],
        metadata: {
          page_id: page.page_id,
          category: cat,
          author: page.author,
          sources_count: page.sources_count,
        },
      });
      synced++;
    }
  }
  return synced;
}

export async function registerWikiRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  app.get('/pod/wiki/categories', { schema: { summary: 'List wiki categories with page counts.' } }, async (request) => {
    const core = await getSmartwareCore(env);
    const workspaceScope = ensureWorkspaceScope(core, env, requestWorkspaceId(request));
    return CATEGORIES.map((cat) => ({
      category: cat,
      page_count: summariseDir(core.wikiDir, cat).filter(page => page.scope === workspaceScope).length,
    }));
  });

  app.get('/pod/wiki/pages', {
    schema: {
      summary: 'List pages in a category with summaries.',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: [...CATEGORIES] },
          author: { type: 'string', enum: ['agent', 'user', 'any'] },
        },
        required: ['category'],
      },
    },
  }, async (request) => {
    const core = await getSmartwareCore(env);
    const q = request.query as { category: typeof CATEGORIES[number]; author?: 'agent' | 'user' | 'any' };
    const workspaceScope = ensureWorkspaceScope(core, env, requestWorkspaceId(request));
    const all = summariseDir(core.wikiDir, q.category).filter(page => page.scope === workspaceScope);
    if (q.author && q.author !== 'any') {
      return all.filter((p) => p.author === q.author);
    }
    return all;
  });

  app.get('/pod/wiki/page/:slug', {
    schema: {
      summary: 'Read a single page (frontmatter + body).',
      params: {
        type: 'object',
        properties: { slug: { type: 'string' } },
        required: ['slug'],
      },
    },
  }, async (request, reply) => {
    const core = await getSmartwareCore(env);
    const { slug } = request.params as { slug: string };
    const workspaceScope = ensureWorkspaceScope(core, env, requestWorkspaceId(request));
    for (const cat of CATEGORIES) {
      const filePath = path.join(core.wikiDir, cat, `${slug}.md`);
      if (existsSync(filePath)) {
        const frontmatter = readFrontmatter(filePath);
        if (frontmatter['scope'] !== workspaceScope) continue;
        return {
          category: cat,
          slug,
          frontmatter,
          body: readPageBody(filePath),
        };
      }
    }
    return reply.code(404).send({ error: { code: 'not_found', message: `page '${slug}' not found in any category` } });
  });

  app.get('/pod/wiki/profile', { schema: { summary: 'Read the Self profile page (alias).' } }, async (request, reply) => {
    const core = await getSmartwareCore(env);
    const podProfile = getPodProfile(core, env);
    const filePath = path.join(core.wikiDir, 'profiles', 'self.md');
    if (!existsSync(filePath)) {
      return reply.code(404).send({ error: { code: 'not_found', message: 'Self profile not yet compiled. Run REFLECT target=profile.' } });
    }
    const knowledge = core.readKnowledgeGraph({
      actor: { type: 'person', id: 'person-local', display_name: 'Pod owner' },
      scopes: Object.values(podProfile.scopes),
    });
    const profile = await readSelfProfile(env, podProfile, knowledge);
    return {
      category: 'profiles' as const,
      slug: 'self',
      frontmatter: readFrontmatter(filePath),
      body: readPageBody(filePath),
      ...(profile ?? {}),
    };
  });
}
