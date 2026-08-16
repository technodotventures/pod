import assert from 'node:assert/strict';
import test from 'node:test';

import { getPodJson, loadCoffeePodMcpEnv, postPodJson } from '../mcp/pod-api.js';
import { createCoffeePodMcpServer } from '../mcp-server.js';

test('loadCoffeePodMcpEnv derives the Pod URL and token from the Coffee env', () => {
  const original = {
    host: process.env['COFFEE_POD_HOST'],
    port: process.env['COFFEE_POD_PORT'],
    url: process.env['COFFEE_POD_URL'],
    apiToken: process.env['COFFEE_POD_API_TOKEN'],
    mcpToken: process.env['COFFEE_POD_MCP_API_TOKEN'],
  };

  try {
    process.env['COFFEE_POD_HOST'] = '::1';
    process.env['COFFEE_POD_PORT'] = '9010';
    delete process.env['COFFEE_POD_URL'];
    process.env['COFFEE_POD_API_TOKEN'] = 'api-token';
    delete process.env['COFFEE_POD_MCP_API_TOKEN'];

    const env = loadCoffeePodMcpEnv();
    assert.equal(env.baseUrl, 'http://[::1]:9010');
    assert.equal(env.apiToken, 'api-token');
  } finally {
    if (original.host === undefined) delete process.env['COFFEE_POD_HOST']; else process.env['COFFEE_POD_HOST'] = original.host;
    if (original.port === undefined) delete process.env['COFFEE_POD_PORT']; else process.env['COFFEE_POD_PORT'] = original.port;
    if (original.url === undefined) delete process.env['COFFEE_POD_URL']; else process.env['COFFEE_POD_URL'] = original.url;
    if (original.apiToken === undefined) delete process.env['COFFEE_POD_API_TOKEN']; else process.env['COFFEE_POD_API_TOKEN'] = original.apiToken;
    if (original.mcpToken === undefined) delete process.env['COFFEE_POD_MCP_API_TOKEN']; else process.env['COFFEE_POD_MCP_API_TOKEN'] = original.mcpToken;
  }
});

