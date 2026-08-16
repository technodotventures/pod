#!/usr/bin/env node
/**
 * Smoke test for the new src/services/mcp-clients/* and oauth-refresh modules.
 * Exercises the same code path the HTTP routes use, without starting a server.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// tsx is required at the top to load TS modules; this script must be run via tsx.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { loadEnv } = await import(path.join(REPO_ROOT, 'src/config/env.ts'));
const { listMcpTools, callMcpTool, shutdownMcpClients } = await import(path.join(REPO_ROOT, 'src/services/mcp-clients/client-pool.ts'));

const env = { ...loadEnv(), mcpClientEnabled: true };
const serviceId = process.argv[2] ?? 'google-drive';
const toolName = process.argv[3] ?? 'google_drive_search_documents';
const toolArgs = process.argv[4] ? JSON.parse(process.argv[4]) : { query: '' };

try {
  console.log(`▸ Listing MCP tools for ${serviceId}…`);
  const tools = await listMcpTools(env, serviceId);
  console.log(`  ✓ ${tools.length} tools:`);
  for (const t of tools) console.log(`    - ${t.name}`);

  console.log(`\n▸ Calling ${toolName} with ${JSON.stringify(toolArgs)}…`);
  const result = await callMcpTool(env, serviceId, toolName, toolArgs);
  const text = JSON.stringify(result, null, 2);
  console.log(`  ✓ Result preview (${text.length} chars):`);
  console.log(text.slice(0, 600) + (text.length > 600 ? '\n    …(truncated)' : ''));

  console.log('\n✅ Service-layer smoke test PASSED');
} catch (err) {
  console.error('\n❌ FAILED:', err.message);
  if (err.cause) console.error('  cause:', err.cause);
  process.exitCode = 1;
} finally {
  await shutdownMcpClients(env);
}
