import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  applyAgentMcpConfig,
  buildClaudeCodeMcpArgs,
  buildOpenClawMcpArgs,
  deerFlowMcpServerEntry,
  kimiCodeMcpServerEntry,
  mergeMcpServersObject,
  parseRemoteMcpServerEntry,
  upsertCodexMcpBlock,
} from '../services/agent-connection.js';

const ENTRY = {
  type: 'http' as const,
  url: 'http://127.0.0.1:8732/mcp',
  headers: { Authorization: 'Bearer cpod_agent_12345678901234567890123456789012' },
};

test('agent connection accepts only bounded authenticated HTTP MCP entries', () => {
  assert.deepEqual(parseRemoteMcpServerEntry(ENTRY), ENTRY);
  assert.equal(parseRemoteMcpServerEntry({ ...ENTRY, url: 'file:///tmp/server' }), null);
  assert.equal(parseRemoteMcpServerEntry({ ...ENTRY, headers: { Authorization: 'Bearer owner-token' } }), null);
  assert.equal(parseRemoteMcpServerEntry({ ...ENTRY, url: 'http://127.0.0.1:8732/not-mcp' }), null);
});

test('JSON MCP merge preserves sibling servers and unrelated settings', () => {
  const merged = mergeMcpServersObject({
    theme: 'dark',
    mcpServers: { github: { url: 'https://example.test/mcp' } },
  }, ENTRY);

  assert.equal(merged.config.theme, 'dark');
  assert.deepEqual((merged.config.mcpServers as Record<string, unknown>).github, { url: 'https://example.test/mcp' });
  assert.deepEqual((merged.config.mcpServers as Record<string, unknown>)['coffee-pod'], ENTRY);
  assert.deepEqual(merged.siblings, ['github']);
  assert.equal(merged.replaced, false);
});

test('Codex TOML upsert is idempotent and preserves unrelated configuration', () => {
  const initial = 'model = "gpt-5"\n\n[projects."/tmp/demo"]\ntrust_level = "trusted"\n';
  const first = upsertCodexMcpBlock(initial, ENTRY);
  const rotated = upsertCodexMcpBlock(first.content, {
    ...ENTRY,
    headers: { Authorization: 'Bearer cpod_agent_abcdefghijklmnopqrstuvwxABCDEFGH' },
  });

  assert.equal(first.replaced, false);
  assert.equal(rotated.replaced, true);
  assert.match(rotated.content, /model = "gpt-5"/);
  assert.match(rotated.content, /\[projects\."\/tmp\/demo"\]/);
  assert.equal((rotated.content.match(/\[mcp_servers\.coffee-pod\]/g) ?? []).length, 1);
  assert.doesNotMatch(rotated.content, /12345678901234567890123456789012/);
});

test('Claude Code setup uses user scope and an authenticated HTTP transport', () => {
  assert.deepEqual(buildClaudeCodeMcpArgs(ENTRY), [
    'mcp', 'add', '--transport', 'http', '--scope', 'user',
    '--header', `Authorization: ${ENTRY.headers.Authorization}`, 'coffee-pod', ENTRY.url,
  ]);
});

test('OpenClaw setup targets an isolated profile and canonical streamable HTTP config', () => {
  const args = buildOpenClawMcpArgs(ENTRY, 'work');
  assert.deepEqual(args.slice(0, 5), ['--profile', 'work', 'mcp', 'set', 'coffee-pod']);
  assert.equal(args.length, 6);
  assert.deepEqual(JSON.parse(args[5]!), {
    url: ENTRY.url,
    transport: 'streamable-http',
    headers: ENTRY.headers,
  });
  assert.deepEqual(buildOpenClawMcpArgs(ENTRY).slice(0, 3), ['mcp', 'set', 'coffee-pod']);
  assert.throws(() => buildOpenClawMcpArgs(ENTRY, '../other'));
});

test('DeerFlow setup writes its enabled HTTP extension shape', () => {
  assert.deepEqual(deerFlowMcpServerEntry(ENTRY), {
    enabled: true,
    type: 'http',
    url: ENTRY.url,
    headers: ENTRY.headers,
  });
});

test('Kimi Code setup writes the well-known HTTP MCP server shape', () => {
  assert.deepEqual(kimiCodeMcpServerEntry(ENTRY), {
    url: ENTRY.url,
    headers: ENTRY.headers,
  });
});

test('Kimi Code automatic setup writes its user-level mcp.json idempotently', async () => {
  const kimiHome = await mkdtemp(path.join(tmpdir(), 'coffee-pod-kimi-'));
  const priorHome = process.env['KIMI_CODE_HOME'];
  process.env['KIMI_CODE_HOME'] = kimiHome;
  try {
    const first = await applyAgentMcpConfig('kimi-code', ENTRY);
    const second = await applyAgentMcpConfig('kimi-code', ENTRY);
    const config = JSON.parse(await readFile(path.join(kimiHome, 'mcp.json'), 'utf8'));

    assert.equal(first.created, true);
    assert.equal(second.replaced_existing_entry, true);
    assert.deepEqual(config.mcpServers['coffee-pod'], {
      url: ENTRY.url,
      headers: ENTRY.headers,
    });
  } finally {
    if (priorHome === undefined) delete process.env['KIMI_CODE_HOME'];
    else process.env['KIMI_CODE_HOME'] = priorHome;
  }
});
