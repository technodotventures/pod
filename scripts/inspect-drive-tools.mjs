#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { loadEnv } = await import(path.join(REPO_ROOT, 'src/config/env.ts'));
const { listMcpTools, callMcpTool, shutdownMcpClients } = await import(path.join(REPO_ROOT, 'src/services/mcp-clients/client-pool.ts'));
const env = { ...loadEnv(), mcpClientEnabled: true };
try {
  const tools = await listMcpTools(env, 'google-drive');
  for (const t of tools) {
    console.log(`\n=== ${t.name} ===`);
    console.log('description:', t.description);
    console.log('schema:', JSON.stringify(t.inputSchema, null, 2));
  }

  // Get one doc with get_document_by_id to see actual response shape
  const search = await callMcpTool(env, 'google-drive', 'google_drive_search_documents', { query: 'TIG' });
  const text = JSON.parse(search.content[0].text);
  const firstId = text.documents?.[0]?.id;
  if (firstId) {
    console.log('\n=== sample get_document_by_id response ===');
    const doc = await callMcpTool(env, 'google-drive', 'google_drive_get_document_by_id', { document_id: firstId });
    const docText = JSON.parse(doc.content[0].text);
    console.log('keys:', Object.keys(docText));
    console.log('first 400 chars:', JSON.stringify(docText).slice(0, 400));
  }
} finally {
  await shutdownMcpClients(env);
}
