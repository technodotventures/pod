// Webhook receiver verification (commit 30dc2e6).
//
// Exercises /webhooks/slack and /webhooks/github via Fastify inject:
//   - 200 on a valid signed payload
//   - 401 on tampered signature
//   - 503 when the signing secret env var is missing
//
// Uses the substrate's own signature helpers to construct valid
// payloads (same code path the verifier runs). Tampered case is
// produced by mutating the signed body after signing.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';

import { buildConformanceApp } from './harness.js';

// ── Slack ────────────────────────────────────────────────────────────

function slackSign(secret: string, timestamp: string, body: string): string {
  const base = `v0:${timestamp}:${body}`;
  return 'v0=' + createHash('sha256').update(`${secret}${base}`).digest('hex');
}

test('30dc2e6: /webhooks/slack returns 503 when SLACK_SIGNING_SECRET unset', async () => {
  const prior = process.env.SLACK_SIGNING_SECRET;
  delete process.env.SLACK_SIGNING_SECRET;
  const { app, teardown } = await buildConformanceApp();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/slack',
      payload: { type: 'url_verification', challenge: 'abc' },
      headers: { 'x-slack-signature': 'v0=00', 'x-slack-request-timestamp': '0' },
    });
    assert.equal(response.statusCode, 503, `expected 503, got ${response.statusCode}: ${response.payload}`);
    const body = response.json() as { error: { code: string } };
    assert.equal(body.error.code, 'sidecar_unconfigured');
  } finally {
    if (prior !== undefined) process.env.SLACK_SIGNING_SECRET = prior;
    await teardown();
  }
});

test('30dc2e6: /webhooks/slack returns 400 when signature headers missing', async () => {
  process.env.SLACK_SIGNING_SECRET = 'test-secret';
  const { app, teardown } = await buildConformanceApp();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/slack',
      payload: { type: 'url_verification', challenge: 'abc' },
    });
    assert.equal(response.statusCode, 400);
    const body = response.json() as { error: { code: string } };
    assert.equal(body.error.code, 'invalid_payload');
  } finally {
    delete process.env.SLACK_SIGNING_SECRET;
    await teardown();
  }
});

test('30dc2e6: /webhooks/slack rejects tampered signature with 401', async () => {
  process.env.SLACK_SIGNING_SECRET = 'test-secret';
  const { app, teardown } = await buildConformanceApp();
  try {
    const payload = { type: 'url_verification', challenge: 'abc-challenge' };
    const ts = '1700000000';
    // sign the original body...
    const goodSig = slackSign('test-secret', ts, JSON.stringify(payload));
    // ...then tamper the signature
    const tamperedSig = goodSig.slice(0, -2) + (goodSig.endsWith('00') ? 'ff' : '00');
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/slack',
      payload,
      headers: {
        'x-slack-signature': tamperedSig,
        'x-slack-request-timestamp': ts,
      },
    });
    assert.equal(response.statusCode, 401, `expected 401, got ${response.statusCode}: ${response.payload}`);
    const body = response.json() as { error: { code: string } };
    assert.equal(body.error.code, 'forbidden');
  } finally {
    delete process.env.SLACK_SIGNING_SECRET;
    await teardown();
  }
});

test('30dc2e6: /webhooks/slack accepts a signed message event (exercises OBSERVE path)', async () => {
  process.env.SLACK_SIGNING_SECRET = 'test-secret';
  const { app, teardown } = await buildConformanceApp();
  try {
    const payload = {
      type: 'event_callback',
      event: {
        type: 'message',
        ts: '1700000000.000100',
        channel_id: 'C123',
        channel_name: 'general',
        user: 'U1',
        user_display_name: 'alice',
        text: 'A reasonably substantive message about the auth refactor decision.',
      },
    };
    const ts = '1700000000';
    const bodyStr = JSON.stringify(payload);
    const sig = slackSign('test-secret', ts, bodyStr);
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/slack',
      payload,
      headers: {
        'x-slack-signature': sig,
        'x-slack-request-timestamp': ts,
      },
    });
    assert.equal(response.statusCode, 200, `expected 200, got ${response.statusCode}: ${response.payload}`);
    const body = response.json() as { ok?: boolean };
    assert.equal(body.ok, true);
  } finally {
    delete process.env.SLACK_SIGNING_SECRET;
    await teardown();
  }
});

