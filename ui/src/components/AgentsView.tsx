// Agents tab — unified registry of agents that can read from Pod.
//
// Two card sections:
//   1. Installed — named + discovered agents (live / disabled / discovered).
//                  Click a card to configure, adopt, or dismiss.
//   2. Available — known agents the user hasn't installed/connected yet.
//                  Each card carries its install command inline (copy +
//                  open npm) and a Connect button that issues a grant.
//
// Click a card → modal (edit name, model, description, status, grants).
// Discovered cards offer "Adopt" to name the actor + assign grants.

import React from 'react';
import { Bot, Cpu, User, Check, Copy, X as XIcon, ExternalLink, AlertTriangle, Eye, EyeOff, RefreshCw, Sparkles, ArrowRightLeft, RotateCcw } from 'lucide-react';
import { AppDropdown } from '../main';
import { agentMcpEntry, manualAgentConfig } from '../onboarding-flow';

// ──────────────────────────────────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  description?: string;
  role: 'agent' | 'substrate' | 'system';
  workspace_id?: string | null;
  model?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown> | null;
  auth_token?: string | null;
  discovered: boolean;
  grant_id?: string;
  source?: string;
  // Brain fields — the agent's bounded memory view, self-concept, budget.
  persona?: string | null;
  access_mode?: AgentAccessMode | null;
  scopes?: string[] | null;
  context_budget?: number | null;
  /** A catalog/new row that has not been persisted yet. */
  pending?: boolean;
}

type AgentAccessMode = 'all' | 'scoped' | 'capture_only' | 'none';

interface DataSpace {
  id: string;
  label: string;
  description: string;
  owner: 'pod' | 'app' | 'legacy';
  app_id?: string;
  deprecated?: boolean;
}

const ACCESS_PRESETS: Array<{ id: AgentAccessMode; label: string; description: string }> = [
  { id: 'all', label: 'Personal agent', description: 'Use all Pod memory, including every connected app. Best for an agent you personally run.' },
  { id: 'scoped', label: 'Selected data spaces', description: 'Use only the Pod and app spaces you choose.' },
  { id: 'capture_only', label: 'Capture only', description: 'Add memory in selected spaces, but never read it back.' },
  { id: 'none', label: 'No memory access', description: 'Connect the agent without letting it read or add memory.' },
];

interface Collection {
  id: string;
  name: string;
  parent_id?: string | null;
}

interface AgentsViewProps {
  collections: Collection[];
  authToken?: string;
}

// ──────────────────────────────────────────────────────────────────────────
//  Available-agents catalog
//
//  One row per known agent we can suggest. `install` is optional — agents
//  that are web services (n8n, Zapier) link out via `homepage` instead.
//  Move to a backend endpoint once we have one.
// ──────────────────────────────────────────────────────────────────────────

interface CatalogEntry {
  id: string;          // becomes agent_id when connected: agent:<id>
  name: string;
  description: string;
  family: 'claude' | 'openai' | 'gemini' | 'generic';
  install?: string;    // CLI install command if local
  homepage?: string;   // link out for web-based services
  profiled?: boolean;  // one Pod actor/key per native harness profile
}

const AGENT_CATALOG: CatalogEntry[] = [
  { id: 'claude-code', name: 'Claude Code',
    description: 'Anthropic agentic coding tool. MCP-native.',
    family: 'claude',
    install: 'npm install -g @anthropic-ai/claude-code' },
  { id: 'codex', name: 'Codex',
    description: 'OpenAI cloud-based coding agent.',
    family: 'openai',
    install: 'npm install -g @openai/codex' },
  { id: 'hermes', name: 'Hermes Agent',
    description: 'Growing agent with isolated profiles, now backed by shared Pod memory.',
    family: 'generic',
    profiled: true,
    homepage: 'https://hermes-agent.nousresearch.com/docs/' },
  { id: 'openclaw', name: 'OpenClaw',
    description: 'Multi-agent gateway with one Pod identity per isolated state profile.',
    family: 'generic',
    profiled: true,
    install: 'npm install -g openclaw' },
  { id: 'kimi-code', name: 'Kimi Code',
    description: 'Moonshot AI coding agent with portable agents, skills, and MCP.',
    family: 'generic',
    homepage: 'https://www.kimi.com/code/docs/en/kimi-code-cli/' },
  { id: 'deerflow', name: 'DeerFlow',
    description: 'Long-horizon agent harness with shared Pod learning per deployment.',
    family: 'generic',
    profiled: true,
    homepage: 'https://deerflow.tech/en/docs' },
  { id: 'cursor', name: 'Cursor',
    description: 'AI-first code editor.',
    family: 'generic',
    homepage: 'https://cursor.com' },
  { id: 'auggie', name: 'Auggie',
    description: 'Auggie CLI-powered autonomous coding agent.',
    family: 'generic',
    install: 'npm install -g @augmentcode/auggie' },
  { id: 'opencode', name: 'OpenCode',
    description: 'OpenCode coding agent using the ACP protocol.',
    family: 'generic',
    install: 'npm install -g opencode-ai' },
  { id: 'gemini-cli', name: 'Gemini',
    description: 'Google Gemini CLI agent using ACP.',
    family: 'gemini',
    install: 'npm install -g @google/gemini-cli' },
  { id: 'copilot-cli', name: 'Copilot',
    description: 'GitHub Copilot coding agent via ACP.',
    family: 'generic',
    install: 'npm install -g @github/copilot-cli' },
  { id: 'amp', name: 'Amp',
    description: 'Sourcegraph Amp coding agent via ACP.',
    family: 'generic',
    install: 'npm install -g amp-acp' },
  { id: 'n8n', name: 'n8n',
    description: 'Visual workflow automation and AI agents.',
    family: 'generic',
    homepage: 'https://n8n.io' },
  { id: 'zapier', name: 'Zapier',
    description: 'No-code automation across 7,000+ apps.',
    family: 'generic',
    homepage: 'https://zapier.com' },
  { id: 'langchain', name: 'LangChain',
    description: 'Framework for LLM-powered applications.',
    family: 'generic',
    install: 'pip install langchain' },
  { id: 'crewai', name: 'CrewAI',
    description: 'Multi-agent orchestration framework.',
    family: 'generic',
    install: 'pip install crewai' },
  { id: 'autogen', name: 'AutoGen',
    description: 'Microsoft multi-agent conversation framework.',
    family: 'generic',
    install: 'pip install pyautogen' },
];

