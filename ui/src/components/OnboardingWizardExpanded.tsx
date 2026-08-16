import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Cloud,
  Code2,
  Copy,
  Database,
  ExternalLink,
  HardDrive,
  Info,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';

import {
  agentMcpEntry,
  installedAgentsFirst,
  manualAgentConfig,
  modelSetupSummary,
  REFLECTION_CYCLE_OPTIONS,
  reflectionCycleLabel,
  type DetectedAgent,
  type LlmAuthMethod,
  type LlmProvider,
  type ReflectionCadence,
} from '../onboarding-flow';
import './onboarding.css';

export type ExpandedStep =
  | 'welcome'
  | 'identity'
  | 'agents'
  | 'llm-provider'
  | 'rhythm'
  | 'ready';

export interface ExpandedConfig {
  display_name: string;
  llm_provider: LlmProvider;
  llm_auth_method?: LlmAuthMethod;
  llm_api_key?: string;
  llm_provider_configured?: boolean;
  reflect_cadence: ReflectionCadence;
  connected_agents?: string[];
}

export interface OnboardingWizardExpandedProps {
  onComplete: (config: ExpandedConfig) => void | Promise<void>;
  onSkip?: () => void | Promise<void>;
  fetchImpl?: typeof fetch;
  initialConfig?: Partial<ExpandedConfig>;
}

const STEPS: ExpandedStep[] = [
  'welcome',
  'identity',
  'agents',
  'llm-provider',
  'rhythm',
  'ready',
];

const STEP_META: Record<ExpandedStep, { eyebrow: string; title: string; signal: string }> = {
  welcome: { eyebrow: 'Pod by Coffee', title: 'One place for your memories to live and grow.', signal: 'Private' },
  identity: { eyebrow: 'Identity', title: 'Your memory starts with you.', signal: 'You' },
  agents: { eyebrow: 'Agents', title: 'Connect the tools you trust.', signal: 'Agents' },
  'llm-provider': { eyebrow: 'Model', title: 'Choose a model. Or don’t.', signal: 'Optional' },
  rhythm: { eyebrow: 'Rhythm', title: 'Fresh memory. Your pace.', signal: 'Rhythm' },
  ready: { eyebrow: 'Ready', title: 'Yours from here.', signal: 'Ready' },
};

const DEFAULT_CONFIG: ExpandedConfig = {
  display_name: '',
  llm_provider: 'none',
  reflect_cadence: 'every_6h',
  connected_agents: [],
};

