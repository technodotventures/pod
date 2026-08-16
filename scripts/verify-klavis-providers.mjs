#!/usr/bin/env node
// Boot each Klavis MCP container we have an image for, list its tools,
// then tear it down. Confirms the image is functional even without an
// OAuth token (tools list works without `x-auth-data`).

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const PROVIDERS = [
  { id: 'gmail',    image: 'ghcr.io/klavis-ai/gmail-mcp-server' },
  { id: 'github',   image: 'ghcr.io/klavis-ai/github-mcp-server' },
  { id: 'slack',    image: 'ghcr.io/klavis-ai/slack-mcp-server' },
  { id: 'notion',   image: 'ghcr.io/klavis-ai/notion-mcp-server' },
  { id: 'linear',   image: 'ghcr.io/klavis-ai/linear-mcp-server' },
];

const BASE_PORT = 5200;

function exec(cmd, args) {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', code => resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code }));
  });
}

async function waitReady(url, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {/* not yet */}
    await sleep(400);
  }
  throw new Error(`server at ${url} did not boot within ${timeoutMs}ms`);
}

async function verify(provider, index) {
  const port = BASE_PORT + index;
  const name = `coffee-pod-verify-${provider.id}`;
  const url = `http://127.0.0.1:${port}/mcp/`;
  console.log(`\n▸ ${provider.id} (${provider.image})`);

  await exec('docker', ['rm', '-f', name]);
  const runRes = await exec('docker', [
    'run', '-d',
    '--name', name,
    '-p', `${port}:5000`,
    '-e', 'SKIP_OAUTH=true',
    `${provider.image}:latest`,
  ]);
  if (runRes.code !== 0) {
    console.log(`  ✗ docker run failed: ${runRes.stderr.slice(0, 200)}`);
    return { provider: provider.id, ok: false, error: runRes.stderr };
  }

  try {
    await waitReady(url);
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      // Empty auth blob — tools/list shouldn't need creds. Calls will, but we only list here.
      requestInit: { headers: { 'x-auth-data': Buffer.from(JSON.stringify({ access_token: 'verify-only' })).toString('base64') } },
    });
    const client = new Client({ name: 'verify', version: '0.0.1' });
    await client.connect(transport);
    const { tools } = await client.listTools();
    console.log(`  ✓ ${tools.length} tools: ${tools.slice(0, 4).map(t => t.name).join(', ')}${tools.length > 4 ? '…' : ''}`);
    await client.close();
    // Capture the image digest for the registry pin.
    const digestRes = await exec('docker', ['inspect', '--format', '{{index .RepoDigests 0}}', `${provider.image}:latest`]);
    const digest = digestRes.stdout.split('@')[1] ?? null;
    return { provider: provider.id, ok: true, tool_count: tools.length, sample: tools.slice(0, 3).map(t => t.name), digest };
  } catch (err) {
    console.log(`  ✗ ${err.message}`);
    const logs = await exec('docker', ['logs', '--tail', '20', name]);
    if (logs.stdout) console.log(`    last logs: ${logs.stdout.slice(-300)}`);
    return { provider: provider.id, ok: false, error: err.message };
  } finally {
    await exec('docker', ['rm', '-f', name]);
  }
}

const results = [];
for (let i = 0; i < PROVIDERS.length; i++) {
  results.push(await verify(PROVIDERS[i], i));
}

console.log(`\n${'='.repeat(60)}\nSummary`);
for (const r of results) {
  if (r.ok) console.log(`  ✓ ${r.provider}: ${r.tool_count} tools  digest=${r.digest?.slice(0, 24)}…`);
  else console.log(`  ✗ ${r.provider}: ${r.error?.slice(0, 80)}`);
}
console.log('');
console.log('Verified digests (for registry pinning):');
for (const r of results) if (r.ok && r.digest) console.log(`  ${r.provider}: ${r.digest}`);
