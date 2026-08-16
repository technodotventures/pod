// OperationId retry conformance. Crash recovery remains an explicit protocol
// gap: the current substrate can detect L1 orphans but cannot safely complete
// or quarantine a cross-surface operation with the metadata it persists.

import test from 'node:test';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  appendClaimVersion,
  readAllOpLogEntries,
  readClaimHistory,
  type ClaimVersionRecord,
} from 'smartware';

import {
  buildConformanceApp,
  conformanceEnv,
  assertConformanceError,
  fakeOperationId,
} from './harness.js';
import assert from 'node:assert/strict';
import { buildApp } from '../../app.js';
import { closeSmartwareCore, getSmartwareCore } from '../../smartware/core.js';
import { closeDb } from '../../pod/db.js';

async function evidenceLineCount(dataDir: string): Promise<number> {
  const evidenceFiles = await readdir(path.join(dataDir, 'evidence'));
  return (await Promise.all(evidenceFiles
    .filter(file => file.endsWith('.jsonl'))
    .map(file => readFile(path.join(dataDir, 'evidence', file), 'utf8'))))
    .flatMap(raw => raw.split('\n').filter(Boolean)).length;
}

async function runCrashChild(args: string[]): Promise<{ code: number | null; signal: NodeJS.Signals | null; stderr: string }> {
  const fixture = path.join(process.cwd(), 'src', 'test', 'fixtures', 'observe-crash-child.mjs');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fixture, ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stderr }));
  });
}

async function runReviseCrashChild(args: string[]): Promise<{ code: number | null; signal: NodeJS.Signals | null; stderr: string }> {
  const fixture = path.join(process.cwd(), 'src', 'test', 'fixtures', 'revise-crash-child.mjs');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fixture, ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stderr }));
  });
}

async function runLifecycleCrashChild(args: string[]): Promise<{ code: number | null; signal: NodeJS.Signals | null; stderr: string }> {
  const fixture = path.join(process.cwd(), 'src', 'test', 'fixtures', 'claim-lifecycle-crash-child.mjs');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fixture, ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stderr }));
  });
}

async function runEndorseCrashChild(args: string[]): Promise<{ code: number | null; signal: NodeJS.Signals | null; stderr: string }> {
  const fixture = path.join(process.cwd(), 'src', 'test', 'fixtures', 'endorse-crash-child.mjs');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fixture, ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stderr }));
  });
}

async function runReflectCrashChild(args: string[]): Promise<{ code: number | null; signal: NodeJS.Signals | null; stderr: string }> {
  const fixture = path.join(process.cwd(), 'src', 'test', 'fixtures', 'reflect-crash-child.mjs');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fixture, ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stderr }));
  });
}

test('A0/IT-06: same operation_id retried with same payload returns prior result', async () => {
  const { app, dataDir, teardown } = await buildConformanceApp();
  try {
    const operation_id = fakeOperationId();
    const payload = {
      actor_id: 'agent:test',
      content: 'Stable observation content',
      scope_alias: 'personal',
      operation_id,
    };

    const first = await app.inject({ method: 'POST', url: '/pod/observe', payload });
    assert.equal(first.statusCode, 200, `first call failed: ${first.payload}`);
    const firstResult = first.json() as { id: string };

    const second = await app.inject({ method: 'POST', url: '/pod/observe', payload });
    assert.equal(second.statusCode, 200, `second call failed: ${second.payload}`);
    const secondResult = second.json() as { id: string };

    // Idempotent retry returns the same observation id without writing again.
    assert.equal(secondResult.id, firstResult.id, 'idempotent retry should return prior observation_id');
    const commits = [...readAllOpLogEntries(path.join(dataDir, 'operations'))]
      .filter(entry => entry.operation_id === operation_id);
    assert.equal(commits.length, 1, 'Smartware must be the only canonical OBSERVE committer');
  } finally {
    await teardown();
  }
});

