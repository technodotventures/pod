import {
  saveConfig,
  writeRegistryMarkdown,
  type Grant,
  type SmartwareCore,
} from 'smartware';
import type { CoffeePodProfile } from './data-spaces.js';

export type AgentAccessMode = 'all' | 'scoped' | 'capture_only' | 'none';
export type AgentAccessOperation = 'read' | 'write';

export interface AgentAccessRecord {
  id: string;
  status?: string | null;
  access_mode?: AgentAccessMode | null;
  scopes?: string[] | null;
}

export function isAgentAccessMode(value: unknown): value is AgentAccessMode {
  return value === 'all' || value === 'scoped' || value === 'capture_only' || value === 'none';
}

export function normaliseAgentAccessMode(value: unknown, fallback: AgentAccessMode = 'scoped'): AgentAccessMode {
  return isAgentAccessMode(value) ? value : fallback;
}

export function normaliseAgentScopeNames(scopes: string[] | null | undefined): string[] {
  if (!scopes) return [];
  return [...new Set(scopes
    .map(scope => scope.trim())
    .filter(scope => scope.length > 0 && scope.length <= 256 && /^[a-zA-Z0-9][a-zA-Z0-9:_/-]*$/.test(scope)))];
}

export function scopesForAgentStorage(
  mode: AgentAccessMode,
  scopes: string[] | null | undefined,
  fallback: string[] | null | undefined = ['personal'],
): string[] {
  if (mode === 'none' || mode === 'all') return [];
  const selected = normaliseAgentScopeNames(scopes);
  if (selected.length > 0) return selected;
  if (mode === 'capture_only') return ['workspace'];
  const previous = normaliseAgentScopeNames(fallback);
  return previous.length > 0 ? previous : ['personal'];
}

export function agentAllowedScopeNames(
  agent: AgentAccessRecord,
  operation: AgentAccessOperation,
  allScopeNames: readonly string[] = ['personal', 'workspace'],
): string[] {
  const status = agent.status ?? 'active';
  if (status !== 'active' && status !== 'live') return [];

  const mode = normaliseAgentAccessMode(agent.access_mode);
  if (mode === 'none') return [];
  if (mode === 'capture_only' && operation === 'read') return [];
  if (mode === 'all') return [...allScopeNames];

  const allowed = new Set(allScopeNames);
  return scopesForAgentStorage(mode, agent.scopes).filter(scope => allowed.has(scope));
}

export function scopeNameForResolvedScope(profile: CoffeePodProfile, resolvedScope: string): string | null {
  const entries = Object.entries(profile.scopes) as Array<[string, string]>;
  return entries.find(([name, id]) => name === resolvedScope || id === resolvedScope)?.[0] ?? null;
}

export function agentCanAccessResolvedScope(
  agent: AgentAccessRecord,
  operation: AgentAccessOperation,
  profile: CoffeePodProfile,
  resolvedScope: string,
): boolean {
  const scopeName = scopeNameForResolvedScope(profile, resolvedScope);
  if (!scopeName) return false;
  return agentAllowedScopeNames(agent, operation, Object.keys(profile.scopes)).includes(scopeName);
}

function managedGrantId(actorId: string): string {
  return `grant_agent_access_${actorId.replace(/[^a-zA-Z0-9_-]+/g, '_')}`;
}

/**
 * Keep Smartware's capability grant aligned with the user-facing agent policy.
 * This grant is deliberately deterministic so it can coexist with grants owned
 * by skills or connectors without revoking those records.
 */
export function syncAgentAccessGrant(
  core: SmartwareCore,
  profile: CoffeePodProfile,
  agent: AgentAccessRecord,
): Grant {
  const config = core.getConfig();
  const scopeNames = Object.keys(profile.scopes);
  const resolvedIds = new Set(Object.values(profile.scopes));
  const toIds = (names: string[]) => [...new Set(names
    .map(name => profile.scopes[name] ?? (resolvedIds.has(name) ? name : undefined))
    .filter((scope): scope is string => Boolean(scope)))];
  const mode = normaliseAgentAccessMode(agent.access_mode);
  const readable = mode === 'all' ? ['*'] : toIds(agentAllowedScopeNames(agent, 'read', scopeNames));
  const writable = mode === 'all' ? ['*'] : toIds(agentAllowedScopeNames(agent, 'write', scopeNames));
  const id = managedGrantId(agent.id);
  const existing = config.grants.find(grant => grant.id === id);
  const grant: Grant = {
    id,
    actor_type: 'agent',
    actor_id: agent.id,
    capabilities: {
      observe: writable,
      query: readable,
      compile: writable,
      correct: [],
      forget: [],
      read: readable,
    },
    trusted: true,
    quarantine: false,
    created_at: existing?.created_at ?? new Date().toISOString(),
    expires_at: null,
    status: 'active',
  };

  if (existing) Object.assign(existing, grant);
  else config.grants.push(grant);
  saveConfig(core.dataDir, config);
  writeRegistryMarkdown(core.dataDir, config);
  return grant;
}

export function revokeAgentAccessGrant(core: SmartwareCore, actorId: string): void {
  const config = core.getConfig();
  const grant = config.grants.find(candidate => candidate.id === managedGrantId(actorId));
  if (!grant || grant.status === 'revoked') return;
  grant.status = 'revoked';
  saveConfig(core.dataDir, config);
  writeRegistryMarkdown(core.dataDir, config);
}
