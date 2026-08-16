// Sidecar skeleton verification (commit 8406e38).
//
// The Slack + GitHub sidecars from PR-12 are not standalone processes —
// they're modules exporting Sidecar interface implementations whose
// connect() / backfill() are stubs pending live OAuth. There is nothing
// to "start in isolation"; verification here confirms:
//   - The exported Sidecar object has the expected actor_id / source
//   - status() returns the spec shape without throwing
//   - backfill() returns the zero-event report shape without throwing
//   - No stderr output is produced during these calls

import test from 'node:test';
import assert from 'node:assert/strict';

import { slackSidecar } from '../../services/sidecars/slack.js';
import { githubSidecar } from '../../services/sidecars/github.js';

const FAKE_ENV = {
  host: '127.0.0.1',
  port: 0,
  dataDir: '/tmp/coffee-pod-sidecar-isolation',
  ownerId: undefined,
  podId: 'sidecar-iso',
  podName: 'Sidecar Iso',
  apiToken: undefined,
  mcpClientEnabled: false,
  mcpDockerCommand: 'docker',
  mcpPortBase: 5100,
} as const;

function captureStderr<T>(fn: () => Promise<T>): Promise<{ result: T; stderr: string }> {
  const original = process.stderr.write.bind(process.stderr);
  let captured = '';
  (process.stderr as unknown as { write: (chunk: unknown) => boolean }).write = (chunk: unknown) => {
    captured += String(chunk);
    return true;
  };
  return fn()
    .then((result) => ({ result, stderr: captured }))
    .finally(() => {
      (process.stderr as unknown as { write: typeof original }).write = original;
    });
}

test('8406e38: slackSidecar exports the spec actor_id and source', () => {
  assert.equal(slackSidecar.actor_id, 'sidecar:slack');
  assert.equal(slackSidecar.source, 'slack');
});

test('8406e38: slackSidecar.status() returns SidecarStatus shape; no stderr', async () => {
  const { result, stderr } = await captureStderr(async () => slackSidecar.status!(FAKE_ENV));
  assert.equal(result.actor_id, 'sidecar:slack');
  assert.equal(typeof result.connected, 'boolean');
  assert.equal(typeof result.events_observed, 'number');
  assert.equal(stderr, '', `expected no stderr from status(), got: ${stderr}`);
});

test('8406e38: slackSidecar.backfill() returns zero-event report; no stderr', async () => {
  const { result, stderr } = await captureStderr(async () => slackSidecar.backfill!(FAKE_ENV, '7d'));
  assert.equal(result.events_seen, 0);
  assert.equal(result.events_observed, 0);
  assert.equal(result.events_filtered, 0);
  assert.equal(typeof result.duration_ms, 'number');
  assert.equal(stderr, '', `expected no stderr from backfill(), got: ${stderr}`);
});

test('8406e38: githubSidecar exports the spec actor_id and source', () => {
  assert.equal(githubSidecar.actor_id, 'sidecar:github');
  assert.equal(githubSidecar.source, 'github');
});

test('8406e38: githubSidecar.status() returns SidecarStatus shape; no stderr', async () => {
  const { result, stderr } = await captureStderr(async () => githubSidecar.status!(FAKE_ENV));
  assert.equal(result.actor_id, 'sidecar:github');
  assert.equal(typeof result.connected, 'boolean');
  assert.equal(stderr, '', `expected no stderr from status(), got: ${stderr}`);
});

test('8406e38: githubSidecar.backfill() returns zero-event report; no stderr', async () => {
  const { result, stderr } = await captureStderr(async () => githubSidecar.backfill!(FAKE_ENV, '30d'));
  assert.equal(result.events_seen, 0);
  assert.equal(result.events_observed, 0);
  assert.equal(stderr, '', `expected no stderr from backfill(), got: ${stderr}`);
});

test('8406e38: sidecars do not expose connect() yet (live OAuth deferred)', () => {
  // The Sidecar interface declares connect as optional. These skeletons
  // intentionally omit it — calling status() reflects that with a note.
  assert.equal(slackSidecar.connect, undefined);
  assert.equal(githubSidecar.connect, undefined);
});
