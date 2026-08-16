import type { FastifyInstance, FastifyRequest } from 'fastify';
import { setTimeout as delay } from 'node:timers/promises';
import { chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

import type { CoffeePodEnv } from '../config/env.js';
import { createSession, destroyAllSessions, destroySession, validateSession } from '../security/sessions.js';

/* ── Per-IP brute-force throttle for /pod/pin/verify ── */
interface VerifyAttempts {
  fails: number;
  firstFailAt: number;
}
const verifyAttempts = new Map<string, VerifyAttempts>();
const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const VERIFY_LOCKOUT_AFTER = 10;
const VERIFY_LOCKOUT_MS = 30 * 1000;

function clientKey(request: FastifyRequest): string {
  return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
}

function recordVerifyFail(key: string): VerifyAttempts {
  const now = Date.now();
  const existing = verifyAttempts.get(key);
  if (!existing || now - existing.firstFailAt > VERIFY_WINDOW_MS) {
    const fresh = { fails: 1, firstFailAt: now };
    verifyAttempts.set(key, fresh);
    return fresh;
  }
  existing.fails += 1;
  return existing;
}

function clearVerifyFails(key: string): void {
  verifyAttempts.delete(key);
}

async function backoffFor(fails: number): Promise<void> {
  if (fails <= 2) return;
  // 100ms × 2^(fails-3) up to 5s. Tiny on early retries, painful after several.
  const ms = Math.min(5000, 100 * 2 ** Math.max(0, fails - 3));
  await delay(ms);
}

/* ── PIN storage shape ── */
interface PinData {
  algorithm?: 'scrypt'; // Missing on legacy SHA-256 records.
  hash: string;
  salt: string;      // 16-byte hex salt
  length?: number;   // PIN length (legacy files predate this field; unlock historically assumed 4)
  hint?: string;     // Optional user-set hint
  attempts: number;  // Failed attempts since last success
  created_at: string;
}

function configuredPinLength(data: PinData): number {
  const length = data.length;
  return typeof length === 'number' && Number.isInteger(length) && length >= 4 && length <= 6 ? length : 4;
}

function pinPath(env: CoffeePodEnv): string {
  return join(env.dataDir, 'pin.json');
}

function hashLegacyPin(pin: string, salt: string): string {
  return createHash('sha256').update(`${pin}:${salt}`).digest('hex');
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(pin, salt, 32, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
  return derived.toString('hex');
}

async function pinMatches(pin: string, data: PinData): Promise<boolean> {
  const expected = Buffer.from(data.hash, 'hex');
  const actualHash = data.algorithm === 'scrypt'
    ? await hashPin(pin, data.salt)
    : hashLegacyPin(pin, data.salt);
  const actual = Buffer.from(actualHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function upgradeLegacyPin(pin: string, data: PinData): Promise<void> {
  if (data.algorithm === 'scrypt') return;
  data.algorithm = 'scrypt';
  data.salt = randomBytes(16).toString('hex');
  data.hash = await hashPin(pin, data.salt);
}

async function readPin(env: CoffeePodEnv): Promise<PinData | null> {
  try {
    const raw = await readFile(pinPath(env), 'utf-8');
    return JSON.parse(raw) as PinData;
  } catch {
    return null;
  }
}

async function writePin(env: CoffeePodEnv, data: PinData): Promise<void> {
  const file = pinPath(env);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await chmod(file, 0o600);
}

async function clearPin(env: CoffeePodEnv): Promise<void> {
  try {
    await unlink(pinPath(env));
  } catch {
    // Already gone.
  }
}

/* ── Routes ── */
export async function registerPinRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {

  /* GET /pod/pin/status — is a PIN set? (public) */
  app.get('/pod/pin/status', {
    schema: {
      tags: ['pin'],
      summary: 'Check if a PIN lock is configured',
      response: {
        200: {
          type: 'object',
          properties: {
            has_pin: { type: 'boolean' },
            pin_length: { type: 'integer', minimum: 4, maximum: 6, nullable: true },
            hint: { type: 'string', nullable: true },
            show_hint: { type: 'boolean' },
          },
        },
      },
    },
  }, async () => {
    const data = await readPin(env);
    if (!data) return { has_pin: false, pin_length: null, hint: null, show_hint: false };
    return {
      has_pin: true,
      pin_length: configuredPinLength(data),
      hint: data.attempts >= 3 ? (data.hint ?? null) : null,
      show_hint: data.attempts >= 3 && !!data.hint,
    };
  });

  /* POST /pod/pin/verify — check a PIN */
  app.post('/pod/pin/verify', {
    schema: {
      tags: ['pin'],
      summary: 'Verify the device PIN',
      body: {
        type: 'object',
        required: ['pin'],
        properties: { pin: { type: 'string', minLength: 4, maxLength: 6, pattern: '^[0-9]+$' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            session_token: { type: 'string', nullable: true },
            hint: { type: 'string', nullable: true },
            show_hint: { type: 'boolean' },
          },
        },
        429: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { pin } = request.body as { pin: string };
    const key = clientKey(request);
    const existing = verifyAttempts.get(key);
    if (existing && existing.fails >= VERIFY_LOCKOUT_AFTER && Date.now() - existing.firstFailAt < VERIFY_LOCKOUT_MS * (existing.fails - VERIFY_LOCKOUT_AFTER + 1)) {
      reply.code(429);
      return { error: 'too_many_attempts', message: 'Too many PIN attempts. Wait before trying again.' };
    }

    const data = await readPin(env);
    if (!data) return { success: true, session_token: null, hint: null, show_hint: false };

    const match = await pinMatches(pin, data);
    if (match) {
      await upgradeLegacyPin(pin, data);
      data.length ??= pin.length;
      data.attempts = 0;
      await writePin(env, data);
      clearVerifyFails(key);
      const session = createSession();
      return { success: true, session_token: session.token, hint: null, show_hint: false };
    }

    const tracker = recordVerifyFail(key);
    data.attempts += 1;
    await writePin(env, data);
    await backoffFor(tracker.fails);
    const showHint = data.attempts >= 3 && !!data.hint;
    return {
      success: false,
      session_token: null,
      hint: showHint ? data.hint : null,
      show_hint: showHint,
    };
  });

  /* POST /pod/pin/set — create or update PIN */
  app.post('/pod/pin/set', {
    schema: {
      tags: ['pin'],
      summary: 'Set or update the device PIN',
      body: {
        type: 'object',
        required: ['pin'],
        properties: {
          pin: { type: 'string', minLength: 4, maxLength: 6, pattern: '^[0-9]+$' },
          hint: { type: 'string', maxLength: 120 },
          current_pin: { type: 'string', minLength: 4, maxLength: 6, pattern: '^[0-9]+$' },
        },
      },
    },
  }, async (request, reply) => {
    const { pin, hint, current_pin } = request.body as { pin: string; hint?: string; current_pin?: string };
    const existing = await readPin(env);

    // If a PIN already exists, require current PIN to change it
    if (existing && current_pin) {
      if (!await pinMatches(current_pin, existing)) {
        return reply.code(403).send({ error: 'wrong_pin', message: 'Current PIN is incorrect' });
      }
    } else if (existing && !current_pin) {
      return reply.code(403).send({ error: 'pin_required', message: 'Current PIN required to change PIN' });
    }

    const salt = randomBytes(16).toString('hex');
    const data: PinData = {
      algorithm: 'scrypt',
      hash: await hashPin(pin, salt),
      salt,
      length: pin.length,
      hint: hint?.trim() || undefined,
      attempts: 0,
      created_at: new Date().toISOString(),
    };
    await writePin(env, data);
    destroyAllSessions();
    return { success: true };
  });

  /* DELETE /pod/pin — remove the PIN lock */
  app.delete('/pod/pin', {
    schema: {
      tags: ['pin'],
      summary: 'Remove the device PIN lock',
      body: {
        type: 'object',
        required: ['pin'],
        properties: { pin: { type: 'string', minLength: 4, maxLength: 6, pattern: '^[0-9]+$' } },
      },
    },
  }, async (request, reply) => {
    const { pin } = request.body as { pin: string };
    const existing = await readPin(env);
    if (!existing) return { success: true };

    if (!await pinMatches(pin, existing)) {
      return reply.code(403).send({ error: 'wrong_pin', message: 'PIN is incorrect' });
    }

    await clearPin(env);
    destroyAllSessions();
    return { success: true };
  });

  /* GET /pod/session/status — check if the current session token is valid (public) */
  app.get('/pod/session/status', {
    schema: {
      tags: ['pin'],
      summary: 'Check if the current session is valid',
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            has_pin: { type: 'boolean' },
            pin_length: { type: 'integer', minimum: 4, maximum: 6, nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    const session = token ? validateSession(token) : null;
    const isApiToken = !!token && !!env.apiToken && token === env.apiToken;
    const data = await readPin(env);
    return {
      valid: !!session || isApiToken,
      has_pin: !!data,
      pin_length: data ? configuredPinLength(data) : null,
    };
  });

  /* POST /pod/session/lock — destroy the current session (lock the app) */
  app.post('/pod/session/lock', {
    schema: {
      tags: ['pin'],
      summary: 'Lock the app by destroying the current session',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request) => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    if (token) destroySession(token);
    return { success: true };
  });
}
