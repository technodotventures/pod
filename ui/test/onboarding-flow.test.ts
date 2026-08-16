import assert from 'node:assert/strict';
import test from 'node:test';

import {
  agentMcpEntry,
  identitySlug,
  installedAgentsFirst,
  manualAgentConfig,
  modelSetupSummary,
  normalizeReflectionCadence,
  reflectionCycleLabel,
  reflectionIntervalSeconds,
} from '../src/onboarding-flow.ts';

test('normalizes an onboarding identity into a stable actor slug', () => {
  assert.equal(identitySlug('  Stevie Ghiassi  '), 'stevie-ghiassi');
  assert.equal(identitySlug('Coffee & Pod'), 'coffee-pod');
});

test('puts detected, automatically configurable agents first', () => {
  const sorted = installedAgentsFirst([
    { agent_id: 'zed', name: 'Zed', installed: false, auto_configurable: false, config_path: null, cli_path: null },
    { agent_id: 'continue', name: 'Continue', installed: true, auto_configurable: false, config_path: '/tmp/continue', cli_path: null },
    { agent_id: 'codex', name: 'Codex', installed: true, auto_configurable: true, config_path: '/tmp/codex', cli_path: null },
  ]);

  assert.deepEqual(sorted.map(agent => agent.agent_id), ['codex', 'continue', 'zed']);
});

test('builds bounded HTTP MCP config for JSON and Codex clients', () => {
  const entry = agentMcpEntry('http://127.0.0.1:8732/', 'cpod_agent_12345678901234567890123456789012');
  assert.equal(entry.url, 'http://127.0.0.1:8732/mcp');
  assert.match(manualAgentConfig('claude-code', entry), /"type": "http"/);
  assert.match(manualAgentConfig('codex', entry), /\[mcp_servers\.coffee-pod\]/);
  assert.match(manualAgentConfig('codex', entry), /http_headers/);
  assert.match(manualAgentConfig('hermes', entry), /mcp_servers:/);
  assert.match(manualAgentConfig('hermes', entry), /Authorization:/);
  assert.deepEqual(JSON.parse(manualAgentConfig('openclaw', entry)).mcp.servers['coffee-pod'], {
    url: entry.url,
    transport: 'streamable-http',
    headers: entry.headers,
  });
  assert.deepEqual(JSON.parse(manualAgentConfig('kimi-code', entry)).mcpServers['coffee-pod'], {
    url: entry.url,
    headers: entry.headers,
  });
  assert.deepEqual(JSON.parse(manualAgentConfig('deerflow', entry)).mcpServers['coffee-pod'], {
    enabled: true,
    type: 'http',
    url: entry.url,
    headers: entry.headers,
  });
});

test('maps reflection choices to exact intervals and safely upgrades beta demo cadences', () => {
  assert.equal(reflectionIntervalSeconds('every_15m'), 900);
  assert.equal(reflectionIntervalSeconds('hourly'), 3600);
  assert.equal(reflectionIntervalSeconds('every_6h'), 21600);
  assert.equal(reflectionIntervalSeconds('daily'), 86400);
  assert.equal(reflectionIntervalSeconds('manual_only'), null);
  assert.equal(reflectionCycleLabel('every_6h'), '6 hours');
  assert.equal(normalizeReflectionCadence('every_2m'), 'every_15m');
  assert.equal(normalizeReflectionCadence('unknown'), 'every_6h');
});

test('describes model setup without claiming an unfinished sign-in succeeded', () => {
  assert.equal(modelSetupSummary('none', undefined, false, false), 'Not connected');
  assert.equal(modelSetupSummary('openai', 'account', false, false), 'OpenAI · sign-in pending');
  assert.equal(modelSetupSummary('openai', 'api_key', true, false), 'OpenAI · API key');
  assert.equal(modelSetupSummary('anthropic', undefined, false, false), 'Anthropic · connect later');
  assert.equal(modelSetupSummary('anthropic', 'account', false, true), 'Anthropic · connected');
  assert.equal(modelSetupSummary('codex', 'account', false, false), 'Codex · sign-in pending');
  assert.equal(modelSetupSummary('codex', 'account', false, true), 'Codex · connected');
});