test('A0/IT-08: real process kills at every OBSERVE boundary converge after Pod restart', async () => {
  for (const phase of ['afterIntent', 'afterObservation', 'afterCommit']) {
    const dataDir = await mkdtemp(path.join(tmpdir(), `coffee-pod-observe-${phase}-`));
    const env = conformanceEnv(dataDir, { ownerId: 'user:owner' });
    const operation_id = fakeOperationId();
    const scope = `pod/${env.podId}/personal`;
    const content = `Interrupted Pod observation at ${phase}`;
    let restartedApp: Awaited<ReturnType<typeof buildApp>> | null = null;
    try {
      const initialApp = await buildApp(env, false);
      const initialCore = await getSmartwareCore(env);
      initialCore.createPodProfile(env.podId, env.podName);
      await initialApp.close();
      await closeSmartwareCore();
      closeDb();

      const crash = await runCrashChild([dataDir, phase, operation_id, scope, content]);
      assert.equal(crash.signal, 'SIGKILL', `${phase} child did not die by SIGKILL: ${crash.stderr}`);

      restartedApp = await buildApp(env, false);
      await getSmartwareCore(env);
      const beforeRetry = [...readAllOpLogEntries(path.join(dataDir, 'operations'))]
        .filter(entry => entry.operation_id === operation_id);
      assert.equal(beforeRetry.length, phase === 'afterIntent' ? 0 : 1, `${phase} restart disposition`);
      if (phase === 'afterObservation') assert.equal(beforeRetry[0]?.details?.['recovered'], true);

      const retry = await restartedApp.inject({
        method: 'POST',
        url: '/pod/observe',
        payload: {
          actor_id: 'user:owner',
          content,
          scope_alias: 'personal',
          operation_id,
        },
      });
      assert.equal(retry.statusCode, 200, `${phase}: ${retry.payload}`);
      assert.equal(await evidenceLineCount(dataDir), 1, `${phase} retry duplicated L0`);
      assert.equal([...readAllOpLogEntries(path.join(dataDir, 'operations'))]
        .filter(entry => entry.operation_id === operation_id).length, 1, `${phase} duplicated commit`);
    } finally {
      await restartedApp?.close();
      await closeSmartwareCore();
      closeDb();
      await rm(dataDir, { recursive: true, force: true });
    }
  }
});

test('A0/IT-09: real process kills at every REVISE boundary converge after Pod restart', async () => {
  for (const phase of ['afterIntent', 'afterClaimVersion', 'afterCommit']) {
    const dataDir = await mkdtemp(path.join(tmpdir(), `coffee-pod-revise-${phase}-`));
    const env = conformanceEnv(dataDir, { ownerId: 'user:owner' });
    const operation_id = fakeOperationId();
    const claimId = `claim_${'0'.repeat(26)}`;
    let restartedApp: Awaited<ReturnType<typeof buildApp>> | null = null;
    try {
      const initialApp = await buildApp(env, false);
      const initialCore = await getSmartwareCore(env);
      const profile = initialCore.createPodProfile(env.podId, env.podName);
      const seed: ClaimVersionRecord = {
        claim_id: claimId,
        version: 1,
        state: 'active',
        content: 'A claim whose private content must never enter the operation intent.',
        claim_type: 'finding',
        claim_role: 'memory',
        author: 'agent',
        epistemic_owner: 'agent',
        fingerprint: `fp_${'1'.repeat(26)}`,
        confidence: 'low',
        epistemic_tag: 'inference',
        scope: profile.scopes.personal,
        derived_from: [],
        relations: [],
        created_at: '2026-01-01T00:00:00.000Z',
        version_at: '2026-01-01T00:00:00.000Z',
        operation_id: fakeOperationId(),
        actor_id: 'substrate:test',
        tags: [],
      };
      appendClaimVersion(dataDir, seed);
      await initialApp.close();
      await closeSmartwareCore();
      closeDb();

      const crash = await runReviseCrashChild([dataDir, phase, operation_id, claimId]);
      assert.equal(crash.signal, 'SIGKILL', `${phase} child did not die by SIGKILL: ${crash.stderr}`);
      const rawIntent = await readFile(path.join(dataDir, 'operations', 'intents', `${operation_id}.json`), 'utf8');
      assert.equal(rawIntent.includes(seed.content), false, `${phase} intent leaked claim content`);
      assert.equal((await stat(path.join(dataDir, 'operations', 'intents', `${operation_id}.json`))).mode & 0o777, 0o600);

      restartedApp = await buildApp(env, false);
      await getSmartwareCore(env);
      const beforeRetry = [...readAllOpLogEntries(path.join(dataDir, 'operations'))]
        .filter(entry => entry.operation_id === operation_id);
      assert.equal(beforeRetry.length, phase === 'afterIntent' ? 0 : 1, `${phase} restart disposition`);
      if (phase === 'afterClaimVersion') assert.equal(beforeRetry[0]?.details?.['recovered'], true);

      const retry = await restartedApp.inject({
        method: 'POST',
        url: '/pod/revise',
        payload: {
          actor_id: 'user:owner',
          target: { type: 'claim', id: claimId },
          expected_base_version: 1,
          set_confidence: 'high',
          reason: 'Owner verified the claim.',
          operation_id,
        },
      });
      assert.equal(retry.statusCode, 200, `${phase}: ${retry.payload}`);
      assert.equal(readClaimHistory(dataDir, claimId).length, 2, `${phase} retry duplicated L1`);
      assert.equal([...readAllOpLogEntries(path.join(dataDir, 'operations'))]
        .filter(entry => entry.operation_id === operation_id).length, 1, `${phase} duplicated commit`);

      const intentPath = path.join(dataDir, 'operations', 'intents', `${operation_id}.json`);
      await assert.rejects(readFile(intentPath, 'utf8'), { code: 'ENOENT' });
    } finally {
      await restartedApp?.close();
      await closeSmartwareCore();
      closeDb();
      await rm(dataDir, { recursive: true, force: true });
    }
  }
});

