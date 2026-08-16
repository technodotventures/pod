import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeDb } from '../pod/db.js';
import { closeSmartwareCore } from '../smartware/core.js';

let operationSequence = 7_000;
function operationId(): string {
  operationSequence += 1;
  return `op_${String(operationSequence).padStart(26, '0')}`;
}

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'experience-test',
    podName: 'Experience Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('failed attempts plus feedback become cited lessons transferable to another authorized agent', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-experience-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const status = await app.inject({ method: 'GET', url: '/pod/status' });
    const ownerActorId = status.json().pod.owner_id as string;
    const firstAgent = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:hermes-coder',
        name: 'Hermes Coder',
        access_mode: 'scoped',
        scopes: ['workspace'],
      },
    });
    const secondAgent = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:codex-reviewer',
        name: 'Codex Reviewer',
        access_mode: 'scoped',
        scopes: ['workspace'],
      },
    });
    assert.equal(firstAgent.statusCode, 200);
    assert.equal(secondAgent.statusCode, 200);
    const firstHeaders = { authorization: `Bearer ${firstAgent.json().agent.auth_token as string}` };
    const secondHeaders = { authorization: `Bearer ${secondAgent.json().agent.auth_token as string}` };

    const failed = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      headers: firstHeaders,
      payload: {
        actor_id: 'agent:hermes-coder',
        operation_id: operationId(),
        scope_alias: 'workspace',
        type: 'agent_run_completed',
        content_format: 'application/json',
        content: {
          kind: 'experience_event',
          event: 'attempt_finished',
          task: {
            key: 'publish-coffee-desktop',
            title: 'Publish Coffee desktop',
            goal: 'Build and publish the signed desktop application',
            environment: 'macos-release',
            tags: ['desktop', 'release'],
          },
          attempt: {
            id: 'attempt-release-1',
            status: 'failure',
            summary: 'The upload started before the production UI bundle existed.',
            error_signature: 'missing-dist-ui',
          },
        },
      },
    });
    assert.equal(failed.statusCode, 200);

    const feedback = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: ownerActorId,
        operation_id: operationId(),
        scope_alias: 'workspace',
        type: 'feedback',
        content_format: 'application/json',
        content: {
          kind: 'experience_event',
          event: 'feedback_received',
          task: {
            key: 'publish-coffee-desktop',
            title: 'Publish Coffee desktop',
            environment: 'macos-release',
            tags: ['desktop', 'release'],
          },
          attempt_id: 'attempt-release-1',
          feedback: 'The release workflow must prove both bundles exist before uploading.',
          recommended_action: 'Run the complete production build and verify dist-ui before starting the upload.',
          applies_when: 'Publishing a Coffee desktop release from macOS.',
        },
      },
    });
    assert.equal(feedback.statusCode, 200);

    const context = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: secondHeaders,
      payload: {
        query: 'How should I publish the desktop release?',
        scope: 'workspace',
        task: {
          key: 'publish-coffee-desktop',
          goal: 'Publish the signed desktop app',
          environment: 'macos-release',
          tags: ['release'],
        },
      },
    });
    assert.equal(context.statusCode, 200);
    assert.equal(context.json().lessons.length, 1);
    const lesson = context.json().lessons[0];
    assert.match(lesson.instruction, /verify dist-ui/i);
    assert.match(lesson.previous_failure, /upload started before/i);
    assert.equal(lesson.validation_status, 'candidate');
    assert.ok(lesson.evidence_observation_ids.includes(failed.json().id));
    assert.ok(lesson.evidence_observation_ids.includes(feedback.json().id));
    assert.ok(lesson.learned_from_actor_ids.includes('agent:hermes-coder'));
    assert.ok(lesson.learned_from_actor_ids.includes(ownerActorId));

    const succeeded = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      headers: secondHeaders,
      payload: {
        actor_id: 'agent:codex-reviewer',
        operation_id: operationId(),
        scope_alias: 'workspace',
        type: 'agent_run_completed',
        content_format: 'application/json',
        content: {
          kind: 'experience_event',
          event: 'attempt_finished',
          task: { key: 'publish-coffee-desktop', environment: 'macos-release' },
          attempt: {
            id: 'attempt-release-2',
            status: 'success',
            summary: 'The complete production build passed and the upload succeeded.',
            applied_lesson_ids: [lesson.id],
          },
        },
      },
    });
    assert.equal(succeeded.statusCode, 200);

    const validatedContext = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: secondHeaders,
      payload: { scope: 'workspace', task: { key: 'publish-coffee-desktop' } },
    });
    assert.equal(validatedContext.statusCode, 200);
    assert.equal(validatedContext.json().lessons[0].validation_status, 'validated');
    assert.equal(validatedContext.json().lessons[0].success_count, 1);
    assert.ok(validatedContext.json().lessons[0].evidence_observation_ids.includes(succeeded.json().id));

    const invalid = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      headers: firstHeaders,
      payload: {
        actor_id: 'agent:hermes-coder',
        operation_id: operationId(),
        scope_alias: 'workspace',
        type: 'feedback',
        content_format: 'application/json',
        content: {
          kind: 'experience_event',
          event: 'feedback_received',
          task: { key: 'publish-coffee-desktop' },
          attempt_id: 'attempt-release-1',
          feedback: 'Missing the required recommendation.',
        },
      },
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error, 'invalid_experience_event');

    const privateFailure = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      headers: firstHeaders,
      payload: {
        actor_id: 'agent:hermes-coder',
        operation_id: operationId(),
        scope_alias: 'workspace',
        visibility: 'private',
        type: 'agent_run_completed',
        content_format: 'application/json',
        content: {
          kind: 'experience_event',
          event: 'attempt_finished',
          task: { key: 'private-workflow' },
          attempt: {
            id: 'attempt-private-1',
            status: 'failure',
            summary: 'A private failure that must not transfer.',
          },
        },
      },
    });
    assert.equal(privateFailure.statusCode, 200);

    const privateFeedback = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: ownerActorId,
        operation_id: operationId(),
        scope_alias: 'workspace',
        type: 'feedback',
        content_format: 'application/json',
        content: {
          kind: 'experience_event',
          event: 'feedback_received',
          task: { key: 'private-workflow' },
          attempt_id: 'attempt-private-1',
          feedback: 'This feedback cannot make private evidence shareable.',
          recommended_action: 'Never expose this instruction to another agent.',
        },
      },
    });
    assert.equal(privateFeedback.statusCode, 200);

    const privateContext = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: secondHeaders,
      payload: { scope: 'workspace', task: { key: 'private-workflow' } },
    });
    assert.equal(privateContext.statusCode, 200);
    assert.deepEqual(privateContext.json().lessons, []);

    const forgottenFeedback = await app.inject({
      method: 'POST',
      url: '/pod/forget',
      payload: {
        actor_id: ownerActorId,
        operation_id: operationId(),
        target: { type: 'observation', id: feedback.json().id },
        mode: 'tombstone',
        reason: 'Remove the corrective feedback and its derived lesson.',
      },
    });
    assert.equal(forgottenFeedback.statusCode, 200, forgottenFeedback.body);

    const forgottenContext = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: secondHeaders,
      payload: { scope: 'workspace', task: { key: 'publish-coffee-desktop' } },
    });
    assert.equal(forgottenContext.statusCode, 200);
    assert.deepEqual(forgottenContext.json().lessons, []);
  } finally {
    await app.close();
    await closeSmartwareCore();
    closeDb();
  }
});

