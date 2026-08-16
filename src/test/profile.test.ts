import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { getDb, setSettings } from '../pod/db.js';
import { RETRIEVAL_SETTINGS_NAMESPACE } from '../services/semantic-retrieval.js';
import { closeSmartwareCore } from '../smartware/core.js';

let operationSequence = 900;
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
    podId: 'profile-test',
    podName: 'Profile Test Pod',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

test('Self profile is refreshed, readable, correctable, and carried into owner context', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-profile-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const observed = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'personal',
        type: 'preference',
        content: 'I prefer concise engineering updates with concrete verification status.',
      },
    });
    assert.equal(observed.statusCode, 200);

    const profilePath = path.join(dataDir, 'wiki', 'profiles', 'self.md');
    const markdown = await readFile(profilePath, 'utf8');
    assert.match(markdown, /category: "profile"/);
    assert.match(markdown, /## Preferences/);
    assert.match(markdown, /concise engineering updates/);

    const firstRead = await app.inject({ method: 'GET', url: '/pod/wiki/profile' });
    assert.equal(firstRead.statusCode, 200);
    assert.equal(firstRead.json().profile_id, 'self');
    assert.equal(firstRead.json().facts.length, 1);
    assert.equal(firstRead.json().facts[0].category, 'preference');
    const originalFactId = firstRead.json().facts[0].id as string;

    const query = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: 'person-local',
        query: 'What should I work on next?',
        scope_alias: 'workspace',
        include_observations: false,
        use_llm: false,
      },
    });
    assert.equal(query.statusCode, 200);
    const profileSource = query.json().sources.find((source: { type: string }) => source.type === 'profile');
    assert.equal(profileSource.profile_id, 'self');
    assert.match(profileSource.snippet, /concise engineering updates/);

    const session = await app.inject({
      method: 'POST',
      url: '/pod/session/start',
      payload: {
        actor_id: 'person-local',
        goal: 'Prepare a concise project update',
        scope_alias: 'workspace',
      },
    });
    assert.equal(session.statusCode, 200);
    assert.equal(session.json().context.self_profile.facts[0].category, 'preference');

    const corrected = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'personal',
        type: 'preference',
        content_format: 'application/json',
        content: {
          kind: 'profile_correction',
          action: 'replace',
          target_fact_id: originalFactId,
          category: 'instruction',
          text: 'Always lead project updates with the verified outcome.',
        },
      },
    });
    assert.equal(corrected.statusCode, 200);

    const correctedRead = await app.inject({ method: 'GET', url: '/pod/wiki/profile' });
    assert.equal(correctedRead.statusCode, 200);
    assert.equal(correctedRead.json().facts.length, 1);
    assert.equal(correctedRead.json().facts[0].category, 'instruction');
    assert.equal(correctedRead.json().facts[0].origin, 'correction');
    assert.match(correctedRead.json().facts[0].text, /verified outcome/);
    const correctedFactId = correctedRead.json().facts[0].id as string;

    const removed = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'personal',
        type: 'preference',
        content_format: 'application/json',
        content: {
          kind: 'profile_correction',
          action: 'remove',
          target_fact_id: correctedFactId,
        },
      },
    });
    assert.equal(removed.statusCode, 200);

    const removedRead = await app.inject({ method: 'GET', url: '/pod/wiki/profile' });
    assert.equal(removedRead.statusCode, 200);
    assert.deepEqual(removedRead.json().facts, []);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('Ask Pod answers an exact Self-profile question when no AI provider is available', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-profile-answer-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const observed = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'personal',
        type: 'preference',
        content: 'My favourite colour is magenta',
      },
    });
    assert.equal(observed.statusCode, 200);

    const query = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: 'person-local',
        query: 'What is my favorite color?',
        scope: 'all',
        include_observations: true,
        use_llm: true,
      },
    });
    assert.equal(query.statusCode, 200, query.payload);
    assert.equal(query.json().answer, 'Your favourite colour is magenta. [S1]');
    assert.equal(query.json().answer_mode, 'profile');
    assert.equal(query.json().citations[0]?.type, 'profile');
    assert.ok(query.json().steps.some((step: { id: string; count?: number }) =>
      step.id === 'profile' && step.count === 1));
    assert.ok(query.json().steps.some((step: { id: string; status: string }) =>
      step.id === 'answer' && step.status === 'done'));

    const followUp = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: 'person-local',
        query: 'What is it?',
        scope: 'all',
        include_observations: true,
        use_llm: true,
        history: [
          { role: 'user', content: 'What is my favorite color?' },
          { role: 'assistant', content: 'Let me check your profile.' },
        ],
      },
    });
    assert.equal(followUp.statusCode, 200, followUp.payload);
    assert.equal(followUp.json().answer, 'Your favourite colour is magenta. [S1]');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('Ask Pod responds helpfully when no memory or AI provider can answer', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-empty-answer-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const query = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: 'person-local',
        query: 'Where did I leave the spare keys?',
        scope_alias: 'personal',
        include_observations: true,
        use_llm: true,
      },
    });
    assert.equal(query.statusCode, 200, query.payload);
    assert.equal(query.json().answer_mode, 'no_evidence');
    assert.match(query.json().answer, /don't have anything in Pod that answers that yet/i);
    assert.match(query.json().answer, /All memories/i);
    assert.match(query.json().answer, /Remember that/i);
    assert.doesNotMatch(query.json().answer, /rephras|broaden/i);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('Ask Pod reports retrieved memories when the selected model is no longer available', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-retired-model-answer-'));
  const app = await buildApp(testEnv(dataDir), false);
  const originalFetch = globalThis.fetch;

  try {
    const object = await app.inject({
      method: 'POST',
      url: '/pod/objects',
      payload: {
        actor_id: 'person-local',
        id: 'launch-themes',
        collection_id: 'inbox',
        kind: 'doc',
        title: 'Launch planning',
        content: {
          text: 'Milestones, customer trust, and onboarding risks for the Coffee release.',
        },
        source: { app: 'test' },
      },
    });
    assert.equal(object.statusCode, 200, object.payload);

    const integrationsDir = path.join(dataDir, 'integrations');
    await mkdir(integrationsDir, { recursive: true });
    await writeFile(
      path.join(integrationsDir, 'openrouter.json'),
      `${JSON.stringify({
        api_key: 'test-openrouter-key',
        model: 'openai/gpt-oss-120b:free',
        selected_for_ai: true,
      })}\n`,
      'utf8',
    );
    globalThis.fetch = async () => new Response(JSON.stringify({
      error: {
        message: 'This model is unavailable for free. The paid version is available now.',
        code: 404,
      },
    }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });

    const query = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: 'person-local',
        query: 'What are the main themes in my graph?',
        scope: 'all',
        include_observations: true,
        use_llm: true,
        context: {
          kind: 'map_selection',
          node_ids: ['obj:launch-themes'],
          object_ids: ['launch-themes'],
          labels: ['Launch planning', '[lens] themes'],
          edges: [],
        },
      },
    });

    assert.equal(query.statusCode, 200, query.payload);
    assert.ok(query.json().sources.length > 0);
    assert.equal(query.json().answer_status, 'error');
    assert.equal(query.json().answer_mode, 'synthesis_unavailable');
    assert.match(query.json().answer, /found \d+ candidate memor/i);
    assert.match(query.json().answer, /selected AI model is no longer available/i);
    assert.match(query.json().answer, /Connections.*Models/i);
    assert.doesNotMatch(query.json().answer, /don't have anything in Pod/i);
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
    await closeSmartwareCore();
  }
});

