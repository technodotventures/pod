import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  listConnectionGrants,
  type ConnectionGrantRow,
} from '@technodotventures/smartware-connectors';

import type { CoffeePodEnv } from '../config/env.js';
import {
  listSkillBindings,
  listSkills,
  type PodAgent,
  type PodSkill,
} from '../pod/db.js';
import { agentAllowedScopeNames } from '../pod/agent-access.js';
import { readHarnessProfileMetadata } from './harness-adapters.js';
import {
  readPortableInstructionSet,
  type PortableInstructionSet,
  type PortableSkillPackage,
} from './openclaw-migration.js';

export const AGENT_PROFILE_FORMAT = 'coffee-pod-agent-profile/v1' as const;

export const AGENT_PROFILE_TARGETS = [
  'hermes',
  'codex',
  'claude-code',
  'openclaw',
  'kimi-code',
] as const;

export type AgentProfileTarget = typeof AGENT_PROFILE_TARGETS[number];

export interface AgentProfileSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  source: {
    registry: PodSkill['source'];
    slug: string | null;
  };
  permissions: string[];
  portability: PodSkill['portability'];
  trust_level: PodSkill['trust_level'];
  binding_status: 'pending' | 'active' | 'disabled';
  package?: PortableSkillPackage;
}

export interface AgentProfileConnectionGrant {
  service_id: string;
  tool_pattern: string;
  expires_at: number | null;
  status: 'active' | 'expired';
}

export interface AgentProfileManifest {
  format: typeof AGENT_PROFILE_FORMAT;
  profile: {
    id: string;
    name: string;
    description: string;
    role: PodAgent['role'];
    status: string;
    persona: string | null;
    preferred_model: string | null;
    updated_at: string;
    source_harness: ReturnType<typeof readHarnessProfileMetadata>;
  };
  instructions: PortableInstructionSet;
  runtime_preferences: Record<string, unknown>;
  context: {
    access_mode: PodAgent['access_mode'];
    read_scopes: string[];
    write_scopes: string[];
    token_budget: number | null;
  };
  capabilities: {
    skills: AgentProfileSkill[];
    connection_grants: AgentProfileConnectionGrant[];
  };
  pod_connection: {
    server_name: 'coffee-pod';
    transport: 'streamable-http';
    url: string;
    authentication: {
      type: 'bearer';
      secret_ref: string;
      environment_variable: 'COFFEE_POD_AGENT_TOKEN';
      exportable: false;
    };
  };
  compatibility: {
    targets: AgentProfileTarget[];
  };
  provenance: {
    pod_id: string;
    pod_name: string;
  };
}

export interface AgentProfileIntegrity {
  algorithm: 'sha256';
  digest: string;
}

export interface AgentProfileMaterializationFile {
  path: string;
  purpose: 'identity' | 'instructions' | 'skill' | 'mcp';
  format: 'markdown' | 'text' | 'json' | 'yaml' | 'toml';
  operation: 'write' | 'merge';
  content: string | Record<string, unknown>;
}

export interface AgentProfileMaterializationCommand {
  executable: string;
  args: string[];
  purpose: 'mcp';
}

export interface AgentProfileMaterialization {
  format: 'coffee-pod-agent-materialization/v1';
  target: AgentProfileTarget;
  profile_id: string;
  writes_state: false;
  files: AgentProfileMaterializationFile[];
  commands: AgentProfileMaterializationCommand[];
  required_secrets: Array<{
    name: 'COFFEE_POD_AGENT_TOKEN';
    secret_ref: string;
    exportable: false;
  }>;
  skill_requirements: AgentProfileSkill[];
  warnings: string[];
}

function podBaseUrl(env: CoffeePodEnv): string {
  return (process.env['COFFEE_POD_URL'] || `http://${env.host}:${env.port}`).replace(/\/+$/, '');
}

function activeConnectionGrant(grant: ConnectionGrantRow): AgentProfileConnectionGrant | null {
  if (grant.revoked_at) return null;
  return {
    service_id: grant.service_id,
    tool_pattern: grant.tool_pattern,
    expires_at: grant.expires_at,
    status: grant.expires_at !== null && grant.expires_at <= Date.now() ? 'expired' : 'active',
  };
}