// ──────────────────────────────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────────────────────────────

function authHeaders(token?: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function jget<T>(url: string, token?: string): Promise<T> {
  const r = await fetch(url, { headers: authHeaders(token) });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}
async function jpost<T>(url: string, body: unknown, token?: string): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { ...authHeaders(token), 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}
async function jdelete(url: string, token?: string): Promise<void> {
  const r = await fetch(url, { method: 'DELETE', headers: authHeaders(token) });
  if (!r.ok && r.status !== 404) throw new Error(`${url}: ${r.status}`);
}

function RoleIcon({ role, size = 14 }: { role: Agent['role']; size?: number }) {
  if (role === 'substrate') return <Cpu size={size} />;
  if (role === 'system') return <User size={size} />;
  return <Bot size={size} />;
}

function fallbackSpaceLabel(id: string): string {
  return id.replace(/^app:/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, value => value.toUpperCase());
}

function areaLabels(scopes: Iterable<string>, dataSpaces: DataSpace[] = []): string[] {
  const byId = new Map(dataSpaces.map(space => [space.id, space.label]));
  return [...scopes].map(scope => byId.get(scope) ?? fallbackSpaceLabel(scope));
}

function accessSummary(mode: AgentAccessMode, scopes: Iterable<string>, subject = 'This agent', dataSpaces: DataSpace[] = []): string {
  const labels = areaLabels(scopes, dataSpaces);
  if (mode === 'all') return `${subject} can read and add memory across your entire Pod.`;
  if (mode === 'none') return `${subject} cannot read or add Pod memory.`;
  const areas = labels.length > 0 ? labels.join(', ') : 'no selected areas';
  if (mode === 'capture_only') return `${subject} can add memory to ${areas}, but cannot read it back.`;
  return `${subject} can read and add memory in ${areas}. Everything else stays private.`;
}

function isAccessWidening(agent: Agent, mode: AgentAccessMode, scopes: Set<string>): boolean {
  const previousMode = agent.access_mode ?? 'scoped';
  const previousScopes = new Set(agent.scopes && agent.scopes.length > 0 ? agent.scopes : ['personal']);
  const readRank = (value: AgentAccessMode) => value === 'all' ? 2 : value === 'scoped' ? 1 : 0;
  const writeRank = (value: AgentAccessMode) => value === 'none' ? 0 : value === 'all' ? 2 : 1;
  if (readRank(mode) > readRank(previousMode) || writeRank(mode) > writeRank(previousMode)) return true;
  if ((mode === 'scoped' || mode === 'capture_only') && [...scopes].some(scope => !previousScopes.has(scope))) return true;
  return false;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      className={`agents-copy-btn ${copied ? 'copied' : ''}`}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch { /* ignore */ }
      }}
      title="Copy to clipboard"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Connect modal — edit named agent / adopt discovered / create new
// ──────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Live',     swatch: 'rgb(52, 211, 153)' },
  { value: 'paused',   label: 'Paused',   swatch: 'rgb(251, 191, 36)' },
  { value: 'disabled', label: 'Disabled', swatch: 'rgb(148, 163, 184)' },
];

interface ConnectionInfo {
  actor_id: string;
  agent_name: string;
  pod_url: string;
  /** The FULL token. The UI may mask it on the standalone token field but
   *  the invite blob always carries the real bytes — the agent needs them. */
  token: string;
  access_mode: AgentAccessMode;
  scopes: string[];
  capabilities: string[];
  client_id?: string | null;
  harness?: {
    harness_id: string;
    harness_profile_id: string;
    harness_profile_label: string;
    name: string;
    profile_label: string;
  } | null;
}

/** Compose the invite client-side so the user can edit the Pod URL in real
 *  time (e.g. swap localhost for a public URL when the agent runs elsewhere)
 *  without the server having to know. Drops the `env` block — that's only
 *  needed for stdio subprocess MCP transports, not HTTP. */
function composeInvite(input: { conn: ConnectionInfo; podUrl: string; dataSpaces?: DataSpace[] }): string {
  const { conn } = input;
  const policy = accessSummary(conn.access_mode, conn.scopes, 'You', input.dataSpaces);
  const clientId = conn.harness?.harness_id ?? conn.client_id ?? 'generic';
  const config = manualAgentConfig(clientId, agentMcpEntry(input.podUrl, conn.token));
  const fence = clientId === 'hermes' ? 'yaml' : clientId === 'codex' ? 'toml' : 'json';
  const profileId = conn.harness?.harness_profile_id;
  const configHint = clientId === 'hermes'
    ? profileId && profileId !== 'default'
      ? `Add this under ~/.hermes/profiles/${profileId}/config.yaml.`
      : 'Add this under ~/.hermes/config.yaml.'
    : clientId === 'openclaw'
      ? `This belongs to the OpenClaw ${profileId ?? 'default'} state profile.`
      : clientId === 'kimi-code'
        ? 'Add this under ~/.kimi-code/mcp.json.'
      : clientId === 'deerflow'
        ? 'Add this to the deployment’s extensions_config.json.'
        : null;
  return [
    `Connect ${conn.agent_name || 'this agent'} to Pod with this MCP server:`,
    '',
    `\`\`\`${fence}`,
    config,
    '```',
    ...(configHint ? ['', configHint] : []),
    '',
    `Your identity is \`${conn.actor_id}\`. You can:`,
    `  • ${policy.replace(/^You /, '')}`,
    `You may NOT call REVISE or FORGET — those are owner-only.`,
    ...(conn.capabilities.includes('recall') ? [`When asked about the owner's memories, call coffee-pod.recall first.`] : []),
    `At the start of a real task, call pod_session_start with a stable task key and goal.`,
    `At the end, call pod_session_end with the outcome and any correction, reflection, or applied lesson IDs.`,
  ].join('\n');
}

/** Heuristic: is the URL only reachable from the same machine? */
function looksLikeLocalhost(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '0.0.0.0';
  } catch {
    return false;
  }
}

interface AgentModalProps {
  agent: Agent;
  dataSpaces: DataSpace[];
  authToken?: string;
  onClose: () => void;
  onSaved: () => void;
  /** When true, jump straight to the Connect step (used by "Show invite"
   *  on an existing-agent card). Defaults to identify. */
  initialStep?: 'identify' | 'connect';
}