test('A0/IT-10: real process kills across claim FORGET converge without content leakage', async () => {
  for (const phase of ['afterIntent', 'afterAuditObservation', 'afterClaimVersion', 'afterCommit']) {
    const dataDir = await mkdtemp(path.join(tmpdir(), `coffee-pod-forget-${phase}-`));
    const env = conformanceEnv(dataDir, { ownerId: 'user:owner' });
    const operation_id = fakeOperationId();
    const claimId = `claim_${'2'.repeat(26)}`;
    let restartedApp: Awaited<ReturnType<typeof buildApp>> | null = null;
    try {
      const initialApp = await buildApp(env, false);
      const initialCore = await getSmartwareCore(env);
      const profile = initialCore.createPodProfile(env.podId, env.podName);
      const seed: ClaimVersionRecord = {
        claim_id: claimId,
        version: 1,
        state: 'active',
        content: 'Private claim content that must stay out of the FORGET intent.',
        claim_type: 'finding',
        claim_role: 'memory',
        author: 'agent',
        epistemic_owner: 'agent',
        fingerprint: `fp_${'2'.repeat(26)}`,
        confidence: 'low',
        epistemic_tag: 'inference',
        scope: profile.scopes.personal,
        derived_from: [],
        relations: [],
        created_at: '2026-01-01T00:00:00.000Z',
        version_at: '2026-01-01T00:00:00.000Z',
        operation_id: fakeOperationId(),
        actor_id: 'substrate:test',
        tags: [],
      };
      appendClaimVersion(dataDir, seed);
      await initialApp.close();
      await closeSmartwareCore();
      closeDb();

      const crash = await runLifecycleCrashChild(['forget', dataDir, phase, operation_id, claimId]);
      assert.equal(crash.signal, 'SIGKILL', `${phase} child did not die by SIGKILL: ${crash.stderr}`);
      const intentPath = path.join(dataDir, 'operations', 'intents', `${operation_id}.json`);
      const rawIntent = await readFile(intentPath, 'utf8');
      assert.equal(rawIntent.includes(seed.content), false, `${phase} intent leaked claim content`);
      assert.equal((await stat(intentPath)).mode & 0o777, 0o600);

      restartedApp = await buildApp(env, false);
      await getSmartwareCore(env);
      const beforeRetry = [...readAllOpLogEntries(path.join(dataDir, 'operations'))]
        .filter(entry => entry.operation_id === operation_id);
      assert.equal(beforeRetry.length,
        phase === 'afterClaimVersion' || phase === 'afterCommit' ? 1 : 0,
        `${phase} restart disposition`);

      const retry = await restartedApp.inject({
        method: 'POST',
        url: '/pod/forget',
        payload: {
          actor_id: 'user:owner',
          target: { type: 'claim', id: claimId },
          mode: 'tombstone',
          reason: 'Owner removed the claim.',
          operation_id,
        },
      });
      assert.equal(retry.statusCode, 200, `${phase}: ${retry.payload}`);
      assert.equal(readClaimHistory(dataDir, claimId).length, 2, `${phase} retry duplicated L1`);
      assert.equal([...readAllOpLogEntries(path.join(dataDir, 'operations'))]
        .filter(entry => entry.operation_id === operation_id).length, 1, `${phase} duplicated commit`);
      await assert.rejects(readFile(intentPath, 'utf8'), { code: 'ENOENT' });
    } finally {
      await restartedApp?.close();
      await closeSmartwareCore();
      closeDb();
      await rm(dataDir, { recursive: true, force: true });
    }
  }
});

