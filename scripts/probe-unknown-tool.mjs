#!/usr/bin/env node
/** Probe what the MCP client throws when calling a non-existent tool. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { loadEnv } = await import(path.join(REPO_ROOT, 'src/config/env.ts'));
const { callMcpTool, shutdownMcpClients } = await import(path.join(REPO_ROOT, 'src/services/mcp-clients/client-pool.ts'));
const env = { ...loadEnv(), mcpClientEnabled: true };
async function probe(label, tool, args) {
  try {
    const result = await callMcpTool(env, 'google-drive', tool, args);
    console.log(`[${label}] isError=${result.isError} content=${JSON.stringify(result.content).slice(0, 200)}`);
  } catch (err) {
    console.log(`[${label}] THREW name=${err.name} message=${err.message.slice(0, 120)}`);
  }
}
try {
  await probe('unknown tool', 'google_drive_does_not_exist', {});
  await probe('valid tool empty args', 'google_drive_search_documents', {});
  await probe('valid tool, bogus arg', 'google_drive_search_documents', { not_a_real_arg: 'foo' });
  await probe('valid tool, wrong type', 'google_drive_search_documents', { limit: 'not a number' });
} catch (err) {
  console.log('error name:', err.name);
  console.log('error message:', err.message);
  console.log('error code:', err.code);
  console.log('error data:', JSON.stringify(err.data ?? null));
  console.log('constructor:', err.constructor?.name);
  console.log('cause:', err.cause);
  console.log('keys:', Object.keys(err));
} finally {
  await shutdownMcpClients(env);
}
