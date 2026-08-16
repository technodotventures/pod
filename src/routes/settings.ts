import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { requireOwnerAuth } from '../security/auth.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { getDb, getSettings, setSettings, deleteSetting } from '../pod/db.js';
import { defaultTrustMode, invalidateTrustModeCache, TRUST_MODE_VALUES, type TrustMode } from '../security/trust-mode.js';
import {
  applyDreamCadenceDefaults,
  DREAM_CADENCE_NAMESPACE,
  initializeDreamCadence,
  validateDreamCadenceValues,
} from '../services/dream-cycle.js';
import {
  applyMemoryDefaults,
  MEMORY_DEFAULTS_NAMESPACE,
  validateMemoryDefaults,
} from '../services/memory-settings.js';
import {
  applyReflectionCadenceDefaults,
  initializeReflectionCadence,
  REFLECTION_CADENCE_NAMESPACE,
  validateReflectionCadenceValues,
} from '../services/reflection-cycle.js';
import {
  applyRetrievalSettingsDefaults,
  RETRIEVAL_SETTINGS_NAMESPACE,
  validateRetrievalSettings,
} from '../services/semantic-retrieval.js';

const NAMESPACE_PATTERN = /^[a-z][a-z0-9_.]{0,63}$/;
const MAX_IDENTITY_LABEL_LENGTH = 80;
const MAX_AVATAR_DATA_URL_LENGTH = 1_000_000;
const AVATAR_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const DEFAULT_MODEL_USAGE = {
  cloud_enabled: false,
  local_only: true,
  monthly_token_budget: 0,
  per_operation_confirmation_threshold: 5000,
  source_defaults: {
    upload: { auto_reflect: false },
    'local-folder': { auto_reflect: false },
    'google-drive': { auto_reflect: false },
    coffee: { auto_reflect: false },
  },
};
function detectMode(env: CoffeePodEnv): 'desktop' | 'local' | 'hosted' {
  if (process.versions['electron']) return 'desktop';
  if (env.host === '127.0.0.1' || env.host === 'localhost' || env.host === '::1') return 'local';
  return 'hosted';
}

