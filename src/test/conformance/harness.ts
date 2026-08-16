// Shared helpers for the Smartware conformance suite.
//
// These tests target Spec v1.5.4.2 / Protocol Contract v0.4.1 / Schemas v0.1.2
// and Conformance Test Spec v0.1.1. Each test in this directory references its
// spec ID in the test name (e.g. "RC-03: numeric min_confidence rejected").
//
// Many of these tests are intentionally RED on the current branch. They
// document the conformance target; later PRs in Phase A/B turn them green.

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildApp } from '../../app.js';
import type { CoffeePodEnv } from '../../config/env.js';
import { closeSmartwareCore, getPodProfile, getSmartwareCore } from '../../smartware/core.js';

export function conformanceEnv(
  dataDir: string,
  overrides: Partial<CoffeePodEnv> = {},
): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'conformance-test',
    podName: 'Conformance Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
    ...overrides,
  };
}

export interface ConformanceHandle {
  app: Awaited<ReturnType<typeof buildApp>>;
  dataDir: string;
  teardown: () => Promise<void>;
}

/**
 * Build a Pod app with seeded grants for the actors the conformance
 * suite needs. We register `agent:test`, `user:test`, and `substrate:coffee`
 * with permissive grants on every founder-pod scope. Tests focused on
 * authorization use a different harness that suppresses these.
 */
export async function buildConformanceApp(
  overrides: Partial<CoffeePodEnv> = {},
): Promise<ConformanceHandle> {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-conformance-'));
  const env = conformanceEnv(dataDir, overrides);
  const app = await buildApp(env, false);

  // Seed permissive grants so conformance tests don't trip over
  // requireGrant. Tests that specifically exercise ACCESS denial set up
  // their own actors without grants.
  const core = await getSmartwareCore(env);
  const profile = getPodProfile(core, env);
  const scopes = Object.values(profile.scopes);
  core.ensureTrustedClientGrant('agent:test', 'agent', scopes);
  core.ensureTrustedClientGrant('user:test', 'person', scopes);
  core.ensureTrustedClientGrant('substrate:coffee', 'system', scopes);

  const teardown = async () => {
    await app.close();
    await closeSmartwareCore();
  };
  return { app, dataDir, teardown };
}

// A response is conformant-rejected if it carries the expected error envelope
// (per Protocol Contract v0.4.1's universal error shape) AND the documented
// HTTP status per transport-bindings v0.1.1.
export interface ConformanceErrorExpectation {
  status: number;
  code: string;
}

export function assertConformanceError(
  response: { statusCode: number; payload: string },
  expected: ConformanceErrorExpectation,
  context: string,
): { ok: boolean; reason: string } {
  if (response.statusCode !== expected.status) {
    return {
      ok: false,
      reason: `${context}: expected HTTP ${expected.status}, got ${response.statusCode}. Body: ${response.payload}`,
    };
  }
  let body: unknown;
  try {
    body = JSON.parse(response.payload);
  } catch {
    return {
      ok: false,
      reason: `${context}: response body is not JSON. Got: ${response.payload}`,
    };
  }
  const error = (body as { error?: { code?: string } } | null)?.error;
  if (!error || typeof error !== 'object') {
    return {
      ok: false,
      reason: `${context}: response is missing the { error: ... } envelope. Got: ${response.payload}`,
    };
  }
  if (error.code !== expected.code) {
    return {
      ok: false,
      reason: `${context}: expected error.code "${expected.code}", got "${error.code}". Body: ${response.payload}`,
    };
  }
  return { ok: true, reason: 'ok' };
}

// Generate a syntactically-valid OperationId for use in test payloads.
// Pattern per common.schema.json: ^op_[0-9A-HJKMNP-TV-Z]{26}$
// We use a fixed stand-in here — real ULID generation lives in the substrate.
let opCounter = 0;
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function fakeOperationId(): string {
  opCounter += 1;
  // 26 chars from the Crockford alphabet, deterministic by counter for replays
  const padded = opCounter.toString().padStart(26, '0');
  let body = '';
  for (const ch of padded) {
    const digit = parseInt(ch, 10);
    body += ULID_ALPHABET[digit];
  }
  return `op_${body}`;
}