export function OnboardingWizardExpanded({
  onComplete,
  onSkip,
  fetchImpl,
  initialConfig,
}: OnboardingWizardExpandedProps): React.ReactElement {
  const f = fetchImpl ?? fetch;
  const [step, setStep] = React.useState<ExpandedStep>('welcome');
  const [config, setConfig] = React.useState<ExpandedConfig>({ ...DEFAULT_CONFIG, ...initialConfig });
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const index = STEPS.indexOf(step);
  const meta = STEP_META[step];

  const update = (patch: Partial<ExpandedConfig>) => setConfig(current => ({ ...current, ...patch }));
  const updateConnectedAgents = React.useCallback((connectedAgents: string[]) => {
    setConfig(current => {
      const prior = current.connected_agents ?? [];
      if (prior.length === connectedAgents.length && prior.every((id, index) => id === connectedAgents[index])) return current;
      return { ...current, connected_agents: connectedAgents };
    });
  }, []);

  function goBack() {
    if (index > 0) setStep(STEPS[index - 1]!);
  }

  function goNext() {
    if (step === 'identity' && !config.display_name.trim()) return;
    if (index < STEPS.length - 1) setStep(STEPS[index + 1]!);
  }

  async function finish() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onComplete(config);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Pod could not save your setup.');
    } finally {
      setSubmitting(false);
    }
  }

  async function skipSetup() {
    if (!onSkip) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSkip();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Pod could not save that choice.');
    } finally {
      setSubmitting(false);
    }
  }

  const canContinue = step !== 'identity' || config.display_name.trim().length > 0;

  return (
    <div className="pod-onboarding-shell">
      <aside className="pod-onboarding-stage" aria-hidden="true">
        <div className="pod-onboarding-stage-copy">
          <span className="pod-onboarding-eyebrow">{meta.eyebrow}</span>
          <h1>{meta.title}</h1>
        </div>
        <MemorySignal step={step} connectedAgents={config.connected_agents?.length ?? 0} />
        <div className="pod-onboarding-privacy-note">
          <ShieldCheck size={15} />
          <span>Local-first. Every agent gets its own revocable key.</span>
        </div>
      </aside>

      <main className="pod-onboarding-panel">
        <header className="pod-onboarding-topbar">
          <div className="pod-onboarding-brand">
            <img src="/brand/pod-icon-pink.png" alt="" />
            <span>Pod <small>by Coffee</small></span>
          </div>
          <div className="pod-onboarding-progress-copy">
            <span>{index + 1} of {STEPS.length}</span>
            <strong>{meta.signal}</strong>
          </div>
        </header>

        <div className="pod-onboarding-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={index + 1}>
          {STEPS.map((item, itemIndex) => (
            <span key={item} className={itemIndex <= index ? 'is-complete' : ''} />
          ))}
        </div>

        <section className="pod-onboarding-content" key={step}>
          {step === 'welcome' && <WelcomeStep />}
          {step === 'identity' && (
            <IdentityStep value={config.display_name} onChange={value => update({ display_name: value })} />
          )}
          {step === 'agents' && (
            <AgentConnectStep
              fetchImpl={f}
              onConnected={updateConnectedAgents}
            />
          )}
          {step === 'llm-provider' && (
            <ProviderStep config={config} onUpdate={update} fetchImpl={f} />
          )}
          {step === 'rhythm' && (
            <RhythmStep value={config.reflect_cadence} onChange={value => update({ reflect_cadence: value })} />
          )}
          {step === 'ready' && <ReadyStep config={config} />}
          {submitError && (
            <div className="pod-onboarding-error" role="alert"><CircleAlert size={15} /> {submitError}</div>
          )}
        </section>

        <footer className="pod-onboarding-footer">
          {step === 'welcome' ? (
            <button className="pod-onboarding-text-button" onClick={() => void skipSetup()} disabled={!onSkip || submitting}>
              {onSkip ? 'Set up later' : ''}
            </button>
          ) : (
            <button className="pod-onboarding-text-button" onClick={goBack} disabled={submitting}>
              <ArrowLeft size={14} /> Back
            </button>
          )}
          <span />
          {step === 'ready' ? (
            <button className="pod-onboarding-primary" onClick={() => void finish()} disabled={submitting}>
              {submitting ? <><Loader2 className="spin" size={15} /> Saving setup</> : <>Open Pod <ArrowRight size={15} /></>}
            </button>
          ) : (
            <button className="pod-onboarding-primary" onClick={goNext} disabled={!canContinue || submitting}>
              {step === 'welcome' ? 'Set up my Pod' : 'Continue'}
              <ArrowRight size={15} />
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}

function MemorySignal({ step, connectedAgents }: { step: ExpandedStep; connectedAgents: number }) {
  const activeIndex = STEPS.indexOf(step);
  const nodes = [
    { label: 'Pod', sub: 'Private memory', icon: Database, activeAt: 0 },
    { label: 'You', sub: 'Identity', icon: UserRound, activeAt: 1 },
    { label: connectedAgents ? `${connectedAgents} connected` : 'Agents', sub: connectedAgents ? 'Ready to remember' : 'Revocable access', icon: Bot, activeAt: 2 },
  ];
  return (
    <div className="pod-onboarding-signal">
      <div className="pod-onboarding-signal-line"><span style={{ '--signal-step': Math.min(activeIndex, 2) } as React.CSSProperties} /></div>
      {nodes.map((node, nodeIndex) => {
        const Icon = node.icon;
        const active = activeIndex >= node.activeAt;
        return (
          <div key={node.label} className={`pod-onboarding-signal-node ${active ? 'is-active' : ''}`}>
            <span className="pod-onboarding-signal-icon"><Icon size={17} /></span>
            <span><strong>{node.label}</strong><small>{node.sub}</small></span>
            {active && <Check size={13} />}
          </div>
        );
      })}
    </div>
  );
}

function StepHeading({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <div className="pod-onboarding-heading">
      <span>{label}</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

function WelcomeStep() {
  return (
    <>
      <StepHeading
        label="Welcome to Pod"
        title="Private. Owned by you. Built to stay."
        body="Pod lives on your machine. The agents you choose can read and write through MCP. Nothing else is connected."
      />
      <div className="pod-onboarding-feature-grid">
        <article><HardDrive size={18} /><strong>Local</strong><span>Lives on this Mac.</span></article>
        <article><Bot size={18} /><strong>Bounded</strong><span>One revocable key per agent.</span></article>
        <article><Database size={18} /><strong>Yours</strong><span>Your memory stays with you.</span></article>
      </div>
    </>
  );
}

function IdentityStep({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const displayName = value.trim();
  return (
    <>
      <StepHeading
        label="Identity"
        title="What should your Pod call you?"
        body="This is the name Pod shows for you. It does not change your private owner ID, and you can edit it later."
      />
      <label className="pod-onboarding-field">
        <span>Your name</span>
        <input autoFocus value={value} onChange={event => onChange(event.target.value)} placeholder="Stevie" autoComplete="name" />
      </label>
      <div className={`pod-onboarding-actor-preview ${displayName ? 'is-valid' : ''}`}>
        <span className="pod-onboarding-actor-icon"><UserRound size={16} /></span>
        <span><small>Shown as</small><strong>{displayName || 'Your name'}</strong></span>
        {displayName && <CheckCircle2 size={16} />}
      </div>
    </>
  );
}

type AgentResult = {
  status: 'connecting' | 'connected' | 'manual' | 'error';
  message: string;
  manualConfig?: string;
};

function AgentConnectStep({ fetchImpl, onConnected }: { fetchImpl: typeof fetch; onConnected: (ids: string[]) => void }) {
  const [agents, setAgents] = React.useState<DetectedAgent[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [results, setResults] = React.useState<Record<string, AgentResult>>({});
  const [scanning, setScanning] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [showOthers, setShowOthers] = React.useState(false);

  const requestJson = React.useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetchImpl(url, init);
    const text = await response.text();
    const body = text ? JSON.parse(text) as Record<string, unknown> : {};
    if (!response.ok) throw new Error(typeof body.message === 'string' ? body.message : `${url} failed (${response.status})`);
    return body as T;
  }, [fetchImpl]);

  const scan = React.useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      const data = await requestJson<{ agents: DetectedAgent[] }>('/pod/agents/detect');
      const sorted = installedAgentsFirst(data.agents);
      setAgents(sorted);
      setSelected(new Set(sorted.filter(agent => agent.installed).map(agent => agent.agent_id)));
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Pod could not scan this machine.');
    } finally {
      setScanning(false);
    }
  }, [requestJson]);

  React.useEffect(() => { void scan(); }, [scan]);

  async function connectAgent(agent: DetectedAgent): Promise<void> {
    setResults(current => ({ ...current, [agent.agent_id]: { status: 'connecting', message: 'Creating a private connection…' } }));
    let fallbackConfig: string | undefined;
    try {
      const profileHarness = ['hermes', 'openclaw', 'deerflow'].includes(agent.agent_id);
      const registryUrl = profileHarness
        ? `/pod/harnesses/${encodeURIComponent(agent.agent_id)}/profiles`
        : '/pod/registry/agents';
      const registry = await requestJson<{ agent: { id: string } }>(registryUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...(profileHarness ? { profile_id: 'default', profile_label: 'Default' } : { id: `agent:${agent.agent_id}` }),
          name: agent.name,
          description: `Connected during Pod onboarding from ${agent.cli_path ?? agent.config_path ?? 'local detection'}.`,
          role: 'agent',
          status: 'active',
          access_mode: 'all',
          scopes: [],
          metadata: { client_id: agent.agent_id, connected_by: 'onboarding' },
        }),
      });
      const connection = await requestJson<{ connection: { pod_url: string; token: string } }>(
        `/pod/registry/agents/${encodeURIComponent(registry.agent.id)}/connection`,
      );
      const entry = agentMcpEntry(connection.connection.pod_url, connection.connection.token);
      fallbackConfig = manualAgentConfig(agent.agent_id, entry);

      if (!agent.auto_configurable) {
        setResults(current => ({
          ...current,
          [agent.agent_id]: {
            status: 'manual',
            message: 'Pod created a private key. Add this MCP entry to finish.',
            manualConfig: fallbackConfig,
          },
        }));
        return;
      }

      await requestJson('/pod/agents/apply-config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agent_id: agent.agent_id,
          ...(profileHarness ? { profile_id: 'default' } : {}),
          server_entry: entry,
        }),
      });
      setResults(current => ({
        ...current,
        [agent.agent_id]: { status: 'connected', message: 'Connected with its own private key.' },
      }));
    } catch (error) {
      setResults(current => ({
        ...current,
        [agent.agent_id]: fallbackConfig
          ? {
              status: 'manual',
              message: 'One-click setup did not finish. Add this MCP entry manually.',
              manualConfig: fallbackConfig,
            }
          : { status: 'error', message: error instanceof Error ? error.message : 'Connection failed.' },
      }));
    }
  }

  async function connectSelected() {
    const targets = agents.filter(agent => selected.has(agent.agent_id));
    if (!targets.length) return;
    setConnecting(true);
    await Promise.all(targets.map(connectAgent));
    setConnecting(false);
  }

  React.useEffect(() => {
    onConnected(Object.entries(results).filter(([, result]) => result.status === 'connected').map(([id]) => id));
  }, [onConnected, results]);

  const visibleAgents = agents.filter(agent => agent.installed || showOthers);
  const foundCount = agents.filter(agent => agent.installed).length;
  const codexSelected = selected.has('codex');

  return (
    <>
      <StepHeading
        label="Agent scan"
        title={scanning ? 'Looking for your agents…' : foundCount ? 'Let your agents remember.' : 'No local agents found.'}
        body={foundCount ? `${foundCount} found on this Mac. Choose which ones can use Pod.` : 'Connect one later from Agents. Pod works with MCP clients.'}
      />

      {scanning && (
        <div className="pod-onboarding-scan"><span className="pod-onboarding-radar"><Bot size={20} /></span><strong>Scanning apps and command-line tools</strong><small>Nothing is changed during this scan.</small></div>
      )}
      {scanError && <div className="pod-onboarding-error"><CircleAlert size={15} /> {scanError}</div>}
      {!scanning && !scanError && visibleAgents.length === 0 && (
        <div className="pod-onboarding-empty"><Code2 size={22} /><strong>Connect one later from Agents</strong><span>Codex, Claude Code, Cursor, Zed, Continue and other MCP clients are supported.</span></div>
      )}
      {!scanning && visibleAgents.length > 0 && (
        <div className="pod-onboarding-agent-list">
          {visibleAgents.map(agent => {
            const result = results[agent.agent_id];
            const isSelected = selected.has(agent.agent_id);
            return (
              <article key={agent.agent_id} className={`pod-onboarding-agent ${isSelected ? 'is-selected' : ''} ${result ? `is-${result.status}` : ''}`}>
                <button
                  className="pod-onboarding-agent-select"
                  onClick={() => setSelected(current => {
                    const next = new Set(current);
                    if (next.has(agent.agent_id)) next.delete(agent.agent_id); else next.add(agent.agent_id);
                    return next;
                  })}
                  disabled={!agent.installed || connecting}
                  aria-pressed={isSelected}
                >
                  <span className="pod-onboarding-agent-logo">{agent.agent_id === 'codex' ? <img src="/brand/apps/codex.svg" alt="" /> : <Bot size={17} />}</span>
                  <span className="pod-onboarding-agent-copy">
                    <strong>{agent.name}</strong>
                    <small>{agent.installed ? agent.agent_id === 'codex' ? 'Detected · use Pod as memory' : agent.auto_configurable ? 'Detected · one-click setup' : 'Detected · manual finish' : 'Not detected'}</small>
                  </span>
                  <span className="pod-onboarding-agent-check">{result?.status === 'connecting' ? <Loader2 className="spin" size={15} /> : result?.status === 'connected' ? <Check size={15} /> : isSelected ? <Check size={14} /> : null}</span>
                </button>
                {result && (
                  <div className="pod-onboarding-agent-result">
                    <span>{result.message}</span>
                    {result.manualConfig && <CopyConfigButton value={result.manualConfig} />}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {!scanning && codexSelected && (
        <div className="pod-onboarding-codex-memory" role="note">
          <div className="pod-onboarding-codex-memory-head">
            <span><img src="/brand/apps/codex.svg" alt="" /></span>
            <span><strong>Pod becomes Codex’s memory.</strong><small>Codex can carry useful context between tasks.</small></span>
          </div>
          <div className="pod-onboarding-memory-flow" aria-label="How Codex uses Pod">
            <span><strong>Find</strong><small>Relevant context</small></span>
            <ArrowRight size={13} />
            <span><strong>Work</strong><small>With your context</small></span>
            <ArrowRight size={13} />
            <span><strong>Save</strong><small>Durable decisions</small></span>
          </div>
          <p><ShieldCheck size={13} /> Through MCP. Revoke anytime.</p>
        </div>
      )}

      {!scanning && (
        <div className="pod-onboarding-agent-actions">
          <button className="pod-onboarding-secondary" onClick={() => void scan()} disabled={connecting}><RefreshCw size={14} /> Scan again</button>
          <button className="pod-onboarding-secondary" onClick={() => setShowOthers(value => !value)}><ChevronDown size={14} /> {showOthers ? 'Hide other clients' : 'Show other clients'}</button>
          <span />
          {selected.size > 0 && (
            <button className="pod-onboarding-connect" onClick={() => void connectSelected()} disabled={connecting}>
              {connecting ? <><Loader2 className="spin" size={14} /> Connecting</> : <><Bot size={14} /> {selected.size === 1 && codexSelected ? 'Connect Codex' : 'Connect selected'}</>}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function CopyConfigButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button onClick={async () => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      } catch { /* clipboard permission is best effort */ }
    }}>
      {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy config'}
    </button>
  );
}

type ProviderAuthView = 'choice' | 'browser' | 'device' | 'api-key' | 'connected';

function ProviderStep({ config, onUpdate, fetchImpl }: { config: ExpandedConfig; onUpdate: (patch: Partial<ExpandedConfig>) => void; fetchImpl: typeof fetch }) {
  const providers: Array<{ id: Exclude<LlmProvider, 'none'>; title: string; body: string }> = [
    { id: 'codex', title: 'Continue with ChatGPT', body: 'Use Codex access from your plan' },
    { id: 'anthropic', title: 'Anthropic API', body: 'Use an API key' },
    { id: 'openai', title: 'OpenAI API', body: 'Use an API key' },
  ];
  const [authView, setAuthView] = React.useState<ProviderAuthView>(() => {
    if (config.llm_provider_configured) return 'connected';
    return config.llm_api_key || config.llm_auth_method === 'api_key' ? 'api-key' : 'choice';
  });
  const selectedProvider = providers.find(provider => provider.id === config.llm_provider);
  const accountName = selectedProvider?.id === 'codex' ? 'ChatGPT' : selectedProvider?.title ?? '';
  const [login, setLogin] = React.useState<{ login_id: string; mode: 'browser' | 'device'; auth_url?: string; verification_url?: string; user_code?: string } | null>(null);
  const [authError, setAuthError] = React.useState<string | null>(null);

  const requestJson = React.useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetchImpl(url, init);
    const text = await response.text();
    const body = text ? JSON.parse(text) as Record<string, unknown> : {};
    if (!response.ok) throw new Error(typeof body.message === 'string' ? body.message : `${url} failed (${response.status})`);
    return body as T;
  }, [fetchImpl]);

  React.useEffect(() => {
    if (!login) return;
    const timer = window.setInterval(async () => {
      try {
        const result = await requestJson<{ state: 'pending' | 'connected' | 'failed'; message?: string }>(`/providers/codex/login/${encodeURIComponent(login.login_id)}`);
        if (result.state === 'connected') {
          window.clearInterval(timer);
          setAuthView('connected');
          setLogin(null);
          onUpdate({ llm_provider: 'codex', llm_auth_method: 'account', llm_provider_configured: true, llm_api_key: '' });
        } else if (result.state === 'failed') {
          window.clearInterval(timer);
          setAuthError(result.message ?? 'ChatGPT authorization failed.');
        }
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Could not check authorization.');
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [login, onUpdate, requestJson]);

  function selectProvider(provider: ExpandedConfig['llm_provider']) {
    if (provider === config.llm_provider) return;
    setAuthView('choice');
    onUpdate({ llm_provider: provider, llm_auth_method: undefined, llm_api_key: '', llm_provider_configured: false });
  }

  async function startCodexLogin(mode: 'browser' | 'device') {
    setAuthView(mode === 'device' ? 'device' : 'browser');
    setAuthError(null);
    onUpdate({ llm_provider: 'codex', llm_auth_method: 'account', llm_api_key: '', llm_provider_configured: false });
    try {
      const result = await requestJson<{ login_id: string; mode: 'browser' | 'device'; auth_url?: string; verification_url?: string; user_code?: string }>('/providers/codex/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      setLogin(result);
      const url = result.auth_url ?? result.verification_url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not start ChatGPT authorization.');
    }
  }

  function chooseApiKey() {
    setAuthView('api-key');
    onUpdate({ llm_auth_method: 'api_key', llm_provider_configured: false });
  }

  return (
    <>
      <StepHeading label="Model · Optional" title="Choose a model. Or don’t." body="A model helps Pod turn new activity into reusable memory. Agents work without one." />
      <div className="pod-onboarding-choice-grid pod-onboarding-provider-grid">
        {providers.map(provider => (
          <button key={provider.id} className={config.llm_provider === provider.id ? 'is-selected' : ''} onClick={() => selectProvider(provider.id)}>
            <span><Cloud size={17} /></span><strong>{provider.title}</strong><small>{provider.body}</small>{config.llm_provider === provider.id && <Check size={14} />}
          </button>
        ))}
      </div>
      <button className={`pod-onboarding-provider-skip ${config.llm_provider === 'none' ? 'is-selected' : ''}`} onClick={() => selectProvider('none')}>
        {config.llm_provider === 'none' && <Check size={13} />} Choose later
      </button>

      {selectedProvider && (
        <div className="pod-onboarding-provider-auth">
          {authView === 'choice' && (
            <>
              <div className="pod-onboarding-provider-auth-head">
                <span><strong>Connect {selectedProvider.title}</strong><small>Choose how Pod should access the model.</small></span>
              </div>
              <div className="pod-onboarding-auth-options">
                {selectedProvider.id === 'codex' && <button className="pod-onboarding-auth-option is-primary" onClick={() => void startCodexLogin('browser')}>
                  <span><UserRound size={15} /></span>
                  <span>
                    <strong>Continue with {accountName}</strong>
                    <small>Uses the Codex access included with your eligible ChatGPT plan.</small>
                  </span>
                  <ArrowRight size={14} />
                </button>}
                {selectedProvider.id !== 'codex' && <button className="pod-onboarding-auth-option" onClick={chooseApiKey}>
                  <span><KeyRound size={15} /></span>
                  <span><strong>Use an API key</strong><small>Billed by {selectedProvider.title} based on usage.</small></span>
                  <ArrowRight size={14} />
                </button>}
              </div>
            </>
          )}

          {authView === 'browser' && (
            <div className="pod-onboarding-auth-state">
              <span className="pod-onboarding-auth-state-icon"><ExternalLink size={17} /></span>
              <span className="pod-onboarding-auth-state-copy">
                <small>Browser sign-in</small>
                <strong>Finish with {accountName}.</strong>
                <span>Pod will return here automatically.</span>
              </span>
              <div className="pod-onboarding-auth-waiting"><Loader2 className="spin" size={13} /> Waiting for sign-in</div>
              <div className="pod-onboarding-auth-actions">
                <button onClick={() => void startCodexLogin('device')}>Use a code instead</button>
              </div>
            </div>
          )}

          {authView === 'device' && (
            <div className="pod-onboarding-auth-state">
              <span className="pod-onboarding-auth-state-icon"><Code2 size={17} /></span>
              <span className="pod-onboarding-auth-state-copy">
                <small>One-time code</small>
                <strong>Connect on another screen.</strong>
                <span>Open the Codex verification page, enter the code, then return to Pod.</span>
              </span>
              <div className="pod-onboarding-device-code"><span>{login?.user_code ?? 'Requesting code…'}</span><small>Codes expire quickly.</small></div>
              <div className="pod-onboarding-auth-actions">
                {login?.verification_url && <button onClick={() => window.open(login.verification_url, '_blank', 'noopener,noreferrer')}>Open verification page</button>}
                <button onClick={() => void startCodexLogin('browser')}>Back to browser sign-in</button>
              </div>
            </div>
          )}

          {authView === 'api-key' && (
            <>
              <div className="pod-onboarding-provider-auth-head">
                <span><strong>{selectedProvider.title} API key</strong><small>Billed by {selectedProvider.title} based on API usage.</small></span>
                <button onClick={() => {
                  setAuthView('choice');
                  onUpdate({ llm_auth_method: undefined, llm_api_key: '', llm_provider_configured: false });
                }}>Change</button>
              </div>
              <label className="pod-onboarding-field pod-onboarding-api-key">
                <span>API key</span>
                <input
                  type="password"
                  value={config.llm_api_key ?? ''}
                  onChange={event => onUpdate({ llm_auth_method: 'api_key', llm_api_key: event.target.value, llm_provider_configured: false })}
                  placeholder={selectedProvider.id === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
                  autoComplete="off"
                />
              </label>
              <p><ShieldCheck size={13} /> Stored locally in Pod. Never shown again.</p>
            </>
          )}

          {authError && <div className="pod-onboarding-error" role="alert"><CircleAlert size={15} /> {authError}</div>}

          {authView === 'connected' && (
            <div className="pod-onboarding-auth-connected">
              <span><CheckCircle2 size={16} /></span>
              <span><strong>{selectedProvider.title} connected</strong><small>Ready for reflection.</small></span>
              <button onClick={() => setAuthView('choice')}>Change</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function RhythmStep({ value, onChange }: { value: ReflectionCadence; onChange: (value: ReflectionCadence) => void }) {
  const [showInfo, setShowInfo] = React.useState(false);

  return (
    <>
      <StepHeading
        label="Memory rhythm"
        title="Choose how often Pod reflects."
        body="Shorter cycles keep memory fresher. When a model is connected, they can also use more tokens."
      />
      <div className="pod-onboarding-rhythm-label">
        <span>Reflection cycle</span>
        <button
          type="button"
          aria-label="More about reflection cycles and token usage"
          aria-expanded={showInfo}
          onClick={() => setShowInfo(current => !current)}
          className={showInfo ? 'is-open' : ''}
        >
          <Info size={14} />
        </button>
      </div>
      {showInfo && (
        <div className="pod-onboarding-rhythm-info" role="note">
          <strong>What happens in a cycle?</strong>
          <p>Pod groups new activity, looks for patterns, and updates reusable memory. Token use depends on how much is new and which model you choose; these labels compare the presets, not your final bill.</p>
        </div>
      )}
      <div className="pod-onboarding-cycle-grid" role="radiogroup" aria-label="Reflection cycle">
        {REFLECTION_CYCLE_OPTIONS.map(option => (
          <button
            type="button"
            role="radio"
            aria-checked={value === option.id}
            key={option.id}
            className={value === option.id ? 'is-selected' : ''}
            onClick={() => onChange(option.id)}
          >
            <span className="pod-onboarding-cycle-check">{value === option.id && <Check size={13} />}</span>
            <strong>{option.label}</strong>
            <small>{option.detail}</small>
            <em>Tokens · {option.tokenUse}</em>
          </button>
        ))}
      </div>
      <p className="pod-onboarding-rhythm-footnote">Change this anytime in Settings.</p>
    </>
  );
}

function ReadyStep({ config }: { config: ExpandedConfig }) {
  const model = modelSetupSummary(
    config.llm_provider,
    config.llm_auth_method,
    Boolean(config.llm_api_key?.trim()),
    Boolean(config.llm_provider_configured),
  );
  const agentCount = config.connected_agents?.length ?? 0;
  return (
    <>
      <StepHeading label="Ready" title={`Your Pod is ready, ${config.display_name.trim() || 'there'}.`} body={agentCount ? 'Your connected agents can use Pod through MCP. You control every key.' : 'Your memory is ready. Connect an agent whenever you want.'} />
      <div className="pod-onboarding-ready-card">
        <div><span><UserRound size={15} /> Your name</span><strong>{config.display_name.trim()}</strong></div>
        <div><span><Bot size={15} /> Agents</span><strong>{agentCount} connected</strong></div>
        <div><span><Sparkles size={15} /> Model</span><strong>{model}</strong></div>
        <div><span><RefreshCw size={15} /> Reflection</span><strong>{reflectionCycleLabel(config.reflect_cadence)}</strong></div>
      </div>
    </>
  );
}
