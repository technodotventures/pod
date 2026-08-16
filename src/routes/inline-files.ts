/**
 * Inline file storage for the rich-text editor.
 *
 * Separate from /pod/upload (which runs the full ingestion pipeline and
 * creates Pod objects). Files saved here are referenced from inline blocks
 * inside a doc — they're storage-only, no compile, no observation.
 *
 * Layout: data/files/inline/<sha256>.<ext>
 *
 * POST /pod/files/inline
 *   multipart `file` field — typical drag/drop or file picker
 * POST /pod/files/inline/base64
 *   JSON { data_url: 'data:image/png;base64,...' } — used by the editor's
 *   clipboard paste handler (pasted screenshots arrive as data URLs)
 * GET  /pod/files/inline/:name
 *   serve the file back. Strict allow-list on the filename pattern.
 */
import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

import type { CoffeePodEnv } from '../config/env.js';
import { requireActorAuth } from '../security/auth.js';

const MAX_INLINE_BYTES = 20 * 1024 * 1024; // 20 MB per file
const ALLOWED_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif']);
const FILENAME_RE = /^[a-f0-9]{64}\.[a-z]{2,5}$/;

function inlineDir(env: CoffeePodEnv): string {
  return join(env.dataDir, 'files', 'inline');
}

function mimeFromExt(ext: string): string {
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'avif': return 'image/avif';
    default: return 'application/octet-stream';
  }
}

function extFromMime(mime: string): string | null {
  switch (mime) {
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/gif': return 'gif';
    case 'image/webp': return 'webp';
    case 'image/svg+xml': return 'svg';
    case 'image/avif': return 'avif';
    default: return null;
  }
}

export async function registerInlineFileRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  // @fastify/multipart may already be registered by /pod/upload; register
  // idempotently if not already on the app.
  if (!(app as unknown as { hasContentTypeParser: (t: string) => boolean }).hasContentTypeParser('multipart/form-data')) {
    await app.register(multipart, {
      limits: { fileSize: MAX_INLINE_BYTES, files: 1 },
    });
  }

  /** POST /pod/files/inline — multipart upload */
  app.post('/pod/files/inline', async (request, reply) => {
    if (!await requireActorAuth(request, reply, env, 'person-local')) return;
    const part = await request.file?.();
    if (!part) return reply.code(400).send({ error: 'no_file', message: 'Multipart "file" field required' });

    const ext = (extFromMime(part.mimetype) ?? extname(part.filename ?? '').replace('.', '').toLowerCase());
    if (!ALLOWED_EXT.has(ext)) {
      return reply.code(415).send({ error: 'unsupported_type', message: `Allowed: ${[...ALLOWED_EXT].join(', ')}` });
    }
    const buf = await part.toBuffer();
    if (buf.length > MAX_INLINE_BYTES) {
      return reply.code(413).send({ error: 'too_large', message: `Max ${MAX_INLINE_BYTES} bytes` });
    }
    const hash = createHash('sha256').update(buf).digest('hex');
    const name = `${hash}.${ext}`;
    const dir = inlineDir(env);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), buf);
    return { url: `/pod/files/inline/${name}`, name, bytes: buf.length, mime: mimeFromExt(ext) };
  });

  /** POST /pod/files/inline/base64 — for pasted-from-clipboard data URLs */
  app.post('/pod/files/inline/base64', async (request, reply) => {
    if (!await requireActorAuth(request, reply, env, 'person-local')) return;
    const body = request.body as { data_url?: string };
    if (!body?.data_url || typeof body.data_url !== 'string') {
      return reply.code(400).send({ error: 'invalid_body', message: 'JSON body with data_url required' });
    }
    const match = body.data_url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return reply.code(400).send({ error: 'invalid_data_url', message: 'data_url must be base64 data URL' });
    const mime = match[1];
    const ext = extFromMime(mime);
    if (!ext) return reply.code(415).send({ error: 'unsupported_type', message: `Allowed mimes: image/png|jpeg|gif|webp|svg+xml|avif` });
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > MAX_INLINE_BYTES) {
      return reply.code(413).send({ error: 'too_large', message: `Max ${MAX_INLINE_BYTES} bytes` });
    }
    const hash = createHash('sha256').update(buf).digest('hex');
    const name = `${hash}.${ext}`;
    const dir = inlineDir(env);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), buf);
    return { url: `/pod/files/inline/${name}`, name, bytes: buf.length, mime };
  });

  /** GET /pod/files/inline/:name — serve back. Public (no auth) — file
   *  is referenced from <img src> so the browser fetches it directly.
   *  Names are hash-of-content; not enumerable. */
  app.get<{ Params: { name: string } }>('/pod/files/inline/:name', async (request, reply) => {
    const name = request.params.name;
    if (!FILENAME_RE.test(name)) return reply.code(400).send({ error: 'invalid_name' });
    const path = join(inlineDir(env), name);
    try {
      await stat(path);
    } catch {
      return reply.code(404).send({ error: 'not_found' });
    }
    const ext = name.split('.').pop()!.toLowerCase();
    const buf = await readFile(path);
    reply.header('content-type', mimeFromExt(ext));
    reply.header('cache-control', 'public, max-age=31536000, immutable');
    return reply.send(buf);
  });
}