test('Ask Pod stays useful across Smartware shadow, fallback, and unavailable semantic retrieval', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'pod-smartware-answer-'));
  const env = testEnv(dataDir);
  const db = getDb(env);
  const app = await buildApp(env, false);

  try {
    setSettings(db, RETRIEVAL_SETTINGS_NAMESPACE, { semantic_mode: 'shadow' });

    const shadow = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: 'person-local',
        query: 'Where did I leave the spare keys?',
        scope_alias: 'personal',
        use_llm: true,
      },
    });
    assert.equal(shadow.statusCode, 200, shadow.payload);
    assert.equal(shadow.json().answer_mode, 'no_evidence');
    assert.match(shadow.json().answer, /don't have anything in Pod that answers that yet/i);
    assert.equal(shadow.json().retrieval.semantic.mode, 'shadow');
    assert.equal(shadow.json().retrieval.semantic.applied, false);
    assert.ok(!shadow.json().steps.some((step: { id: string }) => step.id === 'semantic'));

    setSettings(db, RETRIEVAL_SETTINGS_NAMESPACE, { semantic_mode: 'fallback' });

    const fallback = await app.inject({
      method: 'POST',
      url: '/pod/query',
      payload: {
        actor_id: 'person-local',
        query: 'Where did I leave the spare keys?',
        scope_alias: 'personal',
        use_llm: true,
      },
    });
    assert.equal(fallback.statusCode, 200, fallback.payload);
    assert.equal(fallback.json().answer_mode, 'no_evidence');
    assert.match(fallback.json().answer, /Remember that/i);
    assert.equal(fallback.json().retrieval.semantic.mode, 'fallback');
    assert.equal(fallback.json().retrieval.semantic.applied, false);
    assert.ok(fallback.json().steps.some((step: { id: string; status: string }) =>
      step.id === 'semantic' && step.status === 'skipped'));
  } finally {
    setSettings(db, RETRIEVAL_SETTINGS_NAMESPACE, { semantic_mode: 'off' });
    await app.close();
    await closeSmartwareCore();
  }
});