test('A0/IT-11: real process kills across REVIVE converge without duplicate versions', async () => {
  for (const phase of ['afterIntent', 'afterClaimVersion', 'afterCommit']) {
    const dataDir = await mkdtemp(path.join(tmpdir(), `coffee-pod-revive-${phase}-`));
    const env = conformanceEnv(dataDir, { ownerId: 'user:owner' });
    const operation_id = fakeOperationId();
    const claimId = `claim_${'3'.repeat(26)}`;
    const tombstoneId = `tomb_${'3'.repeat(26)}`;
    let restartedApp: Awaited<ReturnType<typeof buildApp>> | null = null;
    try {
      const initialApp = await buildApp(env, false);
      const initialCore = await getSmartwareCore(env);
      const profile = initialCore.createPodProfile(env.podId, env.podName);
      const active: ClaimVersionRecord = {
        claim_id: claimId,
        version: 1,
        state: 'active',
        content: 'Private revived content that must stay out of the REVIVE intent.',
        claim_type: 'finding',
        claim_role: 'memory',
        author: 'agent',
        epistemic_owner: 'agent',
        fingerprint: `fp_${'3'.repeat(26)}`,
        confidence: 'low',
        epistemic_tag: 'inference',
        scope: profile.scopes.personal,
        derived_from: [],
        relations: [],
        created_at: '2026-01-01T00:00:00.000Z',
        version_at: '2026-01-01T00:00:00.000Z',
        operation_id: fakeOperationId(),
        actor_id: 'substrate:test',
        tags: [],
      };
      const forgotten: ClaimVersionRecord = {
        ...active,
        version: 2,
        state: 'forgotten',
        tombstone_id: tombstoneId,
        forgotten_at: '2026-01-02T00:00:00.000Z',
        forgotten_by: 'user:owner',
        version_at: '2026-01-02T00:00:00.000Z',
        operation_id: fakeOperationId(),
        actor_id: 'user:owner',
        supersedes: 1,
      };
      delete (forgotten as { content?: string }).content;
      appendClaimVersion(dataDir, active);
      appendClaimVersion(dataDir, forgotten);
      await initialApp.close();
      await closeSmartwareCore();
      closeDb();

      const crash = await runLifecycleCrashChild(['revive', dataDir, phase, operation_id, tombstoneId]);
      assert.equal(crash.signal, 'SIGKILL', `${phase} child did not die by SIGKILL: ${crash.stderr}`);
      const intentPath = path.join(dataDir, 'operations', 'intents', `${operation_id}.json`);
      const rawIntent = await readFile(intentPath, 'utf8');
      assert.equal(rawIntent.includes(active.content), false, `${phase} intent leaked claim content`);

      restartedApp = await buildApp(env, false);
      await getSmartwareCore(env);
      const retry = await restartedApp.inject({
        method: 'POST',
        url: '/pod/revise',
        payload: {
          actor_id: 'user:owner',
          target: { type: 'tombstone', id: tombstoneId },
          new_state: {},
          reason: 'Owner restored the claim.',
          operation_id,
        },
      });
      assert.equal(retry.statusCode, 200, `${phase}: ${retry.payload}`);
      assert.equal(readClaimHistory(dataDir, claimId).length, 3, `${phase} retry duplicated L1`);
      assert.equal([...readAllOpLogEntries(path.join(dataDir, 'operations'))]
        .filter(entry => entry.operation_id === operation_id).length, 1, `${phase} duplicated commit`);
      await assert.rejects(readFile(intentPath, 'utf8'), { code: 'ENOENT' });
    } finally {
      await restartedApp?.close();
      await closeSmartwareCore();
      closeDb();
      await rm(dataDir, { recursive: true, force: true });
    }
  }
});