function boundSkills(db: Database.Database, agent: PodAgent): AgentProfileSkill[] {
  return listSkills(db, { limit: 1000 })
    .flatMap(skill => {
      const binding = listSkillBindings(db, skill.id).find(candidate => candidate.agent_id === agent.id);
      const legacyBinding = skill.equipped_to.includes(agent.id) || skill.equipped_to.includes(agent.name);
      if (!binding && !legacyBinding) return [];
      return [{
        id: skill.id,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        source: {
          registry: skill.source,
          slug: skill.source_slug,
        },
        permissions: [...skill.permissions].sort(),
        portability: skill.portability,
        trust_level: skill.trust_level,
        binding_status: binding?.status ?? (
          skill.status === 'installed' ? 'active'
            : skill.status === 'disabled' ? 'disabled'
              : 'pending'
        ),
        ...portableSkillPackage(skill),
      } satisfies AgentProfileSkill];
    })
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

function portableSkillPackage(skill: PodSkill): Pick<AgentProfileSkill, 'package'> | Record<string, never> {
  const packageValue = skill.metadata?.['package'];
  if (!packageValue || typeof packageValue !== 'object' || Array.isArray(packageValue)) return {};
  const candidate = packageValue as Record<string, unknown>;
  if (
    candidate['format'] !== 'coffee-pod-skill-package/v1'
    || candidate['entrypoint'] !== 'SKILL.md'
    || typeof candidate['digest'] !== 'string'
    || !Array.isArray(candidate['files'])
  ) return {};
  return { package: packageValue as PortableSkillPackage };
}

export function buildAgentProfileManifest(
  db: Database.Database,
  env: CoffeePodEnv,
  agent: PodAgent,
  availableScopeNames: readonly string[],
): AgentProfileManifest {
  const connectionGrants = listConnectionGrants(db, { actor_id: agent.id })
    .map(activeConnectionGrant)
    .filter((grant): grant is AgentProfileConnectionGrant => Boolean(grant))
    .sort((left, right) =>
      left.service_id.localeCompare(right.service_id)
      || left.tool_pattern.localeCompare(right.tool_pattern));

  return {
    format: AGENT_PROFILE_FORMAT,
    profile: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      role: agent.role,
      status: agent.status,
      persona: agent.persona,
      preferred_model: agent.model,
      updated_at: agent.updated_at,
      source_harness: readHarnessProfileMetadata(agent.metadata),
    },
    instructions: readPortableInstructionSet(agent),
    runtime_preferences: {
      ...(
        agent.metadata?.['runtime_preferences']
        && typeof agent.metadata['runtime_preferences'] === 'object'
        && !Array.isArray(agent.metadata['runtime_preferences'])
          ? agent.metadata['runtime_preferences'] as Record<string, unknown>
          : {}
      ),
    },
    context: {
      access_mode: agent.access_mode,
      read_scopes: agentAllowedScopeNames(agent, 'read', availableScopeNames),
      write_scopes: agentAllowedScopeNames(agent, 'write', availableScopeNames),
      token_budget: agent.context_budget,
    },
    capabilities: {
      skills: boundSkills(db, agent),
      connection_grants: connectionGrants,
    },
    pod_connection: {
      server_name: 'coffee-pod',
      transport: 'streamable-http',
      url: `${podBaseUrl(env)}/mcp`,
      authentication: {
        type: 'bearer',
        secret_ref: `pod://secrets/agent-token/${encodeURIComponent(agent.id)}`,
        environment_variable: 'COFFEE_POD_AGENT_TOKEN',
        exportable: false,
      },
    },
    compatibility: {
      targets: [...AGENT_PROFILE_TARGETS],
    },
    provenance: {
      pod_id: env.podId,
      pod_name: env.podName,
    },
  };
}

export function agentProfileIntegrity(manifest: AgentProfileManifest): AgentProfileIntegrity {
  return {
    algorithm: 'sha256',
    digest: crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),
  };
}

