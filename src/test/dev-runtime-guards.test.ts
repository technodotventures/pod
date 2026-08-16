import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  resolveDevRuntime,
  waitForExpectedPod,
} = require('../../scripts/dev-runtime-guards.cjs') as {
  resolveDevRuntime(
    projectRoot: string,
    env?: Record<string, string | undefined>,
  ): {
    baseUrl: string;
    dataDir: string;
    port: number;
    token: string;
  };
  waitForExpectedPod(options: {
    runtime: {
      baseUrl: string;
      dataDir: string;
      port: number;
      token: string;
    };
    probe?: () => Promise<{ ready: boolean; reachable: boolean }>;
    delay?: () => Promise<void>;
    timeoutMs?: number;
  }): Promise<void>;
};

test('web development uses a dedicated backend port and resolved data directory', () => {
  const projectRoot = path.resolve('/workspace/coffee-pod');

  assert.deepEqual(resolveDevRuntime(projectRoot, {}), {
    baseUrl: 'http://127.0.0.1:8733',
    dataDir: path.join(projectRoot, 'data'),
    port: 8733,
    token: '',
  });

  assert.deepEqual(resolveDevRuntime(projectRoot, {
    COFFEE_POD_PORT: '8740',
    COFFEE_POD_DATA_DIR: '../pod-data',
    COFFEE_POD_API_TOKEN: 'owner-token',
  }), {
    baseUrl: 'http://127.0.0.1:8740',
    dataDir: path.resolve(projectRoot, '../pod-data'),
    port: 8740,
    token: 'owner-token',
  });
});

test('the standard web development command starts the paired API and UI', () => {
  const packageJson = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as { scripts?: Record<string, string> };

  assert.equal(packageJson.scripts?.['ui:dev'], 'npm run dev:all');
  assert.equal(packageJson.scripts?.['ui:only'], 'vite');
});

test('web development refuses a reachable Pod with the wrong identity', async () => {
  const runtime = resolveDevRuntime('/workspace/coffee-pod', {});

  await assert.rejects(
    waitForExpectedPod({
      runtime,
      probe: async () => ({ ready: false, reachable: true }),
      delay: async () => undefined,
      timeoutMs: 100,
    }),
    /already serving a different or unauthorized Pod/,
  );
});

test('web development waits through startup and accepts only the expected Pod', async () => {
  const runtime = resolveDevRuntime('/workspace/coffee-pod', {});
  let probes = 0;

  await waitForExpectedPod({
    runtime,
    probe: async () => {
      probes += 1;
      return probes === 1
        ? { ready: false, reachable: false }
        : { ready: true, reachable: true };
    },
    delay: async () => undefined,
    timeoutMs: 100,
  });

  assert.equal(probes, 2);
});