test('A0/IT-12: real process kills across ENDORSE converge across L1 and page writes', async () => {
  for (const phase of ['afterIntent', 'afterClaimVersions', 'afterPage', 'afterCommit']) {
    const dataDir = await mkdtemp(path.join(tmpdir(), `coffee-pod-endorse-${phase}-`));
    const env = conformanceEnv(dataDir, { ownerId: 'user:owner' });
    const operation_id = fakeOperationId();
    const claimId = `claim_${'4'.repeat(26)}`;
    const pageId = 'page_crash-endorsement';
    const pageBody = 'Private page synthesis that must stay out of the ENDORSE intent.';
    let restartedApp: Awaited<ReturnType<typeof buildApp>> | null = null;
    try {
      const initialApp = await buildApp(env, false);
      const initialCore = await getSmartwareCore(env);
      const profile = initialCore.createPodProfile(env.podId, env.podName);
      const seed: ClaimVersionRecord = {
        claim_id: claimId,
        version: 1,
        state: 'active',
        content: 'Private claim synthesis that must stay out of the ENDORSE intent.',
        claim_type: 'finding',
        claim_role: 'memory',
        author: 'agent',
        epistemic_owner: 'agent',
        fingerprint: `fp_${'4'.repeat(26)}`,
        confidence: 'low',
        epistemic_tag: 'inference',
        scope: profile.scopes.personal,
        derived_from: [],
        relations: [],
        created_at: '2026-01-01T00:00:00.000Z',
        version_at: '2026-01-01T00:00:00.000Z',
        operation_id: fakeOperationId(),
        actor_id: 'substrate:test',
        tags: [],
      };
      appendClaimVersion(dataDir, seed);
      const pageDir = path.join(dataDir, 'wiki', 'concepts');
      await mkdir(pageDir, { recursive: true });
      const pagePath = path.join(pageDir, 'crash-endorsement.md');
      await writeFile(pagePath, [
        '---',
        `page_id: "${pageId}"`,
        'entity: "Crash endorsement"',
        'category: "concepts"',
        'author: "agent"',
        `claim_ids: ["${claimId}"]`,
        `sources_claim_ids: ["${claimId}"]`,
        'compiled_at: "2026-01-01T00:00:00.000Z"',
        '---',
        '',
        '# Crash endorsement',
        '',
        pageBody,
        '',
      ].join('\n'));
      await initialApp.close();
      await closeSmartwareCore();
      closeDb();

      const crash = await runEndorseCrashChild([dataDir, phase, operation_id, pageId, pagePath]);
      assert.equal(crash.signal, 'SIGKILL', `${phase} child did not die by SIGKILL: ${crash.stderr}`);
      const intentPath = path.join(dataDir, 'operations', 'intents', `${operation_id}.json`);
      const rawIntent = await readFile(intentPath, 'utf8');
      assert.equal(rawIntent.includes(seed.content), false, `${phase} intent leaked claim content`);
      assert.equal(rawIntent.includes(pageBody), false, `${phase} intent leaked page content`);

      restartedApp = await buildApp(env, false);
      await getSmartwareCore(env);
      const retry = await restartedApp.inject({
        method: 'POST',
        url: '/pod/revise',
        payload: {
          actor_id: 'user:owner',
          target: { type: 'page', id: pageId },
          new_state: { author: 'user' },
          reason: 'Owner endorsed the page.',
          operation_id,
        },
      });
      assert.equal(retry.statusCode, 200, `${phase}: ${retry.payload}`);
      assert.equal(readClaimHistory(dataDir, claimId).length, 2, `${phase} retry duplicated L1`);
      assert.equal([...readAllOpLogEntries(path.join(dataDir, 'operations'))]
        .filter(entry => entry.operation_id === operation_id).length, 1, `${phase} duplicated commit`);
      assert.match(await readFile(pagePath, 'utf8'), /author:\s*"?user"?/);
      await assert.rejects(readFile(intentPath, 'utf8'), { code: 'ENOENT' });
    } finally {
      await restartedApp?.close();
      await closeSmartwareCore();
      closeDb();
      await rm(dataDir, { recursive: true, force: true });
    }
  }
});

