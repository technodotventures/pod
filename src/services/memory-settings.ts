import { getSettings, type getDb } from '../pod/db.js';

export const MEMORY_DEFAULTS_NAMESPACE = 'pod.memory_defaults';
export const MEMORY_VISIBILITY_VALUES = ['private', 'scope', 'workspace', 'public'] as const;

export type MemoryVisibility = typeof MEMORY_VISIBILITY_VALUES[number];

export interface MemoryDefaults extends Record<string, unknown> {
  default_visibility: MemoryVisibility;
  default_sensitive: boolean;
  default_use_llm: boolean;
}

export const DEFAULT_MEMORY_DEFAULTS: MemoryDefaults = {
  default_visibility: 'scope',
  default_sensitive: false,
  default_use_llm: false,
};

export function applyMemoryDefaults(values: Record<string, unknown>): MemoryDefaults {
  return {
    default_visibility: MEMORY_VISIBILITY_VALUES.includes(values['default_visibility'] as MemoryVisibility)
      ? values['default_visibility'] as MemoryVisibility
      : DEFAULT_MEMORY_DEFAULTS.default_visibility,
    default_sensitive: typeof values['default_sensitive'] === 'boolean'
      ? values['default_sensitive']
      : DEFAULT_MEMORY_DEFAULTS.default_sensitive,
    default_use_llm: typeof values['default_use_llm'] === 'boolean'
      ? values['default_use_llm']
      : DEFAULT_MEMORY_DEFAULTS.default_use_llm,
  };
}

export function validateMemoryDefaults(values: Record<string, unknown>): string | null {
  const visibility = values['default_visibility'];
  if (visibility !== undefined
    && !(typeof visibility === 'string' && MEMORY_VISIBILITY_VALUES.includes(visibility as MemoryVisibility))) {
    return `pod.memory_defaults.default_visibility must be one of ${MEMORY_VISIBILITY_VALUES.join(', ')}`;
  }
  for (const key of ['default_sensitive', 'default_use_llm'] as const) {
    const value = values[key];
    if (value !== undefined && typeof value !== 'boolean') {
      return `pod.memory_defaults.${key} must be a boolean`;
    }
  }
  return null;
}

export function readMemoryDefaults(db: ReturnType<typeof getDb>): MemoryDefaults {
  return applyMemoryDefaults(getSettings(db, MEMORY_DEFAULTS_NAMESPACE));
}

export function resolveObservationDefaults(
  db: ReturnType<typeof getDb>,
  values: { visibility?: MemoryVisibility; sensitive?: boolean },
): { visibility: MemoryVisibility; sensitive: boolean } {
  const defaults = readMemoryDefaults(db);
  return {
    visibility: values.visibility ?? defaults.default_visibility,
    sensitive: values.sensitive ?? defaults.default_sensitive,
  };
}

export function resolveReflectionModelUse(
  db: ReturnType<typeof getDb>,
  explicit?: boolean,
): boolean {
  return explicit ?? readMemoryDefaults(db).default_use_llm;
}