function identityFile(
  path: string,
  manifest: AgentProfileManifest,
  content = manifest.profile.persona,
): AgentProfileMaterializationFile[] {
  if (!content?.trim()) return [];
  return [{
    path,
    purpose: 'identity',
    format: 'markdown',
    operation: 'write',
    content: `${content.trim()}\n`,
  }];
}

function instructionContent(
  manifest: AgentProfileManifest,
  includeAgents: boolean,
): string | null {
  const soul = manifest.instructions.slots.soul?.content?.trim()
    || manifest.profile.persona?.trim()
    || '';
  const agents = includeAgents ? manifest.instructions.slots.agents?.content?.trim() || '' : '';
  const sections = [
    ...(soul ? [soul] : []),
    ...(agents && agents !== soul ? [agents] : []),
  ];
  return sections.length > 0 ? `${sections.join('\n\n')}\n` : null;
}

function instructionFile(
  path: string,
  content: string | null | undefined,
): AgentProfileMaterializationFile[] {
  if (!content?.trim()) return [];
  return [{
    path,
    purpose: 'instructions',
    format: 'markdown',
    operation: 'write',
    content: `${content.trim()}\n`,
  }];
}

function skillPackageFiles(
  manifest: AgentProfileManifest,
  root: string,
): AgentProfileMaterializationFile[] {
  return manifest.capabilities.skills.flatMap(skill => {
    if (!skill.package) return [];
    const skillSlug = slug(skill.name);
    return skill.package.files.map(file => ({
      path: `${root}/${skillSlug}/${file.path}`,
      purpose: 'skill' as const,
      format: pathFormat(file.path),
      operation: 'write' as const,
      content: file.content,
    }));
  });
}

function pathFormat(filePath: string): AgentProfileMaterializationFile['format'] {
  const extension = filePath.split('.').pop()?.toLowerCase();
  if (extension === 'md') return 'markdown';
  if (extension === 'json') return 'json';
  if (extension === 'yaml' || extension === 'yml') return 'yaml';
  if (extension === 'toml') return 'toml';
  return 'text';
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'pod-agent';
}

function mcpHeader(): Record<string, string> {
  return { Authorization: 'Bearer ${COFFEE_POD_AGENT_TOKEN}' };
}

function commonMaterialization(
  manifest: AgentProfileManifest,
  target: AgentProfileTarget,
): Omit<AgentProfileMaterialization, 'files' | 'commands'> {
  return {
    format: 'coffee-pod-agent-materialization/v1',
    target,
    profile_id: manifest.profile.id,
    writes_state: false,
    required_secrets: [{
      name: 'COFFEE_POD_AGENT_TOKEN',
      secret_ref: manifest.pod_connection.authentication.secret_ref,
      exportable: false,
    }],
    skill_requirements: manifest.capabilities.skills,
    warnings: [
      'Preview only: review the projected files and commands before applying them.',
      ...(instructionContent(manifest, false)?.trim()
        ? []
        : ['This profile has no persona, so no native identity file is projected.']),
      ...(manifest.instructions.slots.identity
        ? ['The source IDENTITY.md is retained as a Pod semantic slot; targets without an exact equivalent do not receive it automatically.']
        : []),
      ...(manifest.capabilities.skills.some(skill => skill.package && skill.binding_status !== 'active')
        ? ['Portable skill packages are projected for review only; their Pod bindings remain inactive until approved.']
        : []),
    ],
  };
}

