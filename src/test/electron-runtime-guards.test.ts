import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  probePodRuntime,
  selectDataHome,
} = require('../../electron/runtime-guards.cjs') as {
  probePodRuntime(options: {
    baseUrl: string;
    token: string;
    expectedDataDir: string;
    fetchImpl: (url: string, init: RequestInit) => Promise<{
      ok: boolean;
      json(): Promise<unknown>;
    }>;
  }): Promise<{ ready: boolean; reachable: boolean }>;
  selectDataHome(
    defaultPath: string,
    legacyPaths: string[],
    existsSync: (value: string) => boolean,
  ): string;
};

test('desktop data-home selection keeps current data and otherwise adopts the first legacy Pod', () => {
  const defaultPath = path.resolve('/app-data/Pod');
  const firstLegacy = path.resolve('/app-data/coffee-pod');
  const secondLegacy = path.resolve('/app-data/legacy-display-name');

  assert.equal(
    selectDataHome(defaultPath, [firstLegacy, secondLegacy], value => value === path.join(defaultPath, 'data')),
    defaultPath,
  );
  assert.equal(
    selectDataHome(defaultPath, [firstLegacy, secondLegacy], value => value === path.join(firstLegacy, 'data')),
    firstLegacy,
  );
  assert.equal(
    selectDataHome(defaultPath, [firstLegacy, secondLegacy], () => false),
    defaultPath,
  );
});

test('desktop readiness requires the authenticated server to own the expected data home', async () => {
  const expectedDataDir = path.resolve('/app-data/Pod/data');
  const matchingFetch = async (_url: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer owner-token');
    return {
      ok: true,
      json: async () => ({ data_dir: expectedDataDir }),
    };
  };

  assert.deepEqual(
    await probePodRuntime({
      baseUrl: 'http://127.0.0.1:8732',
      token: 'owner-token',
      expectedDataDir,
      fetchImpl: matchingFetch,
    }),
    { ready: true, reachable: true },
  );

  assert.deepEqual(
    await probePodRuntime({
      baseUrl: 'http://127.0.0.1:8732',
      token: 'owner-token',
      expectedDataDir,
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ data_dir: '/tmp/a-different-pod' }),
      }),
    }),
    { ready: false, reachable: true },
  );

  assert.deepEqual(
    await probePodRuntime({
      baseUrl: 'http://127.0.0.1:8732',
      token: 'owner-token',
      expectedDataDir,
      fetchImpl: async () => ({
        ok: false,
        json: async () => ({}),
      }),
    }),
    { ready: false, reachable: true },
  );

  assert.deepEqual(
    await probePodRuntime({
      baseUrl: 'http://127.0.0.1:8732',
      token: 'owner-token',
      expectedDataDir,
      fetchImpl: async () => { throw new Error('connection refused'); },
    }),
    { ready: false, reachable: false },
  );
});
