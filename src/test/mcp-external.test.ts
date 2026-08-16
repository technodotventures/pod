import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeSmartwareCore } from '../smartware/core.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'founder-test',
    podName: 'Founder Test Pod',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

function stdioFixtureArgs(): string[] {
  const script = `
    import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
    import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
    import * as z from 'zod/v4';

    const server = new McpServer({ name: 'fixture-mcp', version: '1.0.0' });
    server.registerTool('search_docs', {
      description: 'Search fixture docs',
      inputSchema: { query: z.string() },
      annotations: { readOnlyHint: true }
    }, async ({ query }) => ({
      content: [{ type: 'text', text: 'Fixture result for ' + query }],
      structuredContent: { query, source: 'fixture' }
    }));
    server.registerTool('write_doc', {
      description: 'Mutate fixture docs',
      inputSchema: { text: z.string() },
      annotations: { readOnlyHint: false }
    }, async ({ text }) => ({
      content: [{ type: 'text', text: 'wrote ' + text }]
    }));
    await server.connect(new StdioServerTransport());
  `;
  return ['--input-type=module', '-e', script];
}

test('external MCP connector lists and calls read-only tools only', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-mcp-ext-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const saved = await app.inject({
      method: 'POST',
      url: '/pod/mcp/servers',
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        id: 'fixture',
        name: 'Fixture MCP',
        enabled: true,
        transport: 'stdio',
        command: process.execPath,
        args: stdioFixtureArgs(),
        cwd: process.cwd(),
        context_tools: [{ name: 'search_docs', query_arg: 'query' }],
        env: { FIXTURE_SECRET: 'hidden' },
      },
    });
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.json().server.env_keys.includes('FIXTURE_SECRET'), true);
    assert.equal(saved.body.includes('hidden'), false);

    const tools = await app.inject({
      method: 'GET',
      url: '/pod/mcp/servers/fixture/tools',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(tools.statusCode, 200);
    const listedTools = tools.json().tools as Array<{ name: string; read_only_allowed: boolean }>;
    assert.equal(listedTools.find(tool => tool.name === 'search_docs')?.read_only_allowed, true);
    assert.equal(listedTools.find(tool => tool.name === 'write_doc')?.read_only_allowed, false);

    const called = await app.inject({
      method: 'POST',
      url: '/pod/mcp/servers/fixture/tools/search_docs/call',
      headers: { authorization: 'Bearer owner-token' },
      payload: { arguments: { query: 'billing' } },
    });
    assert.equal(called.statusCode, 200);
    assert.match(called.json().result.content[0].text, /Fixture result for billing/);

    const blocked = await app.inject({
      method: 'POST',
      url: '/pod/mcp/servers/fixture/tools/write_doc/call',
      headers: { authorization: 'Bearer owner-token' },
      payload: { arguments: { text: 'mutate' } },
    });
    assert.equal(blocked.statusCode, 400);
    assert.equal(blocked.json().error, 'mcp_tool_call_failed');

    const context = await app.inject({
      method: 'POST',
      url: '/pod/mcp/context',
      headers: { authorization: 'Bearer owner-token' },
      payload: { actor_id: 'person-local', query: 'roadmap' },
    });
    assert.equal(context.statusCode, 200);
    assert.match(context.json().context[0].text, /Fixture result for roadmap/);

    const query = await app.inject({
      method: 'POST',
      url: '/pod/query',
      headers: { authorization: 'Bearer owner-token' },
      payload: {
        actor_id: 'person-local',
        scope_alias: 'workspace',
        query: 'roadmap',
        include_external_mcp: true,
        use_llm: false,
      },
    });
    assert.equal(query.statusCode, 200);
    assert.match(query.json().external_context[0].text, /Fixture result for roadmap/);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});