test('Pod API helpers attach auth and parse JSON responses', async () => {
  const originalFetch = globalThis.fetch;
  const seen = { url: '', authorization: '', contentType: '', body: '' };

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    seen.url = String(input);
    const headers = new Headers(init?.headers);
    seen.authorization = headers.get('authorization') ?? '';
    seen.contentType = headers.get('content-type') ?? '';
    seen.body = typeof init?.body === 'string' ? init.body : '';
    return new Response(JSON.stringify({ ok: true, nested: { value: 42 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const env = { baseUrl: 'http://pod.local', apiToken: 'secret-token' };
    const response = await postPodJson<{ ok: boolean; nested: { value: number } }>(env, '/pod/session/checkpoint', {
      actor_id: 'person-local',
      operation_id: 'op_00000000000000000000000001',
      checkpoint_id: `checkpoint_${'0'.repeat(64)}`,
      session_id: 'session-local',
      trigger: 'manual',
      generation: 0,
      summary: 'Checkpoint summary',
      decisions: [],
      open_loops: [],
      source_digest: `sha256:${'0'.repeat(64)}`,
    });

    assert.equal(seen.url, 'http://pod.local/pod/session/checkpoint');
    assert.equal(seen.authorization, 'Bearer secret-token');
    assert.equal(seen.contentType, 'application/json');
    assert.match(seen.body, /Checkpoint summary/);
    assert.deepEqual(response, { ok: true, nested: { value: 42 } });

    const status = await getPodJson<{ ok: boolean; nested: { value: number } }>(env, '/pod/status');
    assert.deepEqual(status, { ok: true, nested: { value: 42 } });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Pod API helpers surface response failures', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('not allowed', { status: 403 })) as typeof fetch;

  try {
    await assert.rejects(
      () => getPodJson({ baseUrl: 'http://pod.local' }, '/pod/status'),
      /Pod API \/pod\/status failed with 403: not allowed/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Pod MCP server exposes spec-shaped Smartware verb tools', () => {
  const server = createCoffeePodMcpServer() as unknown as {
    _registeredTools: Record<string, unknown>;
  };
  const toolNames = Object.keys(server._registeredTools);

  for (const expected of [
    'pod_observe',
    'pod_record_experience',
    'pod_recall',
    'pod_reflect',
    'pod_dream',
    'pod_revise',
    'pod_forget',
    'pod_access',
    'pod_search_evidence',
    'pod_search_conversations',
    'pod_who_knows',
  ]) {
    assert.ok(toolNames.includes(expected), `expected MCP tool ${expected}`);
  }

  // Legacy client tool names remain available for existing clients.
  assert.ok(toolNames.includes('pod_query'));
  assert.ok(toolNames.includes('pod_compile'));
  assert.ok(toolNames.includes('pod_correct'));
});

test('pod_observe supplies valid operation ids and keeps retries deterministic when given a stable key', async () => {
  const originalFetch = globalThis.fetch;
  const posted: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    posted.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const server = createCoffeePodMcpServer({ env: { baseUrl: 'http://pod.local' } }) as unknown as {
      _registeredTools: Record<string, { handler: (input: unknown) => Promise<unknown> }>;
    };
    const observe = server._registeredTools['pod_observe']!.handler;
    const recordExperience = server._registeredTools['pod_record_experience']!.handler;
    await observe({ actor_id: 'agent:test', content: 'Fresh write' });
    await observe({ actor_id: 'agent:test', idempotency_key: 'task-42', content: 'Stable write' });
    await recordExperience({
      actor_id: 'agent:test',
      event: 'attempt_finished',
      task: { key: 'task-42' },
      attempt: { id: 'attempt-7', status: 'success', summary: 'Finished' },
    });
    await recordExperience({
      actor_id: 'agent:test',
      event: 'attempt_finished',
      task: { key: 'task-42' },
      attempt: { id: 'attempt-7', status: 'success', summary: 'Finished' },
    });
    await observe({ actor_id: 'agent:test', idempotency_key: 'task-42', content: 'Stable write' });

    assert.match(String(posted[0]?.operation_id), /^op_[0-9A-HJKMNP-TV-Z]{26}$/);
    assert.match(String(posted[1]?.operation_id), /^op_[0-9A-HJKMNP-TV-Z]{26}$/);
    assert.equal(posted[1]?.operation_id, posted[4]?.operation_id);
    assert.match(String(posted[2]?.operation_id), /^op_[0-9A-HJKMNP-TV-Z]{26}$/);
    assert.equal(posted[2]?.operation_id, posted[3]?.operation_id);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('pod_search_evidence pushes source filters into retrieval and returns compact evidence by default', async () => {
  const originalFetch = globalThis.fetch;
  let posted: Record<string, unknown> = {};
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    posted = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    return new Response(JSON.stringify({
      scopes_read: ['personal'],
      retrieval: { token_estimate: 19 },
      evidence: [{
        id: 'profile:preference',
        type: 'profile',
        text: 'I like to be called Sir Stevie',
        scope: 'pod/founder/personal',
        provenance: { observation_ids: ['obs_preference'] },
        ranking: { confidence: null },
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const server = createCoffeePodMcpServer({ env: { baseUrl: 'http://pod.local' } }) as unknown as {
      _registeredTools: Record<string, { handler: (input: unknown) => Promise<{ structuredContent?: Record<string, unknown> }> }>;
    };
    const result = await server._registeredTools['pod_search_evidence']!.handler({
      actor_id: 'agent:codex',
      query: 'What should I call the owner?',
      source_types: ['profile'],
      token_budget: 64,
    });

    assert.deepEqual(posted['source_types'], ['profile']);
    const evidence = result.structuredContent?.['evidence'] as Array<Record<string, unknown>>;
    assert.deepEqual(evidence, [{
      id: 'profile:preference',
      type: 'profile',
      text: 'I like to be called Sir Stevie',
      scope: 'pod/founder/personal',
      confidence: null,
      observation_ids: ['obs_preference'],
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
