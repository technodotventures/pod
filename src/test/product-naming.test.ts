import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const USER_FACING_FILES = [
  'README.md',
  'docs/backup-restore.md',
  'docs/coffee-staging-integration.md',
  'docs/diagnostics.md',
  'docs/experience-loop.md',
  'docs/install.md',
  'docs/retrieval-memory.md',
  'src/app.ts',
  'src/mcp/pod-api.ts',
  'src/routes/agents.ts',
  'src/routes/events.ts',
  'src/routes/google-drive.ts',
  'src/routes/pod.ts',
  'src/routes/upload.ts',
  'src/security/auth.ts',
  'src/security/host-guard.ts',
  'src/services/macos-keychain.ts',
  'ui/src/main.tsx',
] as const;

test('Coffee-facing surfaces call the product Pod', async () => {
  const packageJson = JSON.parse(
    await readFile(path.resolve('package.json'), 'utf8'),
  ) as { description?: string; build?: { productName?: string } };
  if (packageJson.build?.productName !== undefined) {
    assert.equal(packageJson.build.productName, 'Pod');
  }
  assert.match(packageJson.description ?? '', /^Pod runtime:/);

  for (const filename of USER_FACING_FILES) {
    const content = await readFile(path.resolve(filename), 'utf8');
    assert.doesNotMatch(content, /Coffee Pod/, filename);
  }

  const electron = await readFile(path.resolve('electron/main.cjs'), 'utf8');
  assert.doesNotMatch(electron, /title:\s*['"]Coffee Pod['"]/);
  assert.doesNotMatch(electron, /Local Coffee Pod/);
  assert.doesNotMatch(electron, /Coffee Pod (?:server|backup|could not start)/);
});
