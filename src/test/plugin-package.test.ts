import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGENT_PLUGIN_MCP_SCHEMA_URI,
  AGENT_PLUGIN_SCHEMA_URI,
  inspectAgentPluginPackage,
} from '../capabilities/plugin-package.js';

const MANIFEST = JSON.stringify({
  $schema: AGENT_PLUGIN_SCHEMA_URI,
  name: 'review.tools',
  version: '1.0.0',
  description: 'Review tools for coding agents.',
  author: { name: 'Coffee' },
  extensions: { 'com.coffee.pod': { enabled: true } },
});

const SKILL = `---
name: review-changes
description: Review changes before merge.
---

# Review changes
`;

test('Agent Plugin inspection hashes the package and isolates invalid sibling components', () => {
  const files = {
    'plugin.json': MANIFEST,
    'skills/review/SKILL.md': SKILL,
    'skills/broken/SKILL.md': '# Missing frontmatter\n',
    'mcp.json': JSON.stringify({
      $schema: AGENT_PLUGIN_MCP_SCHEMA_URI,
      mcpServers: {
        reviewer: { type: 'stdio', command: './bin/reviewer' },
        broken: { type: 'stdio' },
      },
    }),
    'com.coffee.pod/hooks/hooks.json': '{"event":"after-turn"}',
  };

  const inspected = inspectAgentPluginPackage(files);
  assert.equal(inspected.inspection.valid, true);
  assert.equal(inspected.inspection.components.skills.length, 2);
  assert.equal(inspected.inspection.components.skills.find(skill => skill.key === 'review')?.status, 'valid');
  assert.equal(inspected.inspection.components.skills.find(skill => skill.key === 'broken')?.status, 'invalid');
  assert.equal(inspected.inspection.components.mcp_servers.find(server => server.key === 'reviewer')?.status, 'valid');
  assert.equal(inspected.inspection.components.mcp_servers.find(server => server.key === 'broken')?.status, 'invalid');
  assert.deepEqual(inspected.inspection.components.extensions, [
    { key: 'com.coffee.pod', status: 'unsupported', file_count: 1 },
  ]);
  assert.equal(inspected.inspection.risk.local_executables, 1);

  const reordered = inspectAgentPluginPackage(Object.fromEntries(Object.entries(files).reverse()));
  assert.equal(reordered.package_hash, inspected.package_hash, 'file order must not affect package identity');

  const changed = inspectAgentPluginPackage({ ...files, 'skills/review/SKILL.md': `${SKILL}\nChanged.\n` });
  assert.notEqual(changed.package_hash, inspected.package_hash);
});

test('Agent Plugin inspection rejects unsupported schemas and escaping package paths', () => {
  const unsupported = inspectAgentPluginPackage({
    'plugin.json': JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/2.0.0/plugin.schema.json', name: 'future.plugin' }),
  });
  assert.equal(unsupported.inspection.valid, false);
  assert(unsupported.inspection.issues.some(issue => issue.code === 'schema_unsupported'));

  assert.throws(
    () => inspectAgentPluginPackage({ '../plugin.json': MANIFEST }),
    /escapes its root/,
  );
});
