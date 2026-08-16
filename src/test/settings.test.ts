import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import { closeSmartwareCore, getSmartwareCore } from '../smartware/core.js';

let operationSequence = 900;
function operationId(): string {
  operationSequence += 1;
  return `op_${String(operationSequence).padStart(26, '0')}`;
}

function testEnv(dataDir: string, overrides: Partial<CoffeePodEnv> = {}): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'founder-test',
    podName: 'Founder Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
    ...overrides,
  };
}

test('GET /pod/runtime returns identity, mode, and editable flags', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-runtime-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const res = await app.inject({ method: 'GET', url: '/pod/runtime' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.pod_id, 'founder-test');
    assert.equal(body.pod_name, 'Founder Test Pod');
    assert.equal(body.pod_name_override, null);
    assert.equal(body.owner_display_name, null);
    assert.equal(body.owner_avatar_data_url, null);
    assert.equal(body.data_dir, dataDir);
    assert.equal(body.auth_required, false);
    assert.equal(body.onboarding_complete, false);
    assert.equal(body.onboarding_version, null);
    assert.ok(['desktop', 'local', 'hosted'].includes(body.mode));
    assert.equal(body.editable.display_name, true);
    assert.equal(body.editable.avatar_data_url, true);
    assert.equal(body.editable.pod_name_override, true);
    assert.equal(typeof body.editable.data_dir, 'boolean');
    assert.ok(body.owner_id);
    assert.match(body.pod_url, /^http:\/\/127\.0\.0\.1:/);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('Settings round-trip: PATCH writes, GET reads, override surfaces on /pod/runtime', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-settings-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const empty = await app.inject({ method: 'GET', url: '/pod/settings/pod.identity' });
    assert.equal(empty.statusCode, 200);
    assert.deepEqual(empty.json(), { namespace: 'pod.identity', values: {} });

    const patch = await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.identity',
      payload: {
        values: {
          pod_name_override: 'Stevie’s Pod',
          display_name: 'Stevie Ghiassi',
          avatar_data_url: 'data:image/png;base64,iVBORw0KGgo=',
        },
      },
    });
    assert.equal(patch.statusCode, 200);
    assert.equal(patch.json().values.pod_name_override, 'Stevie’s Pod');
    assert.equal(patch.json().values.display_name, 'Stevie Ghiassi');

    const after = await app.inject({ method: 'GET', url: '/pod/settings/pod.identity' });
    assert.equal(after.statusCode, 200);
    assert.equal(after.json().values.pod_name_override, 'Stevie’s Pod');

    const runtime = await app.inject({ method: 'GET', url: '/pod/runtime' });
    assert.equal(runtime.json().pod_name_override, 'Stevie’s Pod');
    assert.equal(runtime.json().owner_display_name, 'Stevie Ghiassi');
    assert.equal(runtime.json().owner_avatar_data_url, 'data:image/png;base64,iVBORw0KGgo=');

    await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.onboarding',
      payload: { values: { completed: true, version: 1 } },
    });
    const onboardedRuntime = await app.inject({ method: 'GET', url: '/pod/runtime' });
    assert.equal(onboardedRuntime.json().onboarding_complete, true);
    assert.equal(onboardedRuntime.json().onboarding_version, 1);

    const types = await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.memory_defaults',
      payload: { values: { default_visibility: 'private', default_sensitive: true, default_use_llm: false } },
    });
    assert.equal(types.statusCode, 200);
    assert.equal(types.json().values.default_sensitive, true);
    assert.equal(types.json().values.default_use_llm, false);
    assert.equal(types.json().values.default_visibility, 'private');

    const clear = await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.identity',
      payload: { values: { pod_name_override: null } },
    });
    assert.equal(clear.statusCode, 200);
    assert.equal(clear.json().values.pod_name_override, undefined);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/pod/settings/pod.memory_defaults/default_sensitive',
    });
    assert.equal(deleteRes.statusCode, 200);
    assert.equal(deleteRes.json().removed, true);

    const finalState = await app.inject({ method: 'GET', url: '/pod/settings/pod.memory_defaults' });
    assert.equal(finalState.json().values.default_sensitive, false);
    assert.equal(finalState.json().values.default_use_llm, false);
    assert.equal(finalState.json().values.default_visibility, 'private');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('Settings namespace validation rejects bad input', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-settings-validate-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const bad = await app.inject({ method: 'GET', url: '/pod/settings/BadNamespace' });
    assert.equal(bad.statusCode, 400);
    assert.equal(bad.json().error, 'invalid_namespace');

    const blankName = await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.identity',
      payload: { values: { display_name: '   ' } },
    });
    assert.equal(blankName.statusCode, 400);
    assert.equal(blankName.json().error, 'invalid_values');

    const unsafeAvatar = await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.identity',
      payload: { values: { avatar_data_url: 'data:image/svg+xml;base64,PHN2Zz4=' } },
    });
    assert.equal(unsafeAvatar.statusCode, 400);
    assert.equal(unsafeAvatar.json().error, 'invalid_values');

    const ok = await app.inject({ method: 'GET', url: '/pod/settings/ui.appearance' });
    assert.equal(ok.statusCode, 200);

    const badMemoryDefaults = await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.memory_defaults',
      payload: { values: { default_visibility: 'everywhere', default_sensitive: 'yes' } },
    });
    assert.equal(badMemoryDefaults.statusCode, 400);
    assert.equal(badMemoryDefaults.json().error, 'invalid_values');
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('pod.memory_defaults are effective when observe callers omit policy values', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-memory-defaults-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);

  try {
    await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.memory_defaults',
      payload: {
        values: {
          default_visibility: 'scope',
          default_sensitive: false,
          default_use_llm: false,
        },
      },
    });
    const initial = await app.inject({ method: 'GET', url: '/pod/settings/pod.memory_defaults' });
    assert.deepEqual(initial.json().values, {
      default_visibility: 'scope',
      default_sensitive: false,
      default_use_llm: false,
    });

    const configured = await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.memory_defaults',
      payload: { values: { default_visibility: 'private', default_sensitive: true } },
    });
    assert.equal(configured.statusCode, 200, configured.payload);

    const inherited = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'workspace',
        type: 'decision',
        content: 'Inherited memory policy fixture.',
      },
    });
    assert.equal(inherited.statusCode, 200, inherited.payload);

    const explicit = await app.inject({
      method: 'POST',
      url: '/pod/observe',
      payload: {
        actor_id: 'person-local',
        operation_id: operationId(),
        scope_alias: 'workspace',
        type: 'decision',
        content: 'Explicit memory policy fixture.',
        visibility: 'workspace',
        sensitive: false,
      },
    });
    assert.equal(explicit.statusCode, 200, explicit.payload);

    const core = await getSmartwareCore(env);
    const layer0 = core as unknown as {
      layer0: {
        getDB(): {
          prepare(sql: string): { get(id: string): { visibility: string; sensitive: number } | undefined };
        };
      };
    };
    const statement = layer0.layer0.getDB().prepare('SELECT visibility, sensitive FROM observations WHERE id = ?');
    assert.deepEqual(statement.get(inherited.json().id), { visibility: 'private', sensitive: 1 });
    assert.deepEqual(statement.get(explicit.json().id), { visibility: 'workspace', sensitive: 0 });
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('Settings routes are owner-only when an API token is set', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-settings-auth-'));
  const app = await buildApp(testEnv(dataDir, { apiToken: 'owner-token' }), false);

  try {
    const blocked = await app.inject({ method: 'GET', url: '/pod/settings/pod.identity' });
    assert.equal(blocked.statusCode, 401);

    const allowed = await app.inject({
      method: 'GET',
      url: '/pod/settings/pod.identity',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(allowed.statusCode, 200);

    const runtime = await app.inject({
      method: 'GET',
      url: '/pod/runtime',
      headers: { authorization: 'Bearer owner-token' },
    });
    assert.equal(runtime.statusCode, 200);
    assert.equal(runtime.json().auth_required, true);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('pod.model_usage settings merge with the v1 defaults', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-model-usage-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const initial = await app.inject({ method: 'GET', url: '/pod/settings/pod.model_usage' });
    assert.equal(initial.statusCode, 200);
    assert.equal(initial.json().values.local_only, true);
    assert.equal(initial.json().values.monthly_token_budget, 0);
    assert.equal(initial.json().values.source_defaults.upload.auto_reflect, false);

    const updated = await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.model_usage',
      payload: {
        values: {
          cloud_enabled: true,
          local_only: false,
          source_defaults: {
            upload: { auto_reflect: true },
          },
        },
      },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().values.cloud_enabled, true);
    assert.equal(updated.json().values.local_only, false);
    assert.equal(updated.json().values.source_defaults.upload.auto_reflect, true);
    assert.equal(updated.json().values.source_defaults['google-drive'].auto_reflect, false);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});

test('pod.reflect_cadence settings expose autonomous REFLECT defaults', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-reflect-cadence-'));
  const app = await buildApp(testEnv(dataDir), false);

  try {
    const initial = await app.inject({ method: 'GET', url: '/pod/settings/pod.reflect_cadence' });
    assert.equal(initial.statusCode, 200);
    assert.equal(initial.json().values.mode, 'manual_only');
    assert.equal(initial.json().values.interval_seconds, null);

    const updated = await app.inject({
      method: 'PATCH',
      url: '/pod/settings/pod.reflect_cadence',
      payload: {
        values: {
          mode: 'every_6h',
          interval_seconds: 21_600,
        },
      },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().values.mode, 'every_6h');
    assert.equal(updated.json().values.interval_seconds, 21_600);
    assert.equal(updated.json().values.last_reflected_at, null);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});