test('A0/IT-13: real process kills across REFLECT claim commits converge on rerun', async () => {
  for (const phase of ['afterIntent', 'afterClaimVersion', 'afterCommit']) {
    const dataDir = await mkdtemp(path.join(tmpdir(), `coffee-pod-reflect-${phase}-`));
    const env = conformanceEnv(dataDir, { ownerId: 'user:owner' });
    const operation_id = fakeOperationId();
    const privateObservation = 'Deadline: 2027-01-09. Private reflection source.';
    let restartedApp: Awaited<ReturnType<typeof buildApp>> | null = null;
    try {
      const initialApp = await buildApp(env, false);
      const initialCore = await getSmartwareCore(env);
      const profile = initialCore.createPodProfile(env.podId, env.podName);
      await initialCore.observe({
        actor: { type: 'person', id: 'user:owner', display_name: 'user:owner' },
        type: 'decision',
        content: { format: 'text/plain', body: privateObservation },
        scope: profile.scopes.personal,
        visibility: 'private',
        operation_id: fakeOperationId(),
      });
      await initialApp.close();
      await closeSmartwareCore();
      closeDb();

      const crash = await runReflectCrashChild([dataDir, phase, operation_id, profile.scopes.personal]);
      assert.equal(crash.signal, 'SIGKILL', `${phase} child did not die by SIGKILL: ${crash.stderr}`);
      const intentFiles = await readdir(path.join(dataDir, 'operations', 'intents'));
      assert.equal(intentFiles.length, 1, `${phase} should leave one child intent`);
      const rawIntent = await readFile(path.join(dataDir, 'operations', 'intents', intentFiles[0]!), 'utf8');
      assert.equal(rawIntent.includes(privateObservation), false, `${phase} intent leaked reflected content`);

      restartedApp = await buildApp(env, false);
      await getSmartwareCore(env);
      const retry = await restartedApp.inject({
        method: 'POST',
        url: '/pod/compile',
        payload: {
          actor_id: 'user:owner',
          operation_id,
          scope: profile.scopes.personal,
          use_llm: false,
        },
      });
      assert.equal(retry.statusCode, 200, `${phase}: ${retry.payload}`);
      const allClaimLines = await readdir(path.join(dataDir, 'claims'));
      const records = (await Promise.all(allClaimLines.map(file =>
        readFile(path.join(dataDir, 'claims', file), 'utf8'))))
        .flatMap(raw => raw.split('\n').filter(Boolean).map(line => JSON.parse(line) as { derived_from?: string[] }));
      assert.equal(records.filter(record => record.derived_from?.length).length, 1, `${phase} retry duplicated reflected L1`);
      assert.equal([...readAllOpLogEntries(path.join(dataDir, 'operations'))]
        .filter(entry => entry.operation_id === operation_id).length, 1, `${phase} duplicated parent commit`);
      assert.equal((await readdir(path.join(dataDir, 'operations', 'intents'))).length, 0);
    } finally {
      await restartedApp?.close();
      await closeSmartwareCore();
      closeDb();
      await rm(dataDir, { recursive: true, force: true });
    }
  }
});

test('A0/IT-07: same operation_id with different payload returns conflict', async () => {
  const { app, teardown } = await buildConformanceApp();
  try {
    const operation_id = fakeOperationId();
    const first = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'agent:test',
        content: 'Original observation',
        scope_alias: 'personal',
        operation_id,
      },
    });
    assert.equal(first.statusCode, 200, `first call failed: ${first.payload}`);

    const second = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'agent:test',
        content: 'A DIFFERENT observation reusing the operation_id',
        scope_alias: 'personal',
        operation_id,
      },
    });

    const check = assertConformanceError(
      second,
      { status: 409, code: 'conflict' },
      'IT-07',
    );
    assert.equal(check.ok, true, check.reason);
  } finally {
    await teardown();
  }
});
