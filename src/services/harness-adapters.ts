import crypto from 'node:crypto';

export type HarnessProfileBoundary = 'installation' | 'native_profile' | 'deployment';
export type HarnessSetupMode = 'automatic' | 'conditional' | 'manual';

export interface HarnessAdapterDefinition {
  id: string;
  name: string;
  description: string;
  homepage: string;
  profile_boundary: HarnessProfileBoundary;
  profile_label: string;
  setup_mode: HarnessSetupMode;
  lifecycle_tools: readonly string[];
  early: true;
}

const LIFECYCLE_TOOLS = [
  'pod_session_start',
  'pod_session_checkpoint',
  'pod_session_end',
  'pod_record_experience',
] as const;

/**
 * First-party adapter cohort. These definitions describe the identity and
 * lifecycle contract Pod guarantees; transport-specific config lives in
 * agent-connection.ts.
 */
export const EARLY_HARNESS_ADAPTERS: readonly HarnessAdapterDefinition[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Task context and outcomes through Claude Code\'s HTTP MCP client.',
    homepage: 'https://docs.anthropic.com/en/docs/claude-code',
    profile_boundary: 'installation',
    profile_label: 'Installation',
    setup_mode: 'automatic',
    lifecycle_tools: LIFECYCLE_TOOLS,
    early: true,
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'Cross-task context and learning through Codex MCP.',
    homepage: 'https://developers.openai.com/codex',
    profile_boundary: 'installation',
    profile_label: 'Installation',
    setup_mode: 'automatic',
    lifecycle_tools: LIFECYCLE_TOOLS,
    early: true,
  },
  {
    id: 'hermes',
    name: 'Hermes Agent',
    description: 'One Pod identity per isolated Hermes profile.',
    homepage: 'https://hermes-agent.nousresearch.com/docs/',
    profile_boundary: 'native_profile',
    profile_label: 'Hermes profile',
    setup_mode: 'manual',
    lifecycle_tools: LIFECYCLE_TOOLS,
    early: true,
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    description: 'One Pod identity per OpenClaw state profile, shared by its routed agents.',
    homepage: 'https://docs.openclaw.ai/',
    profile_boundary: 'native_profile',
    profile_label: 'OpenClaw profile',
    setup_mode: 'automatic',
    lifecycle_tools: LIFECYCLE_TOOLS,
    early: true,
  },
  {
    id: 'kimi-code',
    name: 'Kimi Code',
    description: 'Cross-task context and learning through Kimi Code CLI MCP.',
    homepage: 'https://www.kimi.com/code/docs/en/kimi-code-cli/',
    profile_boundary: 'installation',
    profile_label: 'Installation',
    setup_mode: 'automatic',
    lifecycle_tools: LIFECYCLE_TOOLS,
    early: true,
  },
  {
    id: 'deerflow',
    name: 'DeerFlow',
    description: 'One Pod identity per DeerFlow deployment and extensions config.',
    homepage: 'https://deerflow.tech/en/docs',
    profile_boundary: 'deployment',
    profile_label: 'DeerFlow deployment',
    setup_mode: 'conditional',
    lifecycle_tools: LIFECYCLE_TOOLS,
    early: true,
  },
] as const;

export function getHarnessAdapter(id: string): HarnessAdapterDefinition | null {
  return EARLY_HARNESS_ADAPTERS.find(adapter => adapter.id === id) ?? null;
}

export function normalizeHarnessProfileId(value: string): string {
  return value.trim().toLowerCase();
}

export function validateHarnessProfileId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeHarnessProfileId(value);
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(normalized)) return null;
  return normalized;
}

/** Stable, readable actor identity with a digest to prevent slug collisions. */
export function harnessProfileActorId(harnessId: string, profileId: string): string {
  const adapter = getHarnessAdapter(harnessId);
  const normalized = validateHarnessProfileId(profileId);
  if (!adapter || !normalized) throw new Error('Unknown harness or invalid profile id.');
  const slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36) || 'profile';
  const digest = crypto.createHash('sha256').update(`${adapter.id}\u0000${normalized}`).digest('hex').slice(0, 8);
  return `agent:${adapter.id}:${slug}-${digest}`;
}

export interface HarnessProfileMetadata {
  harness_id: string;
  harness_profile_id: string;
  harness_profile_label: string;
  adapter_contract: 'v1';
}

export function readHarnessProfileMetadata(value: unknown): HarnessProfileMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const metadata = value as Record<string, unknown>;
  const harnessId = typeof metadata.harness_id === 'string' ? metadata.harness_id : '';
  const profileId = validateHarnessProfileId(metadata.harness_profile_id);
  if (!getHarnessAdapter(harnessId) || !profileId) return null;
  return {
    harness_id: harnessId,
    harness_profile_id: profileId,
    harness_profile_label: typeof metadata.harness_profile_label === 'string' && metadata.harness_profile_label.trim()
      ? metadata.harness_profile_label.trim()
      : profileId,
    adapter_contract: 'v1',
  };
}