export function materializeAgentProfile(
  manifest: AgentProfileManifest,
  target: AgentProfileTarget,
): AgentProfileMaterialization {
  const base = commonMaterialization(manifest, target);
  const url = manifest.pod_connection.url;

  if (target === 'hermes') {
    const config: Record<string, unknown> = {
      ...(manifest.profile.preferred_model ? { model: manifest.profile.preferred_model } : {}),
      mcp_servers: {
        'coffee-pod': {
          url,
          headers: mcpHeader(),
        },
      },
    };
    return {
      ...base,
      files: [
        ...identityFile('$HERMES_HOME/SOUL.md', manifest, instructionContent(manifest, false)),
        ...instructionFile('$HERMES_HOME/AGENTS.md', manifest.instructions.slots.agents?.content),
        ...skillPackageFiles(manifest, '$HERMES_HOME/skills'),
        {
          path: '$HERMES_HOME/config.yaml',
          purpose: 'mcp',
          format: 'yaml',
          operation: 'merge',
          content: config,
        },
      ],
      commands: [],
    };
  }

  if (target === 'codex') {
    return {
      ...base,
      files: [
        ...identityFile('$CODEX_HOME/AGENTS.md', manifest, instructionContent(manifest, true)),
        ...skillPackageFiles(manifest, '$CODEX_HOME/skills'),
        {
          path: '$CODEX_HOME/config.toml',
          purpose: 'mcp',
          format: 'toml',
          operation: 'merge',
          content: [
            '[mcp_servers.coffee-pod]',
            `url = ${JSON.stringify(url)}`,
            'bearer_token_env_var = "COFFEE_POD_AGENT_TOKEN"',
            '',
          ].join('\n'),
        },
      ],
      commands: [],
    };
  }

  if (target === 'claude-code') {
    return {
      ...base,
      files: [
        ...identityFile('~/.claude/CLAUDE.md', manifest, instructionContent(manifest, true)),
        ...skillPackageFiles(manifest, '~/.claude/skills'),
      ],
      commands: [{
        executable: 'claude',
        purpose: 'mcp',
        args: [
          'mcp', 'add',
          '--transport', 'http',
          '--scope', 'user',
          '--header', 'Authorization: Bearer ${COFFEE_POD_AGENT_TOKEN}',
          'coffee-pod',
          url,
        ],
      }],
    };
  }

  if (target === 'openclaw') {
    const sourceProfile = manifest.profile.source_harness;
    const profileArgs = sourceProfile?.harness_id === 'openclaw'
      && sourceProfile.harness_profile_id !== 'default'
      ? ['--profile', sourceProfile.harness_profile_id]
      : [];
    return {
      ...base,
      files: [
        ...identityFile('$OPENCLAW_STATE_DIR/workspace/SOUL.md', manifest, instructionContent(manifest, false)),
        ...instructionFile('$OPENCLAW_STATE_DIR/workspace/AGENTS.md', manifest.instructions.slots.agents?.content),
        ...skillPackageFiles(manifest, '$OPENCLAW_STATE_DIR/workspace/skills'),
      ],
      commands: [{
        executable: 'openclaw',
        purpose: 'mcp',
        args: [
          ...profileArgs,
          'mcp', 'set', 'coffee-pod',
          JSON.stringify({
            url,
            transport: 'streamable-http',
            headers: mcpHeader(),
          }),
        ],
      }],
    };
  }

  const agentName = slug(manifest.profile.name);
  const kimiInstructions = instructionContent(manifest, true)?.trim();
  const kimiPersona = kimiInstructions
    ? [
        '---',
        `name: ${JSON.stringify(agentName)}`,
        `description: ${JSON.stringify(manifest.profile.description || `Pod profile for ${manifest.profile.name}`)}`,
        '---',
        '',
        '${base_prompt}',
        '',
        kimiInstructions,
      ].join('\n')
    : null;
  return {
    ...base,
    files: [
      ...identityFile(`$KIMI_CODE_HOME/agents/${agentName}.md`, manifest, kimiPersona),
      ...skillPackageFiles(manifest, '$KIMI_CODE_HOME/skills'),
      {
        path: '$KIMI_CODE_HOME/mcp.json',
        purpose: 'mcp',
        format: 'json',
        operation: 'merge',
        content: {
          mcpServers: {
            'coffee-pod': {
              url,
              bearerTokenEnvVar: 'COFFEE_POD_AGENT_TOKEN',
            },
          },
        },
      },
    ],
    commands: [],
  };
}

export function isAgentProfileTarget(value: unknown): value is AgentProfileTarget {
  return typeof value === 'string' && AGENT_PROFILE_TARGETS.includes(value as AgentProfileTarget);
}
