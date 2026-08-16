import type { SmartwareCore, SmartwarePodProfile } from 'smartware';

import type { CoffeePodEnv } from '../config/env.js';

const LEGACY_SCOPE_ALIASES = ['meetings', 'documents', 'tasks', 'agents'] as const;
const APP_LABELS: Record<string, string> = {
  coffee: 'Coffee',
  'google-calendar': 'Google Calendar',
  'google-drive': 'Google Drive',
  gmail: 'Email · Google',
  'icloud-mail': 'Email · iCloud',
  github: 'GitHub',
  linear: 'Linear',
  notion: 'Notion',
  slack: 'Slack',
};

export interface CoffeePodProfile extends Omit<SmartwarePodProfile, 'scopes'> {
  scopes: SmartwarePodProfile['scopes'] & Record<string, string>;
}

export interface PodDataSpace {
  /** Stable value stored on an agent policy and accepted by Pod APIs. */
  id: string;
  /** Resolved Smartware scope ID. */
  scope: string;
  label: string;
  description: string;
  owner: 'pod' | 'app' | 'legacy';
  app_id?: string;
  deprecated?: boolean;
}

function normaliseAppId(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) throw new Error('app id must include at least one letter or number');
  return slug;
}

function appScopePrefix(env: CoffeePodEnv): string {
  return `pod/${env.podId}/apps/`;
}

function appScopeKey(appId: string): string {
  return `app:${normaliseAppId(appId)}`;
}

function appScopeId(env: CoffeePodEnv, appId: string): string {
  return `${appScopePrefix(env)}${normaliseAppId(appId)}`;
}

function titleCaseSlug(slug: string): string {
  return slug.split('-').map(part => part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : '').join(' ');
}

function appLabel(appId: string): string {
  return APP_LABELS[appId] ?? titleCaseSlug(appId);
}

/**
 * Pod's compatibility view over Smartware scopes.
 *
 * New profiles contain only Pod-owned base spaces plus registered app spaces.
 * Old category aliases remain resolvable when opening an existing Pod, but
 * they are a downstream migration seam and are not part of Smartware's model.
 */
export function getPodProfile(core: SmartwareCore, env: CoffeePodEnv): CoffeePodProfile {
  const base = core.createPodProfile(env.podId, env.podName);
  const config = core.getConfig();
  const configured = new Set(config.scopes.map(scope => scope.id));
  const scopes: CoffeePodProfile['scopes'] = { ...base.scopes };

  for (const alias of LEGACY_SCOPE_ALIASES) {
    const legacyId = `pod/${env.podId}/${alias}`;
    // Existing memories retain their exact boundary. New Pods do not create
    // or advertise these aliases; API callers fall back to workspace.
    if (configured.has(legacyId)) scopes[alias] = legacyId;
  }

  const prefix = appScopePrefix(env);
  for (const entry of config.scopes) {
    if (!entry.id.startsWith(prefix)) continue;
    const appId = entry.id.slice(prefix.length);
    if (appId) scopes[appScopeKey(appId)] = entry.id;
  }

  return { ...base, scopes };
}

/** Register a source-owned memory boundary the first time an app writes. */
export function ensureAppDataSpace(core: SmartwareCore, env: CoffeePodEnv, appId: string): PodDataSpace {
  const base = core.createPodProfile(env.podId, env.podName);
  const normalised = normaliseAppId(appId);
  const scope = appScopeId(env, normalised);
  core.ensureScopes([{
    id: scope,
    parent: base.scopes.workspace,
    visibility_default: 'scope',
  }]);
  return {
    id: appScopeKey(normalised),
    scope,
    label: appLabel(normalised),
    description: `Memory saved by ${appLabel(normalised)}.`,
    owner: 'app',
    app_id: normalised,
  };
}

export function listPodDataSpaces(
  core: SmartwareCore,
  env: CoffeePodEnv,
  selectedLegacyScopes: readonly string[] = [],
): PodDataSpace[] {
  const profile = getPodProfile(core, env);
  const spaces: PodDataSpace[] = [
    {
      id: 'personal',
      scope: profile.scopes.personal,
      label: 'Private Pod memory',
      description: 'Memory you save directly to your Pod.',
      owner: 'pod',
    },
    {
      id: 'workspace',
      scope: profile.scopes.workspace,
      label: 'Shared workspace',
      description: 'Memory explicitly shared across your workspace.',
      owner: 'pod',
    },
  ];

  const prefix = appScopePrefix(env);
  for (const entry of core.getConfig().scopes) {
    if (!entry.id.startsWith(prefix)) continue;
    const appId = entry.id.slice(prefix.length);
    if (!appId) continue;
    spaces.push({
      id: appScopeKey(appId),
      scope: entry.id,
      label: appLabel(appId),
      description: `Memory saved by ${appLabel(appId)}.`,
      owner: 'app',
      app_id: appId,
    });
  }

  const selected = new Set(selectedLegacyScopes);
  for (const alias of LEGACY_SCOPE_ALIASES) {
    const legacyScope = profile.scopes[alias];
    if (!legacyScope) continue;
    let hasMemory = false;
    try {
      hasMemory = core.listActivity({ scope: legacyScope, limit: 1 }).length > 0;
    } catch { /* a selected legacy grant is still enough to keep it visible */ }
    if (!selected.has(alias) && !hasMemory) continue;
    spaces.push({
      id: alias,
      scope: legacyScope,
      label: `Earlier Pod · ${titleCaseSlug(alias)}`,
      description: 'Kept only so an existing access rule continues to work.',
      owner: 'legacy',
      deprecated: true,
    });
  }

  return spaces;
}