function ownerDisplayName(identity: Record<string, unknown>): string | null {
  const displayName = identity['display_name'];
  if (typeof displayName === 'string' && displayName.trim()) return displayName.trim();

  const legacySlug = identity['user_slug'];
  if (typeof legacySlug !== 'string' || !legacySlug.trim()) return null;
  return legacySlug
    .trim()
    .split(/[-_]+/)
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function ownerAvatarDataUrl(identity: Record<string, unknown>): string | null {
  const value = identity['avatar_data_url'];
  return typeof value === 'string' && AVATAR_DATA_URL_PATTERN.test(value) ? value : null;
}

function applyNamespaceDefaults(namespace: string, values: Record<string, unknown>, env: CoffeePodEnv): Record<string, unknown> {
  if (namespace === 'pod.model_usage') {
    return {
      ...DEFAULT_MODEL_USAGE,
      ...values,
      source_defaults: { ...DEFAULT_MODEL_USAGE.source_defaults, ...(values['source_defaults'] as Record<string, unknown> | undefined) },
    };
  }
  if (namespace === MEMORY_DEFAULTS_NAMESPACE) return applyMemoryDefaults(values);
  if (namespace === REFLECTION_CADENCE_NAMESPACE) return applyReflectionCadenceDefaults(values);
  if (namespace === DREAM_CADENCE_NAMESPACE) return applyDreamCadenceDefaults(values);
  if (namespace === RETRIEVAL_SETTINGS_NAMESPACE) return applyRetrievalSettingsDefaults(values);
  if (namespace === 'pod.trust_mode') return { mode: defaultTrustMode(env), ...values };
  return values;
}

function validateNamespaceValues(namespace: string, values: Record<string, unknown>): string | null {
  if (namespace === 'pod.identity') {
    for (const key of ['display_name', 'pod_name_override'] as const) {
      const value = values[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== 'string' || !value.trim()) {
        return `pod.identity.${key} must be a non-empty string or null`;
      }
      if (value.trim().length > MAX_IDENTITY_LABEL_LENGTH) {
        return `pod.identity.${key} must be ${MAX_IDENTITY_LABEL_LENGTH} characters or fewer`;
      }
    }
    const avatar = values['avatar_data_url'];
    if (avatar !== undefined && avatar !== null) {
      if (typeof avatar !== 'string' || avatar.length > MAX_AVATAR_DATA_URL_LENGTH || !AVATAR_DATA_URL_PATTERN.test(avatar)) {
        return 'pod.identity.avatar_data_url must be a PNG, JPEG, or WebP data URL no larger than 1 MB';
      }
    }
  }
  if (namespace === 'pod.trust_mode') {
    const mode = values['mode'];
    if (mode !== undefined && !(typeof mode === 'string' && TRUST_MODE_VALUES.includes(mode as TrustMode))) {
      return `pod.trust_mode.mode must be one of ${TRUST_MODE_VALUES.join(', ')}`;
    }
  }
  if (namespace === DREAM_CADENCE_NAMESPACE) return validateDreamCadenceValues(values);
  if (namespace === MEMORY_DEFAULTS_NAMESPACE) return validateMemoryDefaults(values);
  if (namespace === REFLECTION_CADENCE_NAMESPACE) return validateReflectionCadenceValues(values);
  if (namespace === RETRIEVAL_SETTINGS_NAMESPACE) return validateRetrievalSettings(values);
  return null;
}

export async function registerSettingsRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);

  app.get('/pod/runtime', {
    schema: { summary: 'Runtime info: identity, mode, and which fields are editable in this deployment' },
  }, async (request, reply) => {
    if (env.apiToken && !await requireOwnerAuth(request, reply, env)) return;

    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const identity = getSettings(db, 'pod.identity');
    const onboarding = getSettings(db, 'pod.onboarding');
    const mode = detectMode(env);

    return {
      pod_id: env.podId,
      pod_name: env.podName,
      pod_name_override: (identity['pod_name_override'] as string | undefined) ?? null,
      owner_display_name: ownerDisplayName(identity),
      owner_avatar_data_url: ownerAvatarDataUrl(identity),
      owner_id: profile.owner_id,
      pod_url: `http://${env.host}:${env.port}`,
      data_dir: env.dataDir,
      auth_required: Boolean(env.apiToken),
      onboarding_complete: onboarding['completed'] === true,
      onboarding_version: typeof onboarding['version'] === 'number' ? onboarding['version'] : null,
      mode,
      editable: {
        display_name: true,
        avatar_data_url: true,
        pod_name_override: true,
        data_dir: mode === 'desktop',
        port: mode === 'desktop',
        host: mode === 'desktop',
      },
    };
  });

  app.get('/pod/settings/:namespace', {
    schema: {
      summary: 'Read all settings for a namespace',
      params: {
        type: 'object',
        properties: { namespace: { type: 'string' } },
        required: ['namespace'],
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { namespace } = request.params as { namespace: string };
    if (!NAMESPACE_PATTERN.test(namespace)) {
      return reply.code(400).send({ error: 'invalid_namespace', message: 'namespace must match /^[a-z][a-z0-9_.]{0,63}$/' });
    }
    const values = getSettings(db, namespace);
    return {
      namespace,
      values: applyNamespaceDefaults(namespace, values, env),
    };
  });

  app.patch('/pod/settings/:namespace', {
    schema: {
      summary: 'Upsert settings in a namespace. Null values delete the key.',
      params: {
        type: 'object',
        properties: { namespace: { type: 'string' } },
        required: ['namespace'],
      },
      body: {
        type: 'object',
        properties: {
          values: { type: 'object', additionalProperties: true },
        },
        required: ['values'],
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { namespace } = request.params as { namespace: string };
    if (!NAMESPACE_PATTERN.test(namespace)) {
      return reply.code(400).send({ error: 'invalid_namespace', message: 'namespace must match /^[a-z][a-z0-9_.]{0,63}$/' });
    }
    const body = request.body as { values: Record<string, unknown> };
    const validationError = validateNamespaceValues(namespace, body.values);
    if (validationError) {
      return reply.code(400).send({ error: 'invalid_values', message: validationError });
    }
    const current = getSettings(db, namespace);
    const scheduleChanged = body.values['mode'] !== undefined || body.values['interval_seconds'] !== undefined;
    const values = namespace === 'pod.model_usage'
      ? {
          ...DEFAULT_MODEL_USAGE,
          ...body.values,
          source_defaults: {
            ...DEFAULT_MODEL_USAGE.source_defaults,
            ...((body.values['source_defaults'] as Record<string, unknown> | undefined) ?? {}),
          },
        }
      : namespace === MEMORY_DEFAULTS_NAMESPACE
        ? applyMemoryDefaults({ ...current, ...body.values })
      : namespace === REFLECTION_CADENCE_NAMESPACE
        ? applyReflectionCadenceDefaults({
            ...current,
            ...body.values,
            ...(scheduleChanged && body.values['next_reflect_after'] === undefined
              ? { next_reflect_after: null }
              : {}),
          })
      : namespace === DREAM_CADENCE_NAMESPACE
        ? applyDreamCadenceDefaults({
            ...current,
            ...body.values,
            ...(scheduleChanged && body.values['next_dream_after'] === undefined
              ? { next_dream_after: null }
              : {}),
          })
      : namespace === RETRIEVAL_SETTINGS_NAMESPACE
        ? applyRetrievalSettingsDefaults(body.values)
      : body.values;
    let stored = setSettings(db, namespace, values);
    if (namespace === REFLECTION_CADENCE_NAMESPACE) stored = initializeReflectionCadence(env);
    if (namespace === DREAM_CADENCE_NAMESPACE) stored = initializeDreamCadence(env);
    if (namespace === 'pod.trust_mode') invalidateTrustModeCache();
    return { namespace, values: applyNamespaceDefaults(namespace, stored, env) };
  });

  app.delete('/pod/settings/:namespace/:key', {
    schema: {
      summary: 'Delete a single setting key',
      params: {
        type: 'object',
        properties: { namespace: { type: 'string' }, key: { type: 'string' } },
        required: ['namespace', 'key'],
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { namespace, key } = request.params as { namespace: string; key: string };
    if (!NAMESPACE_PATTERN.test(namespace)) {
      return reply.code(400).send({ error: 'invalid_namespace', message: 'namespace must match /^[a-z][a-z0-9_.]{0,63}$/' });
    }
    const removed = deleteSetting(db, namespace, key);
    if (namespace === 'pod.trust_mode') invalidateTrustModeCache();
    return { removed };
  });
}