test('authorized harness profiles receive a cited, budgeted peer card without cross-scope leakage', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-profile-context-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const personal = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'personal',
        type: 'preference',
        content: 'I prefer private planning notes to stay concise.',
      },
    });
    const workspace = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'workspace',
        type: 'preference',
        content: 'Always include concrete verification results in project updates.',
      },
    });
    assert.equal(personal.statusCode, 200);
    assert.equal(workspace.statusCode, 200);

    const scopedAgent = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:workspace-profile',
        name: 'Workspace profile',
        access_mode: 'scoped',
        scopes: ['workspace'],
        context_budget: 500,
      },
    });
    assert.equal(scopedAgent.statusCode, 200);
    const scopedHeaders = { authorization: `Bearer ${scopedAgent.json().agent.auth_token as string}` };
    const scopedContext = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: scopedHeaders,
      payload: { query: 'Prepare the project update', scope: 'workspace' },
    });
    assert.equal(scopedContext.statusCode, 200, scopedContext.payload);
    assert.equal(scopedContext.json().self_profile.profile_id, 'self');
    assert.equal(scopedContext.json().self_profile.facts.length, 1);
    assert.match(scopedContext.json().self_profile.facts[0].text, /verification results/i);
    assert.deepEqual(scopedContext.json().self_profile.facts[0].source_ids, [workspace.json().id]);
    assert.doesNotMatch(JSON.stringify(scopedContext.json().self_profile), /private planning/i);
    const profileEvidence = scopedContext.json().evidence.find((row: { type: string }) => row.type === 'profile');
    assert.equal(profileEvidence.source_group, 'profile:self');
    assert.deepEqual(profileEvidence.provenance.observation_ids, [workspace.json().id]);
    assert.deepEqual(profileEvidence.ranking.retrievers, ['peer_card']);

    const scopedSession = await app.inject({
      method: 'POST',
      url: '/pod/session/start',
      headers: scopedHeaders,
      payload: {
        actor_id: 'agent:workspace-profile',
        goal: 'Prepare the project update',
        scope_alias: 'workspace',
      },
    });
    assert.equal(scopedSession.statusCode, 200, scopedSession.payload);
    assert.equal(scopedSession.json().context.self_profile.facts.length, 1);
    assert.deepEqual(scopedSession.json().context.self_profile.facts[0].source_ids, [workspace.json().id]);

    const allAgent = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:all-profile',
        name: 'All profile',
        access_mode: 'all',
        context_budget: 500,
      },
    });
    assert.equal(allAgent.statusCode, 200);
    const allContext = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: { authorization: `Bearer ${allAgent.json().agent.auth_token as string}` },
      payload: { query: 'Prepare the project update', scope: 'workspace' },
    });
    assert.equal(allContext.statusCode, 200, allContext.payload);
    assert.equal(allContext.json().self_profile.facts.length, 2);

    const tinyBudget = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: { authorization: `Bearer ${allAgent.json().agent.auth_token as string}` },
      payload: { query: 'Prepare the project update', scope: 'workspace', token_budget: 12 },
    });
    assert.equal(tinyBudget.statusCode, 200, tinyBudget.payload);
    assert.ok(tinyBudget.json().token_estimate <= 12);
    assert.ok(tinyBudget.json().self_profile.facts.length < 2);

    const profileOnly = await app.inject({
      method: 'POST',
      url: '/pod/context',
      headers: { authorization: `Bearer ${allAgent.json().agent.auth_token as string}` },
      payload: {
        query: 'What should I call the owner?',
        scope: 'all',
        source_types: ['profile'],
        token_budget: 64,
      },
    });
    assert.equal(profileOnly.statusCode, 200, profileOnly.payload);
    assert.equal(profileOnly.json().self_profile.facts.length, 2);
    assert.deepEqual(profileOnly.json().retrieval.stages.map((stage: { id: string }) => stage.id), ['profile']);
    assert.ok(profileOnly.json().token_estimate <= 64);
    assert.ok(profileOnly.json().evidence.every((row: { type: string }) => row.type === 'profile'));
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('authorized agents can recall a preferred name from the self profile without model synthesis', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-profile-recall-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const preference = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'personal',
        type: 'preference',
        content: 'I like to be called Sir Stevie.',
      },
    });
    assert.equal(preference.statusCode, 200);

    const agent = await app.inject({
      method: 'POST',
      url: '/pod/registry/agents',
      payload: {
        id: 'agent:profile-recall',
        name: 'Profile recall agent',
        access_mode: 'all',
        context_budget: 500,
      },
    });
    assert.equal(agent.statusCode, 200);

    const recall = await app.inject({
      method: 'POST',
      url: '/pod/recall',
      headers: { authorization: `Bearer ${agent.json().agent.auth_token as string}` },
      payload: {
        actor_id: 'agent:profile-recall',
        query: 'What should I call the owner?',
        depth: 'oneline',
        include_observations: false,
        use_llm: false,
      },
    });
    assert.equal(recall.statusCode, 200, recall.payload);
    const profile = recall.json().sources.find((row: { type: string }) => row.type === 'profile');
    assert.ok(profile);
    assert.match(profile.text, /Sir Stevie/i);
    assert.equal(profile.provenance.profile_id, 'self');
    assert.equal(recall.json().answer_status, 'not_requested');
    assert.equal(recall.json().retrieval.strategy, 'profile_fast_path');
    assert.deepEqual(recall.json().steps.map((step: { id: string }) => step.id), ['profile']);
    assert.equal(recall.json().retrieval.model.invoked, false);
    assert.ok(recall.json().retrieval.token_estimate < 100);
    assert.deepEqual(
      recall.json().retrieval.stages.filter((stage: { executed: boolean }) => stage.executed).map((stage: { id: string }) => stage.id),
      ['profile'],
    );
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});
