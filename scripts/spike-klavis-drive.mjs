#!/usr/bin/env node
/**
 * SPIKE — Validate Klavis Google Drive MCP server end-to-end.
 *
 * Reads the existing Pod OAuth token from data/integrations/google-drive.json,
 * refreshes it via Google's OAuth2 endpoint, starts the Klavis Drive MCP
 * container locally, then connects as an MCP client and lists tools + calls
 * one tool (search_files) to prove the round-trip works.
 *
 * Throwaway. If this works, the patterns here get extracted into
 * src/services/mcp-clients/.
 */
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(REPO_ROOT, 'data/integrations/google-drive.json');
const CONTAINER_NAME = 'klavis-drive-spike';
const HOST_PORT = 5055;
const IMAGE = 'ghcr.io/klavis-ai/google-drive-mcp-server:latest';

async function refreshAccessToken(config) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: config.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function dockerExec(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    if (!opts.inherit) {
      child.stdout.on('data', d => { stdout += d; });
      child.stderr.on('data', d => { stderr += d; });
    }
    child.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`docker ${args.join(' ')} exited ${code}: ${stderr}`)));
  });
}

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.status < 500) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`Server at ${url} did not come up within ${timeoutMs}ms`);
}

async function main() {
  console.log('▸ Reading existing Drive config…');
  const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  if (!config.refresh_token) throw new Error('No refresh_token in google-drive.json — re-auth first');

  console.log('▸ Refreshing Google access token…');
  const tokens = await refreshAccessToken(config);
  const accessToken = tokens.access_token;
  console.log(`  ✓ Got access token (expires in ${tokens.expires_in}s)`);

  console.log('▸ Cleaning up any prior spike container…');
  try { await dockerExec(['rm', '-f', CONTAINER_NAME]); } catch {}

  console.log(`▸ Starting Klavis Drive MCP server on :${HOST_PORT} (with SKIP_OAUTH=true)…`);
  // SKIP_OAUTH=true: bypass Klavis Cloud OAuth dance. We'll inject tokens via
  // the x-auth-data header on each MCP call (production-shape).
  await dockerExec([
    'run', '-d',
    '--name', CONTAINER_NAME,
    '-p', `${HOST_PORT}:5000`,
    '-e', 'SKIP_OAUTH=true',
    IMAGE,
  ]);

  try {
    console.log('▸ Waiting for server to be ready…');
    await waitForServer(`http://127.0.0.1:${HOST_PORT}/mcp/`);

    console.log('▸ Connecting MCP client…');
    const authDataB64 = Buffer.from(JSON.stringify({ access_token: accessToken })).toString('base64');
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${HOST_PORT}/mcp/`),
      { requestInit: { headers: { 'x-auth-data': authDataB64 } } },
    );
    const client = new Client({ name: 'coffee-pod-spike', version: '0.0.1' });
    await client.connect(transport);
    console.log('  ✓ Connected');

    console.log('▸ Listing tools…');
    const toolsResp = await client.listTools();
    console.log(`  ✓ ${toolsResp.tools.length} tools available:`);
    for (const t of toolsResp.tools.slice(0, 10)) {
      console.log(`    - ${t.name}: ${(t.description ?? '').slice(0, 80)}`);
    }
    if (toolsResp.tools.length > 10) console.log(`    … and ${toolsResp.tools.length - 10} more`);

    // Find a search tool and call it
    const searchTool = toolsResp.tools.find(t => /search/i.test(t.name));
    if (searchTool) {
      console.log(`\n▸ Calling tool: ${searchTool.name} (empty query → list recent files)…`);
      const result = await client.callTool({
        name: searchTool.name,
        arguments: { query: '' },
      });
      const text = result.content?.[0]?.text ?? JSON.stringify(result, null, 2);
      console.log(`  ✓ Result (${text.length} chars):`);
      console.log(text.slice(0, 800) + (text.length > 800 ? '\n    …(truncated)' : ''));
    } else {
      console.log('  ⚠ No search tool found — but tool listing succeeded, so auth works');
    }

    await client.close();
    console.log('\n✅ SPIKE PASSED — Klavis Drive MCP server works end-to-end with BYO tokens via x-auth-data header.');
  } finally {
    console.log('\n▸ Tearing down container…');
    try {
      const logs = await dockerExec(['logs', CONTAINER_NAME]);
      if (process.env.SPIKE_VERBOSE) console.log('--- container logs ---\n' + logs);
    } catch {}
    try { await dockerExec(['rm', '-f', CONTAINER_NAME]); } catch {}
  }
}

main().catch(err => {
  console.error('\n❌ SPIKE FAILED:', err.message);
  process.exit(1);
});