test('session lifecycle captures a reflected failure, recalls it on the next run, and records application', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-session-learning-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const firstAgent = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:first-runner',
        name: 'First runner',
        access_mode: 'scoped',
        scopes: ['workspace'],
      },
    });
    const secondAgent = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:next-runner',
        name: 'Next runner',
        access_mode: 'scoped',
        scopes: ['workspace'],
      },
    });
    assert.equal(firstAgent.statusCode, 200, firstAgent.payload);
    assert.equal(secondAgent.statusCode, 200, secondAgent.payload);
    const firstHeaders = { authorization: `Bearer ${firstAgent.json().agent.auth_token as string}` };
    const secondHeaders = { authorization: `Bearer ${secondAgent.json().agent.auth_token as string}` };

    const started = await app.inject({
      method: 'POST',
      url: '/pod/session/start',
      headers: firstHeaders,
      payload: {
        actor_id: 'agent:first-runner',
        scope_alias: 'workspace',
        session_id: 'session-deploy-1',
        workflow_id: 'deploy-web',
        goal: 'Deploy the web application',
        task: {
          key: 'deploy-web',
          environment: 'production',
          tags: ['deploy'],
        },
      },
    });
    assert.equal(started.statusCode, 200, started.payload);
    assert.deepEqual(started.json().context.lessons, []);

    const failed = await app.inject({
      method: 'POST',
      url: '/pod/session/end',
      headers: firstHeaders,
      payload: {
        actor_id: 'agent:first-runner',
        scope_alias: 'workspace',
        session_id: 'session-deploy-1',
        workflow_id: 'deploy-web',
        outcome: 'Deployment failed because the generated assets were stale.',
        experience: {
          status: 'failure',
          task: {
            key: 'deploy-web',
            environment: 'production',
            tags: ['deploy'],
          },
          error_signature: 'stale-assets',
          reflection: 'The build cache was reused without checking the asset hash.',
          recommended_action: 'Clear the production build cache and verify the asset hash before deploying.',
          applies_when: 'Deploying the web application to production.',
        },
      },
    });
    assert.equal(failed.statusCode, 200, failed.payload);

    const nextStarted = await app.inject({
      method: 'POST',
      url: '/pod/session/start',
      headers: secondHeaders,
      payload: {
        actor_id: 'agent:next-runner',
        scope_alias: 'workspace',
        session_id: 'session-deploy-2',
        workflow_id: 'deploy-web',
        goal: 'Deploy the web application',
        task: {
          key: 'deploy-web',
          environment: 'production',
          tags: ['deploy'],
        },
      },
    });
    assert.equal(nextStarted.statusCode, 200, nextStarted.payload);
    assert.equal(nextStarted.json().context.lessons.length, 1);
    const lesson = nextStarted.json().context.lessons[0];
    assert.equal(lesson.origin, 'agent_reflection');
    assert.match(lesson.instruction, /clear the production build cache/i);
    assert.ok(lesson.confidence > 0 && lesson.confidence < 1);

    const succeeded = await app.inject({
      method: 'POST',
      url: '/pod/session/end',
      headers: secondHeaders,
      payload: {
        actor_id: 'agent:next-runner',
        scope_alias: 'workspace',
        session_id: 'session-deploy-2',
        workflow_id: 'deploy-web',
        outcome: 'Deployment succeeded after rebuilding and verifying the assets.',
        experience: {
          status: 'success',
          task: { key: 'deploy-web', environment: 'production', tags: ['deploy'] },
          applied_lesson_ids: [lesson.id],
        },
      },
    });
    assert.equal(succeeded.statusCode, 200, succeeded.payload);

    const context = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: secondHeaders,
      payload: { scope: 'workspace', task: { key: 'deploy-web' } },
    });
    assert.equal(context.statusCode, 200, context.payload);
    assert.equal(context.json().lessons[0].validation_status, 'validated');
    assert.equal(context.json().lessons[0].success_count, 1);
    assert.equal(typeof context.json().lessons[0].utility_score, 'number');

    const learnings = await app.inject({ method: 'GET', url: '/pod/experience/lessons' });
    assert.equal(learnings.statusCode, 200, learnings.payload);
    assert.equal(learnings.json().summary.total, 1);
    assert.equal(learnings.json().summary.validated, 1);
    assert.equal(learnings.json().summary.successful_applications, 1);
    assert.equal(learnings.json().lessons[0].task.key, 'deploy-web');

    const activity = await app.inject({ method: 'GET', url: '/pod/events?process=learn&limit=10' });
    assert.equal(activity.statusCode, 200, activity.payload);
    assert.equal(activity.json().events.some((event: { type: string }) => event.type === 'learning_applied'), true);
  } finally {
    await app.close();
    await closeSmartwareCore();
    closeDb();
  }
});