interface OpenClawMigrationConflict {
  id: string;
  field: string;
  current: string;
  incoming: string;
  default_resolution: 'keep';
}

interface OpenClawMigrationPlan {
  plan_digest: string;
  source: { root_label: string; workspace: string };
  target: { memory_scope: string };
  summary: {
    instructions: number;
    memories: number;
    skills: number;
    runtime_preferences: number;
    conflicts: number;
    skipped: number;
  };
  conflicts: OpenClawMigrationConflict[];
  skipped: Array<{ path: string; reason: string; detail: string }>;
}

interface AgentMigrationReceipt {
  id: string;
  applied_at: string;
  created_object_ids: string[];
  created_skill_ids: string[];
  rollback: {
    available: boolean;
    rolled_back_at: string | null;
    warnings: string[];
  };
}

function writableMigrationScopes(agent: Agent, dataSpaces: DataSpace[]): DataSpace[] {
  if (agent.access_mode === 'none') return [];
  if (agent.access_mode === 'all') return dataSpaces;
  const allowed = new Set(agent.scopes && agent.scopes.length > 0 ? agent.scopes : ['personal']);
  return dataSpaces.filter(space => allowed.has(space.id));
}

function OpenClawMigrationPanel({
  agent,
  dataSpaces,
  authToken,
  onChanged,
}: {
  agent: Agent;
  dataSpaces: DataSpace[];
  authToken?: string;
  onChanged: () => void;
}) {
  const writableScopes = writableMigrationScopes(agent, dataSpaces);
  const [sourcePath, setSourcePath] = React.useState('~/.openclaw');
  const [workspace, setWorkspace] = React.useState('');
  const [memoryScope, setMemoryScope] = React.useState(
    writableScopes.find(space => space.id === 'personal')?.id ?? writableScopes[0]?.id ?? '',
  );
  const [plan, setPlan] = React.useState<OpenClawMigrationPlan | null>(null);
  const [resolutions, setResolutions] = React.useState<Record<string, 'keep' | 'use_incoming'>>({});
  const [receipt, setReceipt] = React.useState<AgentMigrationReceipt | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await jget<{ receipts: AgentMigrationReceipt[] }>(
          `/pod/registry/agents/${encodeURIComponent(agent.id)}/migration-receipts`,
          authToken,
        );
        if (!cancelled) setReceipt(response.receipts[0] ?? null);
      } catch { /* receipts are optional history */ }
    })();
    return () => { cancelled = true; };
  }, [agent.id, authToken]);

  const preview = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await jpost<{ plan: OpenClawMigrationPlan }>(
        `/pod/registry/agents/${encodeURIComponent(agent.id)}/migrations/openclaw/preview`,
        {
          source_path: sourcePath.trim() || undefined,
          workspace: workspace.trim() || undefined,
          memory_scope: memoryScope,
        },
        authToken,
      );
      setPlan(response.plan);
      setResolutions(Object.fromEntries(
        response.plan.conflicts.map(conflict => [conflict.id, conflict.default_resolution]),
      ));
      setMessage('Preview ready. Nothing has changed yet.');
    } catch (error) {
      setPlan(null);
      setMessage(`Could not preview this OpenClaw profile: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!plan) return;
    if (!confirm('Import the reviewed OpenClaw profile into this Pod? Skills will remain blocked until you approve them.')) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await jpost<{
        receipt: AgentMigrationReceipt;
        idempotent: boolean;
        hermes_projection: { files: unknown[] };
      }>(
        `/pod/registry/agents/${encodeURIComponent(agent.id)}/migrations/openclaw/apply`,
        {
          source_path: sourcePath.trim() || undefined,
          workspace: workspace.trim() || undefined,
          memory_scope: memoryScope,
          plan_digest: plan.plan_digest,
          resolutions,
        },
        authToken,
      );
      setReceipt(response.receipt);
      setMessage(response.idempotent
        ? 'This exact migration was already applied.'
        : `Imported safely. Hermes preview contains ${response.hermes_projection.files.length} reviewed file operation${response.hermes_projection.files.length === 1 ? '' : 's'}.`);
      onChanged();
    } catch (error) {
      setMessage(`Import stopped: ${String(error)}. Preview again if the source changed.`);
    } finally {
      setBusy(false);
    }
  };

  const rollback = async () => {
    if (!receipt?.rollback.available) return;
    if (!confirm('Roll back only the Pod profile, memory, and skills created by this migration? Later unrelated edits will be preserved.')) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await jpost<{ receipt: AgentMigrationReceipt }>(
        `/pod/registry/agents/${encodeURIComponent(agent.id)}/migration-receipts/${encodeURIComponent(receipt.id)}/rollback`,
        {},
        authToken,
      );
      setReceipt(response.receipt);
      setPlan(null);
      setMessage(response.receipt.rollback.warnings.length > 0
        ? `Rollback completed with ${response.receipt.rollback.warnings.length} warning${response.receipt.rollback.warnings.length === 1 ? '' : 's'}.`
        : 'Migration rolled back. Later unrelated edits were preserved.');
      onChanged();
    } catch (error) {
      setMessage(`Rollback stopped: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="agents-migration">
      <summary>
        <ArrowRightLeft size={14} />
        <span><strong>Move from OpenClaw</strong><small>Preview → resolve conflicts → import to Pod → project to Hermes</small></span>
      </summary>
      <div className="agents-migration-body">
        <p className="agents-migration-intro">
          Pod brings over durable identity, instructions, memory, portable skill files, and the preferred model. Credentials, sessions, cookies, logs, plugins, and native databases stay behind.
        </p>
        {writableScopes.length === 0 ? (
          <div className="agents-inline-notice">
            <AlertTriangle size={14} />
            <span className="agents-inline-notice-text">Give this agent write access to a Pod data space before importing memory.</span>
          </div>
        ) : (
          <>
            <div className="agents-field-grid">
              <label className="agents-field">
                <span>OpenClaw folder</span>
                <input className="agents-input" value={sourcePath} onChange={event => setSourcePath(event.target.value)} />
              </label>
              <label className="agents-field">
                <span>Workspace (optional)</span>
                <input className="agents-input" value={workspace} onChange={event => setWorkspace(event.target.value)} placeholder="default, work, research…" />
              </label>
            </div>
            <label className="agents-field">
              <span>Save imported memory in</span>
              <select className="agents-input" value={memoryScope} onChange={event => setMemoryScope(event.target.value)}>
                {writableScopes.map(space => <option key={space.id} value={space.id}>{space.label}</option>)}
              </select>
            </label>
            <div className="agents-migration-actions">
              <button type="button" className="agents-ghost-btn" onClick={preview} disabled={busy}>
                <RefreshCw size={12} className={busy ? 'spin' : ''} /> Preview migration
              </button>
              {receipt?.rollback.available && (
                <button type="button" className="agents-ghost-btn" onClick={rollback} disabled={busy}>
                  <RotateCcw size={12} /> Roll back last import
                </button>
              )}
            </div>
          </>
        )}

        {plan && (
          <div className="agents-migration-preview">
            <div className="agents-migration-counts">
              <span><strong>{plan.summary.instructions}</strong> instructions</span>
              <span><strong>{plan.summary.memories}</strong> memories</span>
              <span><strong>{plan.summary.skills}</strong> skills</span>
              <span><strong>{plan.summary.runtime_preferences}</strong> preferences</span>
            </div>
            <p>Found <strong>{plan.source.workspace}</strong> in {plan.source.root_label}. {plan.summary.skipped} non-portable or unsafe item{plan.summary.skipped === 1 ? ' was' : 's were'} excluded.</p>
            {plan.conflicts.length > 0 && (
              <div className="agents-migration-conflicts">
                <strong>Choose what wins</strong>
                {plan.conflicts.map(conflict => (
                  <label key={conflict.id}>
                    <span>{conflict.field.replace(/^instructions\./, '').replace('profile.preferred_model', 'preferred model')}</span>
                    <select
                      className="agents-input"
                      value={resolutions[conflict.id] ?? 'keep'}
                      onChange={event => setResolutions(current => ({
                        ...current,
                        [conflict.id]: event.target.value as 'keep' | 'use_incoming',
                      }))}
                    >
                      <option value="keep">Keep current Pod value</option>
                      <option value="use_incoming">Use OpenClaw value</option>
                    </select>
                  </label>
                ))}
              </div>
            )}
            <button type="button" className="agents-save-btn" onClick={apply} disabled={busy}>Import to Pod</button>
          </div>
        )}
        {receipt && (
          <p className="agents-migration-receipt">
            Receipt {receipt.id.slice(-8)} · {receipt.created_object_ids.length} artifacts · {receipt.created_skill_ids.length} skills
            {receipt.rollback.rolled_back_at ? ' · rolled back' : ''}
          </p>
        )}
        {message && <p className="agents-migration-message" aria-live="polite">{message}</p>}
      </div>
    </details>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Connect step — invite blob + copy/rotate affordances
// ──────────────────────────────────────────────────────────────────────────

function ConnectStep({ agentId, dataSpaces, authToken, onDone }: { agentId: string; dataSpaces: DataSpace[]; authToken?: string; onDone: () => void }) {
  const [conn, setConn] = React.useState<ConnectionInfo | null>(null);
  const [reveal, setReveal] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [inviteCopied, setInviteCopied] = React.useState(false);
  const [detectedSetup, setDetectedSetup] = React.useState<{ auto_configurable: boolean; installed: boolean } | null>(null);
  const [setupMessage, setSetupMessage] = React.useState<string | null>(null);
  // Editable URL — defaults to whatever the server returned, but the user
  // can swap it (e.g. a tunneled / public URL) and the invite re-renders.
  const [urlOverride, setUrlOverride] = React.useState<string>('');

  const load = React.useCallback(async () => {
    try {
      const data = await jget<{ connection: ConnectionInfo }>(
        `/pod/registry/agents/${encodeURIComponent(agentId)}/connection`,
        authToken,
      );
      setConn(data.connection);
      setUrlOverride(data.connection.pod_url);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [agentId, authToken]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    const clientId = conn?.harness?.harness_id ?? conn?.client_id;
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await jget<{ agents: Array<{ agent_id: string; auto_configurable: boolean; installed: boolean }> }>('/pod/agents/detect', authToken);
        if (!cancelled) setDetectedSetup(data.agents.find(agent => agent.agent_id === clientId) ?? null);
      } catch { if (!cancelled) setDetectedSetup(null); }
    })();
    return () => { cancelled = true; };
  }, [authToken, conn?.client_id, conn?.harness?.harness_id]);

  const rotate = async () => {
    if (!confirm('Rotate the token? The old one will stop working immediately and any agent using it must be re-given the new invite.')) return;
    setBusy(true);
    try {
      await jpost<{ token: string }>(`/pod/registry/agents/${encodeURIComponent(agentId)}/rotate-token`, {}, authToken);
      setReveal(true); // show the fresh one
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const install = async () => {
    if (!conn) return;
    const clientId = conn.harness?.harness_id ?? conn.client_id;
    if (!clientId) return;
    setBusy(true);
    setSetupMessage(null);
    try {
      await jpost('/pod/agents/apply-config', {
        agent_id: clientId,
        profile_id: conn.harness?.harness_profile_id,
        server_entry: agentMcpEntry((urlOverride.trim() || conn.pod_url), conn.token),
      }, authToken);
      setSetupMessage(`Installed for ${conn.harness?.harness_profile_label ?? conn.agent_name}.`);
    } catch (e) {
      setSetupMessage(`One-click setup did not finish: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p>{error}</p>;
  if (!conn) return <p className="agents-empty">Loading connection…</p>;

  // Compose the invite client-side from the parts the server returned. This
  // is what makes the URL override live-edit: the JSON block updates as the
  // user types a different Pod URL.
  const effectiveUrl = urlOverride.trim() || conn.pod_url;
  const invite = composeInvite({ conn, podUrl: effectiveUrl, dataSpaces });
  const mcpConfigMatch = invite.match(/```(?:json|yaml|toml)\n([\s\S]*?)\n```/);
  const mcpConfigOnly = mcpConfigMatch ? mcpConfigMatch[1] : '';

  // Token shown in the standalone field — masked unless reveal toggle is on.
  // The invite blob ALWAYS carries the real token regardless.
  const tokenDisplay = !conn.token ? '—'
    : reveal ? conn.token
    : `${conn.token.slice(0, 16)}…${conn.token.slice(-4)}`;

  const isLocal = looksLikeLocalhost(effectiveUrl);

  return (
    <div className="agents-connect">
      <div className="agents-connect-hero">
        <span className="agents-connect-hero-icon"><Sparkles size={18} /></span>
        <div>
          <h3 className="agents-connect-title">Give this to your agent</h3>
          <p className="agents-connect-sub">Paste into a chat or add the JSON block to the agent's MCP config — both work.</p>
        </div>
      </div>

      {isLocal && (
        <div className="agents-inline-notice">
          <AlertTriangle size={14} style={{ color: 'rgb(251, 191, 36)', flex: 'none', marginTop: 1 }} />
          <span className="agents-inline-notice-text">
            <strong>Pod URL is local-only.</strong> If your agent runs on a different machine (VPS, container, laptop), <code>127.0.0.1</code> won&apos;t reach this Pod from there. Change the URL below to a publicly reachable address — the invite updates live.
          </span>
        </div>
      )}

      <div className="agents-invite-wrap">
        <pre className="agents-invite-pre">{invite}</pre>
        <button
          className={`agents-invite-copy ${inviteCopied ? 'copied' : ''}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(invite);
              setInviteCopied(true);
              setTimeout(() => setInviteCopied(false), 1800);
            } catch { /* ignore */ }
          }}
          title="Copy full invite"
        >
          {inviteCopied ? <Check size={13} /> : <Copy size={13} />}
          {inviteCopied ? 'Copied' : 'Copy invite'}
        </button>
      </div>

      <div className="agents-connect-fields">
        <div className="agents-connect-field">
          <span className="agents-connect-field-label">Actor ID</span>
          <div className="agents-connect-field-value">
            <code>{conn.actor_id}</code>
            <CopyButton text={conn.actor_id} />
          </div>
        </div>
        <div className="agents-connect-field">
          <span className="agents-connect-field-label">Pod URL</span>
          <div className="agents-connect-field-value">
            <input
              className="agents-connect-url-input"
              type="text"
              value={urlOverride}
              onChange={e => setUrlOverride(e.target.value)}
              placeholder={conn.pod_url}
              spellCheck={false}
            />
            <CopyButton text={effectiveUrl} />
          </div>
        </div>
        <div className="agents-connect-field">
          <span className="agents-connect-field-label">Token</span>
          <div className="agents-connect-field-value">
            <code className="agents-connect-token">{tokenDisplay}</code>
            <button
              type="button"
              className="agents-copy-btn"
              onClick={() => setReveal(r => !r)}
              title={reveal ? 'Hide token' : 'Reveal token'}
            >
              {reveal ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            <CopyButton text={conn.token} />
          </div>
        </div>
        <div className="agents-connect-field">
          <span className="agents-connect-field-label">MCP config only</span>
          <div className="agents-connect-field-value">
            <code className="agents-connect-truncate">{mcpConfigOnly ? mcpConfigOnly.slice(0, 60) + '…' : '—'}</code>
            <CopyButton text={mcpConfigOnly} />
          </div>
        </div>
      </div>

      {setupMessage && <p className="agents-connect-sub" aria-live="polite">{setupMessage}</p>}
      <div className="agents-connect-actions">
        {detectedSetup?.installed && detectedSetup.auto_configurable && (
          <button className="agents-save-btn" onClick={install} disabled={busy}>
            Install connection
          </button>
        )}
        <button className="agents-ghost-btn" onClick={rotate} disabled={busy}>
          <RefreshCw size={12} /> Rotate token
        </button>
        <span className="agents-modal-footer-spacer" />
        <button className="agents-save-btn" onClick={onDone}>Done</button>
      </div>
    </div>
  );
}

function AgentModal({ agent, dataSpaces, authToken, onClose, onSaved, initialStep }: AgentModalProps) {
  const [step, setStep] = React.useState<'identify' | 'connect'>(initialStep ?? 'identify');
  // After Create/Save in identify-step we want to jump to connect-step using
  // the agent id the server returned (for new agents that's derived from
  // name). Stored here so the Connect step can fetch the right row.
  const [connectAgentId, setConnectAgentId] = React.useState<string>(agent.id);
  const [name, setName] = React.useState(agent.discovered ? '' : agent.name);
  const [description, setDescription] = React.useState(agent.description ?? '');
  const [model, setModel] = React.useState(agent.model ?? '');
  const [status, setStatus] = React.useState(agent.status ?? 'active');
  const isNew = agent.pending === true;
  const harnessId = typeof agent.metadata?.harness_id === 'string' ? agent.metadata.harness_id : null;
  const harnessCatalog = harnessId ? AGENT_CATALOG.find(entry => entry.id === harnessId) : undefined;
  const initialHarnessProfile = typeof agent.metadata?.harness_profile_id === 'string'
    ? agent.metadata.harness_profile_id
    : 'default';
  const [harnessProfileId, setHarnessProfileId] = React.useState(initialHarnessProfile);
  const [accessMode, setAccessMode] = React.useState<AgentAccessMode>(
    agent.access_mode ?? (isNew ? 'all' : 'scoped'),
  );
  const [persona, setPersona] = React.useState(agent.persona ?? '');
  const [scopes, setScopes] = React.useState<Set<string>>(new Set(agent.scopes && agent.scopes.length > 0 ? agent.scopes : ['personal']));
  const [contextBudget, setContextBudget] = React.useState<number>(agent.context_budget ?? 1500);
  const toggleScope = (id: string) => setScopes(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!name.trim()) { setError('Name is required'); return; }
    if (harnessId && !harnessProfileId.trim()) { setError(`${harnessCatalog?.name ?? 'Harness'} profile is required`); return; }
    if ((accessMode === 'scoped' || accessMode === 'capture_only') && scopes.size === 0) {
      setError('Choose at least one memory area, or select No memory access.');
      return;
    }
    if (!isNew && !agent.discovered && isAccessWidening(agent, accessMode, scopes)) {
      const confirmed = confirm(`Expand ${name.trim()}'s memory access?\n\n${accessSummary(accessMode, scopes, name.trim(), dataSpaces)}`);
      if (!confirmed) return;
    }
    try {
      const target = harnessId
        ? `/pod/harnesses/${encodeURIComponent(harnessId)}/profiles`
        : '/pod/registry/agents';
      const result = await jpost<{ agent: Agent }>(target, {
        ...(harnessId
          ? { profile_id: harnessProfileId.trim(), profile_label: harnessProfileId.trim() }
          : { id: agent.id || undefined }), // preserve actor_id for adoption
        name: name.trim(),
        description: description.trim() || undefined,
        model: model.trim() || undefined,
        status,
        role: agent.role,
        persona: persona.trim() || null,
        access_mode: accessMode,
        scopes: accessMode === 'all' || accessMode === 'none' ? [] : [...scopes],
        context_budget: contextBudget,
        metadata: {
          ...(agent.metadata ?? {}),
          ...(harnessId ? { client_id: harnessId } : {}),
        },
      }, authToken);
      onSaved();
      if (isNew || agent.discovered) {
        setConnectAgentId(result.agent.id);
        setStep('connect');
      } else {
        onClose();
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const remove = async () => {
    const msg = agent.discovered
      ? `Dismiss agent "${agent.id}"? It will be removed from this list. If it contacts the Pod again, it will reappear.`
      : `Delete agent "${name || agent.id}" and revoke its token and memory access?`;
    if (!confirm(msg)) return;
    try {
      await jdelete(`/pod/registry/agents/${encodeURIComponent(agent.id)}`, authToken);
      onSaved();
      onClose();
    } catch (e) { setError(String(e)); }
  };

  // Audit trail — what this brain has read/written (populated by /pod/context).
  interface ActivityRow { id: string; action: string; detail: string; scope: string; at: string }
  const [activity, setActivity] = React.useState<ActivityRow[] | null>(null);
  React.useEffect(() => {
    if (!agent.id || agent.discovered || agent.pending) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await jget<{ activity: ActivityRow[] }>(`/pod/registry/agents/${encodeURIComponent(agent.id)}/activity?limit=12`, authToken);
        if (!cancelled) setActivity(data.activity);
      } catch { if (!cancelled) setActivity([]); }
    })();
    return () => { cancelled = true; };
  }, [agent.id, agent.discovered, authToken]);

  const headerTitle = isNew ? 'Connect agent' : agent.discovered ? 'Adopt agent' : 'Edit agent';

  return (
    <div className="agents-modal-backdrop" onClick={onClose}>
      <div className="agents-modal" onClick={e => e.stopPropagation()}>
        <header className="agents-modal-header">
          <div>
            <h2>{step === 'connect' ? `Connect ${name || agent.name || 'agent'}` : headerTitle}</h2>
            {step === 'identify' && agent.discovered && (
              <p className="agents-modal-sub">
                First seen as <code>{agent.id}</code>. Give it a friendly name and choose what memory it can use.
              </p>
            )}
            {step === 'identify' && isNew && (
              <p className="agents-modal-sub">
                Step 1 of 2 — identify the agent. Next step gives you a copy-paste invite to hand to it.
              </p>
            )}
            {step === 'connect' && (
              <p className="agents-modal-sub">
                Step 2 of 2 — paste the invite into your agent (chat or config). Token is masked by default.
              </p>
            )}
          </div>
          <button className="agents-modal-close" onClick={onClose} aria-label="Close"><XIcon size={16} /></button>
        </header>

        {step === 'connect' ? (
          <div className="agents-modal-body">
            <ConnectStep agentId={connectAgentId} dataSpaces={dataSpaces} authToken={authToken} onDone={onClose} />
          </div>
        ) : (
        <div className="agents-modal-body">
          {/* Identity */}
          <section className="agents-modal-section">
            <div className="agents-modal-section-title">Identity</div>
            {harnessId && (
              <label className="agents-field">
                <span>{harnessCatalog?.name ?? harnessId} profile</span>
                <input
                  className="agents-input"
                  value={harnessProfileId}
                  onChange={e => setHarnessProfileId(e.target.value)}
                  placeholder="default, work, research…"
                  disabled={!isNew}
                />
                <small>Each isolated profile gets its own Pod identity and revocable key.</small>
              </label>
            )}
            <label className="agents-field">
              <span>Name</span>
              <input className="agents-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Hermes" autoFocus />
            </label>
            <label className="agents-field">
              <span>Description</span>
              <input className="agents-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this agent do?" />
            </label>
            <div className="agents-field">
              <span>Status</span>
              <AppDropdown
                className="agents-status-dropdown"
                value={status}
                onChange={setStatus}
                options={STATUS_OPTIONS}
              />
            </div>
          </section>

          {/* Access is deliberately separate from behaviour: this is the
              enforceable security boundary, not a prompt preference. */}
          <section className="agents-modal-section">
            <div className="agents-modal-section-title">Memory access</div>
            <p className="agents-access-intro">Choose the closest trust level. You can change it at any time.</p>
            <div className="agents-access-presets" role="radiogroup" aria-label="Memory access level">
              {ACCESS_PRESETS.map(preset => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={accessMode === preset.id}
                  key={preset.id}
                  className={`agents-access-preset ${accessMode === preset.id ? 'selected' : ''}`}
                  onClick={() => setAccessMode(preset.id)}
                >
                  <span className="agents-access-radio" aria-hidden="true" />
                  <span>
                    <strong>{preset.label}</strong>
                    <small>{preset.description}</small>
                  </span>
                </button>
              ))}
            </div>

            {(accessMode === 'scoped' || accessMode === 'capture_only') && (
            <div className="agents-field">
              <span>Allowed data spaces</span>
              <div className="agents-area-grid">
                {dataSpaces.map(space => {
                  const on = scopes.has(space.id);
                  return (
                    <label key={space.id} className={`agents-area-option ${on ? 'selected' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleScope(space.id)} />
                      <span>
                        <strong>{space.label}{space.owner === 'app' && <em>App</em>}{space.deprecated && <em>Earlier Pod</em>}</strong>
                        <small>{space.description}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="agents-area-note">
                Each connected app gets its own boundary. Meeting, document and task are content types inside that app — not access categories.
              </p>
            </div>
            )}

            <div className={`agents-access-summary mode-${accessMode}`} aria-live="polite">
              <span className="agents-access-summary-icon">{accessMode === 'none' ? <EyeOff size={15} /> : <Eye size={15} />}</span>
              <strong>{accessSummary(accessMode, scopes, name.trim() || 'This agent', dataSpaces)}</strong>
            </div>
          </section>

          <details className="agents-behaviour">
            <summary>
              <span><strong>Behaviour</strong><small>Optional persona, model and context budget</small></span>
            </summary>
            <div className="agents-behaviour-body">
              <label className="agents-field">
                <span>Persona</span>
                <textarea
                  className="agents-input agents-textarea"
                  value={persona}
                  onChange={e => setPersona(e.target.value)}
                  placeholder="e.g. A concise research assistant that cites sources."
                  rows={3}
                />
              </label>
              <label className="agents-field">
                <span>Model</span>
                <input className="agents-input" value={model} onChange={e => setModel(e.target.value)} placeholder="claude-sonnet-4-6" />
              </label>
              <label className="agents-field">
                <span>Context budget — {contextBudget.toLocaleString()} tokens per request</span>
                <input
                  type="range" min={300} max={6000} step={100}
                  value={contextBudget}
                  onChange={e => setContextBudget(Number(e.target.value))}
                  className="agents-budget-slider"
                />
              </label>
            </div>
          </details>

          {!isNew && !agent.discovered && (
            <OpenClawMigrationPanel
              agent={agent}
              dataSpaces={dataSpaces}
              authToken={authToken}
              onChanged={onSaved}
            />
          )}

          {/* Activity — the audit trail: what this brain has read/written */}
          {!isNew && !agent.discovered && (
            <section className="agents-modal-section">
              <div className="agents-modal-section-title">Recent activity</div>
              {activity === null ? (
                <p className="agents-empty">Loading…</p>
              ) : activity.length === 0 ? (
                <p className="agents-empty">No memory activity yet. Reads and writes will appear here.</p>
              ) : (
                <ul className="agents-activity-list">
                  {activity.map(a => (
                    <li key={a.id} className="agents-activity-row">
                      <span className={`agents-activity-tag agents-activity-${a.action}`}>{a.action}</span>
                      <span className="agents-activity-detail">{a.detail || a.scope}</span>
                      <span className="agents-activity-time">{new Date(a.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {error && <p>{error}</p>}
        </div>
        )}

        {step === 'identify' && (
          <footer className="agents-modal-footer">
            {!isNew && <button className="agents-delete-btn" onClick={remove}>{agent.discovered ? 'Dismiss' : 'Delete'}</button>}
            <span className="agents-modal-footer-spacer" />
            <button className="agents-cancel-btn" onClick={onClose}>Cancel</button>
            <button className="agents-save-btn" onClick={save}>
              {agent.discovered ? 'Adopt & Connect' : isNew ? 'Create & Connect' : 'Save changes'}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  AgentsView (root) — Installed + Available, modal on click
// ──────────────────────────────────────────────────────────────────────────

export function AgentsView({ authToken }: AgentsViewProps): React.ReactElement {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [dataSpaces, setDataSpaces] = React.useState<DataSpace[]>([]);
  const [opening, setOpening] = React.useState<Agent | null>(null);
  const [openingStep, setOpeningStep] = React.useState<'identify' | 'connect'>('identify');
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const data = await jget<{ agents: Agent[]; data_spaces?: DataSpace[] }>('/pod/registry/agents', authToken);
      setAgents(data.agents);
      setDataSpaces(data.data_spaces ?? []);
      setError(null);
    } catch (e) {
      setError(`Could not load agents: ${e}`);
    }
  }, [authToken]);

  React.useEffect(() => { refresh(); }, [refresh]);

  // Detection — which agent apps are actually installed on this machine.
  // Turns the catalog from "here's a list" into "we found yours."
  const [detectedIds, setDetectedIds] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await jget<{ agents: Array<{ agent_id: string; installed: boolean }> }>('/pod/agents/detect', authToken);
        if (!cancelled) setDetectedIds(new Set(data.agents.filter(a => a.installed).map(a => a.agent_id)));
      } catch { /* detection is best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [authToken]);

  // If the registry call failed (backend restarting, transient 502), quietly
  // retry every few seconds so the UI self-heals.
  React.useEffect(() => {
    if (!error) return;
    const t = setTimeout(refresh, 4000);
    return () => clearTimeout(t);
  }, [error, refresh]);

  const openCard = (a: Agent, step: 'identify' | 'connect' = 'identify') => {
    setOpeningStep(step);
    setOpening(a);
  };

  const newAgent = () => {
    setOpeningStep('identify');
    setOpening({ id: '', name: '', role: 'agent', discovered: false, auth_token: null, access_mode: 'all', pending: true });
  };

  // Available = catalog entries not already installed (by id match or name match)
  const installedIds = React.useMemo(
    () => new Set(agents.map(a => a.id.toLowerCase())),
    [agents],
  );
  const installedNames = React.useMemo(
    () => new Set(agents.map(a => a.name.toLowerCase())),
    [agents],
  );
  const available = AGENT_CATALOG.filter(c => {
    const fullId = `agent:${c.id}`.toLowerCase();
    return !installedIds.has(fullId) && !installedNames.has(c.name.toLowerCase());
  }).sort((a, b) => {
    // Detected agents float to the top — "we found yours" before "here's a list."
    const ad = detectedIds.has(a.id) ? 0 : 1;
    const bd = detectedIds.has(b.id) ? 0 : 1;
    return ad - bd;
  });
  const detectedCount = available.filter(c => detectedIds.has(c.id)).length;

  const connectFromCatalog = async (c: CatalogEntry) => {
    // Pre-fill the modal with the catalog entry. Saves → creates a named
    // agent with id agent:<catalog.id> so future MCP calls resolve.
    setOpeningStep('identify');
    setOpening({
      id: `agent:${c.id}`,
      name: c.name,
      role: 'agent',
      description: c.description,
      model: c.family === 'claude' ? 'claude-sonnet-4-6' : c.family === 'openai' ? 'gpt-4o' : c.family === 'gemini' ? 'gemini-1.5-pro' : '',
      status: 'active',
      discovered: false,
      access_mode: 'all',
      metadata: {
        client_id: c.id,
        ...(c.profiled ? {
          harness_id: c.id,
          harness_profile_id: 'default',
          harness_profile_label: 'Default',
          adapter_contract: 'v1',
        } : {}),
      },
      pending: true,
    });
  };

  const addHarnessProfile = (agent: Agent) => {
    const harnessId = typeof agent.metadata?.harness_id === 'string' ? agent.metadata.harness_id : null;
    const catalog = harnessId ? AGENT_CATALOG.find(entry => entry.id === harnessId) : undefined;
    if (!harnessId || !catalog) return;
    setOpeningStep('identify');
    setOpening({
      id: '',
      name: `${catalog.name} profile`,
      description: catalog.description,
      role: 'agent',
      status: 'active',
      discovered: false,
      access_mode: agent.access_mode ?? 'all',
      scopes: agent.scopes ?? [],
      pending: true,
      metadata: {
        client_id: harnessId,
        harness_id: harnessId,
        harness_profile_id: '',
        harness_profile_label: '',
        adapter_contract: 'v1',
      },
    });
  };

  return (
    <div className="agents-tab">
      {/* ───── Installed ───── */}
      <div className="agents-section">
        <div className="agents-section-row">
          <div>
            <h2 className="agents-section-title">Installed</h2>
            <p className="agents-section-sub">Agents that have access to, or are requesting access to this Pod.</p>
          </div>
          <button className="agents-primary-btn" onClick={newAgent}>+ Connect agent</button>
        </div>
        {error && (
          <div className="agents-inline-notice">
            <AlertTriangle size={14} style={{ color: 'rgb(251, 191, 36)', flex: 'none', marginTop: 1 }} />
            <span className="agents-inline-notice-text">
              Couldn't reach the registry — the backend may be restarting. Retrying automatically.
            </span>
          </div>
        )}
        {agents.length === 0 && !error && (
          <div className="agents-empty-state">
            <div className="agents-empty-icon"><Bot size={20} /></div>
            <p className="agents-empty-title">No agents connected</p>
            <p className="agents-empty-desc">
              Connect a named agent above, or pick one from Available below to get started.
            </p>
          </div>
        )}
        <div className="agents-card-grid">
          {agents.map(a => {
            const harnessProfile = typeof a.metadata?.harness_profile_id === 'string'
              ? a.metadata.harness_profile_id
              : null;
            const statusLabel = a.discovered
              ? 'Discovered'
              : (a.status === 'active' || !a.status) ? 'Live'
              : a.status === 'paused' ? 'Paused' : 'Disabled';
            const statusClass = a.discovered ? 'discovered' : (a.status === 'active' || !a.status) ? 'live' : a.status;
            return (
              <div key={a.id} className={`agents-card ${a.discovered ? 'discovered' : ''}`} role="button" tabIndex={0}>
                <div className="agents-card-head">
                  <span className={`agents-card-icon role-${a.role}`}><RoleIcon role={a.role} size={16} /></span>
                  <strong className="agents-card-name">{a.name || a.id}</strong>
                  <span className={`agents-card-status status-${statusClass}`}>{statusLabel}</span>
                </div>
                <div className="agents-card-meta">
                  {a.model && <span className="agents-card-model">{a.model}</span>}
                  {harnessProfile && <span className="agents-card-model">Profile · {harnessProfile}</span>}
                  {!a.discovered && (
                    <span className="agents-card-grants">
                      {a.access_mode === 'all'
                        ? 'All memory'
                        : a.access_mode === 'capture_only'
                          ? 'Capture only'
                          : a.access_mode === 'none'
                            ? 'No memory'
                            : `${areaLabels(a.scopes ?? ['personal'], dataSpaces).join(', ') || 'No data spaces'}`}
                    </span>
                  )}
                </div>
                {a.description && <div className="agents-card-desc">{a.description}</div>}
                <div className="agents-card-actions">
                  {a.discovered ? (
                    <>
                      <button className="agents-card-action-btn primary" onClick={() => openCard(a, 'identify')}>Adopt</button>
                      <button className="agents-card-action-btn ghost" onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Dismiss "${a.name || a.id}"? It will reappear if it contacts the Pod again.`)) return;
                        try {
                          await jdelete(`/pod/registry/agents/${encodeURIComponent(a.id)}`, authToken);
                          refresh();
                        } catch { /* ignore */ }
                      }}>Dismiss</button>
                    </>
                  ) : (
                    <>
                      {harnessProfile && (
                        <button className="agents-card-action-btn ghost" onClick={() => addHarnessProfile(a)}>+ Profile</button>
                      )}
                      <button className="agents-card-action-btn primary" onClick={() => openCard(a, 'identify')}>Manage</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ───── Available ───── */}
      <div className="agents-section">
        <div className="agents-section-row">
          <div>
            <h2 className="agents-section-title">Available</h2>
            <p className="agents-section-sub">
              {detectedCount > 0
                ? `Found ${detectedCount} agent${detectedCount === 1 ? '' : 's'} installed on this machine — connect ${detectedCount === 1 ? 'it' : 'them'} in one click.`
                : 'Known agents you can connect. Copy the install command, run it locally, then click Connect.'}
            </p>
          </div>
        </div>
        <div className="agents-card-grid">
          {available.map(c => {
            const detected = detectedIds.has(c.id);
            return (
            <div key={c.id} className={`agents-card agents-card-catalog${detected ? ' detected' : ''}`}>
              <div className="agents-card-head">
                <span className={`agents-card-icon family-${c.family}`}><Bot size={16} /></span>
                <strong className="agents-card-name">{c.name}</strong>
                {detected && <span className="agents-detected-badge"><Check size={11} /> Detected</span>}
              </div>
              <div className="agents-card-desc">{c.description}</div>
              <div className="agents-card-footer">
                {c.install ? (
                  <div className="agents-card-install">
                    <code className="agents-card-cmd">{c.install}</code>
                    <CopyButton text={c.install} />
                  </div>
                ) : c.homepage ? (
                  <a className="agents-card-install-link" href={c.homepage} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={12} /> Visit {new URL(c.homepage).hostname.replace('www.', '')}
                  </a>
                ) : <span className="agents-card-spacer" />}
                <button className="agents-card-connect-btn" onClick={() => connectFromCatalog(c)}>
                  {detected ? 'Connect' : 'Connect'}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {opening && (
        <AgentModal
          agent={opening}
          dataSpaces={dataSpaces}
          authToken={authToken}
          onClose={() => setOpening(null)}
          onSaved={refresh}
          initialStep={openingStep}
        />
      )}
    </div>
  );
}