test('30dc2e6: /webhooks/slack accepts url_verification with valid signature, echoes challenge', async () => {
  process.env.SLACK_SIGNING_SECRET = 'test-secret';
  const { app, teardown } = await buildConformanceApp();
  try {
    const payload = { type: 'url_verification', challenge: 'abc-challenge' };
    const ts = '1700000000';
    // Fastify's JSON.stringify is what verifier sees inside the handler.
    const bodyStr = JSON.stringify(payload);
    const sig = slackSign('test-secret', ts, bodyStr);
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/slack',
      payload,
      headers: {
        'x-slack-signature': sig,
        'x-slack-request-timestamp': ts,
      },
    });
    assert.equal(response.statusCode, 200, `expected 200, got ${response.statusCode}: ${response.payload}`);
    const body = response.json() as { challenge?: string };
    assert.equal(body.challenge, 'abc-challenge');
  } finally {
    delete process.env.SLACK_SIGNING_SECRET;
    await teardown();
  }
});

// ── GitHub ───────────────────────────────────────────────────────────

function githubSign(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

test('30dc2e6: /webhooks/github returns 503 when GITHUB_WEBHOOK_SECRET unset', async () => {
  const prior = process.env.GITHUB_WEBHOOK_SECRET;
  delete process.env.GITHUB_WEBHOOK_SECRET;
  const { app, teardown } = await buildConformanceApp();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/github',
      payload: { action: 'opened' },
      headers: { 'x-hub-signature-256': 'sha256=ff', 'x-github-event': 'pull_request' },
    });
    assert.equal(response.statusCode, 503);
    const body = response.json() as { error: { code: string } };
    assert.equal(body.error.code, 'sidecar_unconfigured');
  } finally {
    if (prior !== undefined) process.env.GITHUB_WEBHOOK_SECRET = prior;
    await teardown();
  }
});

test('30dc2e6: /webhooks/github returns 400 when X-Hub-Signature-256 missing', async () => {
  process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
  const { app, teardown } = await buildConformanceApp();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/github',
      payload: { action: 'opened' },
      headers: { 'x-github-event': 'pull_request' },
    });
    assert.equal(response.statusCode, 400);
    const body = response.json() as { error: { code: string } };
    assert.equal(body.error.code, 'invalid_payload');
  } finally {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    await teardown();
  }
});

test('30dc2e6: /webhooks/github rejects tampered signature with 401', async () => {
  process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
  const { app, teardown } = await buildConformanceApp();
  try {
    const payload = { action: 'opened', pull_request: { number: 1, user: { login: 'alice', type: 'User' }, title: 't', body: null, labels: [], state: 'open' }, repository: { full_name: 'acme/x' } };
    const bodyStr = JSON.stringify(payload);
    const goodSig = githubSign('test-secret', bodyStr);
    const tamperedSig = goodSig.slice(0, -2) + (goodSig.endsWith('00') ? 'ff' : '00');
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/github',
      payload,
      headers: {
        'x-hub-signature-256': tamperedSig,
        'x-github-event': 'pull_request',
      },
    });
    assert.equal(response.statusCode, 401, `expected 401, got ${response.statusCode}: ${response.payload}`);
    const body = response.json() as { error: { code: string } };
    assert.equal(body.error.code, 'forbidden');
  } finally {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    await teardown();
  }
});

test('30dc2e6: /webhooks/github accepts a signed pull_request event with 200', async () => {
  process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
  const { app, teardown } = await buildConformanceApp();
  try {
    const payload = {
      action: 'opened',
      pull_request: {
        number: 42,
        user: { login: 'alice', type: 'User' },
        title: 'Architectural choice: migrate from JWT to session tokens',
        body: 'A reasonably substantive PR body explaining the rationale.',
        labels: [{ name: 'decision' }],
        state: 'open',
        merged: false,
      },
      repository: { full_name: 'acme/platform', default_branch: 'main' },
    };
    const bodyStr = JSON.stringify(payload);
    const sig = githubSign('test-secret', bodyStr);
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/github',
      payload,
      headers: {
        'x-hub-signature-256': sig,
        'x-github-event': 'pull_request',
      },
    });
    assert.equal(response.statusCode, 200, `expected 200, got ${response.statusCode}: ${response.payload}`);
    const body = response.json() as { ok?: boolean };
    assert.equal(body.ok, true);
  } finally {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    await teardown();
  }
});
