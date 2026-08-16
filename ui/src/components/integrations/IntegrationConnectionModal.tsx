/**
 * Generic integration connection modal.
 * Provides a 4-step wizard: Data sources → Filters → Cadence → Scope routing
 * Works for GitHub, Slack, Gmail, Notion, Linear.
 */

import * as React from 'react';
import { ConnectionWizard, type WizardStep } from './ConnectionWizard';
import { ServiceLogo } from './ServiceLogo';
import { postJson } from './api';
import {
  type Cadence,
  type ScopeRouting,
  type GitHubFilters,
  type GitLabFilters,
  type SlackFilters,
  type GmailFilters,
  type GmailSignalConfig,
  type NotionFilters,
  type LinearFilters,
  DEFAULT_GITHUB_FILTERS,
  DEFAULT_GITLAB_FILTERS,
  DEFAULT_SLACK_FILTERS,
  DEFAULT_GMAIL_FILTERS,
  DEFAULT_GMAIL_SIGNAL_CONFIG,
  DEFAULT_NOTION_FILTERS,
  DEFAULT_LINEAR_FILTERS,
  DEFAULT_CADENCE_GITHUB,
  DEFAULT_CADENCE_GITLAB,
  DEFAULT_CADENCE_SLACK,
  DEFAULT_CADENCE_GMAIL,
  DEFAULT_CADENCE_NOTION,
  DEFAULT_CADENCE_LINEAR,
  DEFAULT_SCOPE_ROUTING,
} from './types';

type IntegrationId = 'github' | 'gitlab' | 'slack' | 'gmail' | 'notion' | 'linear';

interface WizardState {
  filters: Record<string, unknown>;
  cadence: Cadence;
  scope_routing: ScopeRouting;
  signal_config?: GmailSignalConfig;
}

interface Props {
  token: string;
  integrationId: IntegrationId;
  open: boolean;
  onClose: () => void;
  onCommitted: () => void;
}

const INTEGRATION_META: Record<IntegrationId, {
  title: string;
  subtitle: string;
  defaultFilters: Record<string, unknown>;
  defaultCadence: Cadence;
  filterFields: Array<{ key: string; label: string; type: 'toggle' | 'multi' | 'select'; options?: string[]; warning?: string }>;
}> = {
  github: {
    title: 'Configure GitHub',
    subtitle: 'Choose what to observe from your repositories',
    defaultFilters: DEFAULT_GITHUB_FILTERS as unknown as Record<string, unknown>,
    defaultCadence: DEFAULT_CADENCE_GITHUB,
    filterFields: [
      { key: 'event_types', label: 'Event types', type: 'multi', options: ['push', 'pull_request', 'issues', 'release', 'review', 'discussion'] },
      { key: 'exclude_bots', label: 'Exclude bot events', type: 'toggle' },
      { key: 'exclude_draft_prs', label: 'Exclude draft PRs', type: 'toggle' },
    ],
  },
  gitlab: {
    title: 'Configure GitLab',
    subtitle: 'Choose what to observe from your GitLab projects',
    defaultFilters: DEFAULT_GITLAB_FILTERS as unknown as Record<string, unknown>,
    defaultCadence: DEFAULT_CADENCE_GITLAB,
    filterFields: [
      { key: 'event_types', label: 'Event types', type: 'multi', options: ['push', 'merge_request', 'issue', 'pipeline', 'release', 'note'] },
      { key: 'exclude_bots', label: 'Exclude bot events', type: 'toggle' },
      { key: 'exclude_draft_mrs', label: 'Exclude draft merge requests', type: 'toggle' },
      { key: 'include_ci_jobs', label: 'Include CI/CD job logs', type: 'toggle' },
    ],
  },
  slack: {
    title: 'Configure Slack',
    subtitle: 'Choose channels and message types to observe',
    defaultFilters: DEFAULT_SLACK_FILTERS as unknown as Record<string, unknown>,
    defaultCadence: DEFAULT_CADENCE_SLACK,
    filterFields: [
      { key: 'capture', label: 'Capture', type: 'multi', options: ['messages', 'threads', 'reactions', 'files', 'pins'], warning: 'Files: only text content is extracted from safe file types (pdf, docx, txt, csv, md). Executables and archives are rejected. Max 10 MB per file.' },
      { key: 'exclude_bots', label: 'Exclude bot messages', type: 'toggle' },
      { key: 'channels', label: 'Channels', type: 'select', options: ['all_public', 'selected'] },
    ],
  },
  gmail: {
    title: 'Configure Email',
    subtitle: 'Choose what email content to observe',
    defaultFilters: DEFAULT_GMAIL_FILTERS as unknown as Record<string, unknown>,
    defaultCadence: DEFAULT_CADENCE_GMAIL,
    filterFields: [
      { key: 'labels', label: 'Labels', type: 'select', options: ['inbox', 'all', 'selected'] },
      { key: 'capture', label: 'Capture', type: 'multi', options: ['subject', 'body', 'attachments', 'metadata'], warning: 'Attachments: only text is extracted from safe file types (pdf, docx, txt, csv, md). Executables, archives, and files over 10 MB are rejected. Content is quarantined if it contains detected secrets.' },
      { key: 'exclude_promotions', label: 'Exclude promotions', type: 'toggle' },
      { key: 'exclude_social', label: 'Exclude social', type: 'toggle' },
    ],
  },
  notion: {
    title: 'Configure Notion',
    subtitle: 'Choose pages and databases to observe',
    defaultFilters: DEFAULT_NOTION_FILTERS as unknown as Record<string, unknown>,
    defaultCadence: DEFAULT_CADENCE_NOTION,
    filterFields: [
      { key: 'content_types', label: 'Content types', type: 'multi', options: ['page', 'database', 'block'] },
      { key: 'ingestion_depth', label: 'Ingestion depth', type: 'select', options: ['full', 'summaries', 'titles_only'] },
      { key: 'include_comments', label: 'Include comments', type: 'toggle' },
    ],
  },
  linear: {
    title: 'Configure Linear',
    subtitle: 'Choose teams and issue types to observe',
    defaultFilters: DEFAULT_LINEAR_FILTERS as unknown as Record<string, unknown>,
    defaultCadence: DEFAULT_CADENCE_LINEAR,
    filterFields: [
      { key: 'issue_states', label: 'Issue states', type: 'multi', options: ['backlog', 'todo', 'in_progress', 'done', 'cancelled'] },
      { key: 'include_comments', label: 'Include comments', type: 'toggle' },
      { key: 'include_attachments', label: 'Include attachments', type: 'toggle', warning: 'Only text extracted from safe file types (pdf, docx, txt, csv, md). Max 10 MB.' },
      { key: 'projects', label: 'Projects', type: 'select', options: ['all', 'active_only'] },
    ],
  },
};

function FilterStep({ meta, state, setState }: {
  meta: typeof INTEGRATION_META[IntegrationId];
  state: WizardState;
  setState: (patch: Partial<WizardState> | ((prev: WizardState) => WizardState)) => void;
}) {
  const filters = state.filters;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {meta.filterFields.map(field => {
        const showWarning = field.warning && (
          field.type === 'toggle' ? !!filters[field.key] :
          field.type === 'multi' ? ((filters[field.key] as string[]) ?? []).some(v => v === 'attachments' || v === 'files') :
          false
        );
        if (field.type === 'toggle') {
          return (
            <div key={field.key}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!filters[field.key]}
                  onChange={(e) => setState({ filters: { ...filters, [field.key]: e.target.checked } })}
                />
                {field.label}
              </label>
              {showWarning && (
                <div style={{ marginTop: 4, marginLeft: 24, padding: '6px 10px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: 6, fontSize: '0.8em', color: '#eab308', lineHeight: 1.4 }}>
                  ⚠️ {field.warning}
                </div>
              )}
            </div>
          );
        }
        if (field.type === 'select' && field.options) {
          return (
            <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontWeight: 500, fontSize: '0.9em' }}>{field.label}</span>
              <select
                value={String(filters[field.key] ?? field.options[0])}
                onChange={(e) => setState({ filters: { ...filters, [field.key]: e.target.value } })}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #333)' }}
              >
                {field.options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
          );
        }
        if (field.type === 'multi' && field.options) {
          const selected = (filters[field.key] as string[]) ?? [];
          return (
            <div key={field.key}>
              <span style={{ fontWeight: 500, fontSize: '0.9em' }}>{field.label}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {field.options.map(o => {
                  const active = selected.includes(o);
                  return (
                    <button
                      key={o}
                      onClick={() => {
                        const next = active ? selected.filter(s => s !== o) : [...selected, o];
                        setState({ filters: { ...filters, [field.key]: next } });
                      }}
                      style={{
                        padding: '4px 10px', borderRadius: 12, fontSize: '0.85em',
                        border: '1px solid var(--border, #444)',
                        background: active ? 'var(--accent, #2563eb)' : 'transparent',
                        color: active ? 'white' : 'inherit', cursor: 'pointer',
                      }}
                    >
                      {o.replace(/_/g, ' ')}
                    </button>
                  );
                })}
              </div>
              {showWarning && (
                <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: 6, fontSize: '0.8em', color: '#eab308', lineHeight: 1.4 }}>
                  ⚠️ {field.warning}
                </div>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function CadenceStep({ state, setState }: {
  state: WizardState;
  setState: (patch: Partial<WizardState> | ((prev: WizardState) => WizardState)) => void;
}) {
  const modes: Cadence['mode'][] = ['webhook', 'poll_5m', 'poll_hour', 'manual'];
  const labels: Record<string, string> = {
    webhook: 'Real-time (webhook)',
    poll_5m: 'Every 5 minutes',
    poll_hour: 'Every hour',
    manual: 'Manual only',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontWeight: 500 }}>Sync cadence</span>
      {modes.map(m => (
        <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="radio"
            name="cadence"
            checked={state.cadence.mode === m}
            onChange={() => setState({ cadence: { ...state.cadence, mode: m } })}
          />
          {labels[m]}
        </label>
      ))}
    </div>
  );
}

function ScopeStep({ state, setState }: {
  state: WizardState;
  setState: (patch: Partial<WizardState> | ((prev: WizardState) => WizardState)) => void;
}) {
  const modes: ScopeRouting['mode'][] = ['auto_detect', 'all_self', 'all_project', 'per_source'];
  const labels: Record<string, string> = {
    auto_detect: 'Auto-detect (recommended)',
    all_self: 'Route all to Personal',
    all_project: 'Route all to a project scope',
    per_source: 'Per-source routing rules',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontWeight: 500 }}>Scope routing</span>
      {modes.map(m => (
        <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="radio"
            name="scope"
            checked={state.scope_routing.mode === m}
            onChange={() => setState({ scope_routing: { ...state.scope_routing, mode: m } })}
          />
          {labels[m]}
        </label>
      ))}
    </div>
  );
}

/* ── Signal priority step (email) ── */

const TIER_LEGEND: Array<{ tier: string; color: string; label: string; desc: string }> = [
  { tier: 'high', color: '#22c55e', label: 'High', desc: 'Full body stored, LLM summary generated, entities extracted' },
  { tier: 'medium', color: '#eab308', label: 'Medium', desc: 'Metadata + first 500 chars stored, no LLM cost' },
  { tier: 'low', color: '#6b7280', label: 'Low', desc: 'Metadata only (sender, subject, date) — body discarded' },
];

const AUTO_RULES = [
  { label: 'Known contacts', effect: 'boosted', icon: '👤' },
  { label: 'Direct to you (To: vs CC:)', effect: 'boosted', icon: '📬' },
  { label: 'Starred / Important', effect: 'boosted', icon: '⭐' },
  { label: 'Active threads (3+ messages)', effect: 'boosted', icon: '🧵' },
  { label: 'Newsletters (List-Unsubscribe)', effect: 'lowered', icon: '📰' },
  { label: 'No-reply / automated senders', effect: 'lowered', icon: '🤖' },
  { label: 'Marketing subjects', effect: 'lowered', icon: '📢' },
  { label: 'Spam / Trash labels', effect: 'lowered', icon: '🗑' },
];

function SignalPriorityStep({ state, setState }: {
  state: WizardState;
  setState: (patch: Partial<WizardState> | ((prev: WizardState) => WizardState)) => void;
}) {
  const cfg = state.signal_config ?? DEFAULT_GMAIL_SIGNAL_CONFIG;
  const updateCfg = (patch: Partial<GmailSignalConfig>) =>
    setState({ signal_config: { ...cfg, ...patch } });

  const [vipInput, setVipInput] = React.useState('');
  const [muteInput, setMuteInput] = React.useState('');
  const [muteKwInput, setMuteKwInput] = React.useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Tier legend */}
      <div>
        <span style={{ fontWeight: 600, fontSize: '0.95em' }}>How signal classification works</span>
        <p style={{ fontSize: '0.82em', color: 'var(--muted-foreground, #999)', margin: '4px 0 10px' }}>
          Every email is scored and assigned a tier. Higher tiers get richer storage and LLM processing. Lower tiers save tokens and reduce noise.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {TIER_LEGEND.map(t => (
            <div key={t.tier} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--muted, #1a1a1a)', borderRadius: 8, borderLeft: `3px solid ${t.color}` }}>
              <span style={{ fontWeight: 600, fontSize: '0.85em', color: t.color, minWidth: 56 }}>{t.label}</span>
              <span style={{ fontSize: '0.82em', color: 'var(--muted-foreground, #aaa)' }}>{t.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Auto rules summary */}
      <div>
        <span style={{ fontWeight: 600, fontSize: '0.95em' }}>Auto-classification rules</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
          {AUTO_RULES.map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82em', padding: '3px 0' }}>
              <span>{r.icon}</span>
              <span>{r.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.75em', color: r.effect === 'boosted' ? '#22c55e' : '#ef4444', fontWeight: 500 }}>
                {r.effect === 'boosted' ? '↑ boost' : '↓ lower'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={cfg.mode === 'custom'}
            onChange={(e) => updateCfg({ mode: e.target.checked ? 'custom' : 'auto' })}
          />
          <span style={{ fontWeight: 500, fontSize: '0.9em' }}>Customize priorities</span>
        </label>
        <span style={{ fontSize: '0.78em', color: 'var(--muted-foreground, #888)' }}>
          Add VIP senders, mute noisy senders, or adjust thresholds
        </span>
      </div>

      {cfg.mode === 'custom' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingLeft: 4 }}>
          {/* VIP senders */}
          <div>
            <span style={{ fontWeight: 500, fontSize: '0.9em', color: '#22c55e' }}>VIP senders (always high priority)</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input
                type="text"
                placeholder="email@example.com"
                value={vipInput}
                onChange={(e) => setVipInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && vipInput.trim()) {
                    updateCfg({ vip_senders: [...cfg.vip_senders, vipInput.trim().toLowerCase()] });
                    setVipInput('');
                  }
                }}
                style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border, #333)', fontSize: '0.85em' }}
              />
              <button
                onClick={() => {
                  if (vipInput.trim()) {
                    updateCfg({ vip_senders: [...cfg.vip_senders, vipInput.trim().toLowerCase()] });
                    setVipInput('');
                  }
                }}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border, #333)', cursor: 'pointer', fontSize: '0.85em' }}
              >Add</button>
            </div>
            {cfg.vip_senders.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {cfg.vip_senders.map((s, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: '0.8em' }}>
                    {s}
                    <button onClick={() => updateCfg({ vip_senders: cfg.vip_senders.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: '1em' }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Muted senders */}
          <div>
            <span style={{ fontWeight: 500, fontSize: '0.9em', color: '#6b7280' }}>Muted senders (always low priority)</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input
                type="text"
                placeholder="noreply@service.com"
                value={muteInput}
                onChange={(e) => setMuteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && muteInput.trim()) {
                    updateCfg({ mute_senders: [...cfg.mute_senders, muteInput.trim().toLowerCase()] });
                    setMuteInput('');
                  }
                }}
                style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border, #333)', fontSize: '0.85em' }}
              />
              <button
                onClick={() => {
                  if (muteInput.trim()) {
                    updateCfg({ mute_senders: [...cfg.mute_senders, muteInput.trim().toLowerCase()] });
                    setMuteInput('');
                  }
                }}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border, #333)', cursor: 'pointer', fontSize: '0.85em' }}
              >Add</button>
            </div>
            {cfg.mute_senders.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {cfg.mute_senders.map((s, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, background: 'rgba(107,114,128,0.15)', color: '#9ca3af', fontSize: '0.8em' }}>
                    {s}
                    <button onClick={() => updateCfg({ mute_senders: cfg.mute_senders.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: '1em' }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Muted keywords */}
          <div>
            <span style={{ fontWeight: 500, fontSize: '0.9em', color: '#6b7280' }}>Muted subject keywords (auto-low if subject matches)</span>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input
                type="text"
                placeholder="weekly digest"
                value={muteKwInput}
                onChange={(e) => setMuteKwInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && muteKwInput.trim()) {
                    updateCfg({ mute_keywords: [...cfg.mute_keywords, muteKwInput.trim().toLowerCase()] });
                    setMuteKwInput('');
                  }
                }}
                style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border, #333)', fontSize: '0.85em' }}
              />
              <button
                onClick={() => {
                  if (muteKwInput.trim()) {
                    updateCfg({ mute_keywords: [...cfg.mute_keywords, muteKwInput.trim().toLowerCase()] });
                    setMuteKwInput('');
                  }
                }}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border, #333)', cursor: 'pointer', fontSize: '0.85em' }}
              >Add</button>
            </div>
            {cfg.mute_keywords.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {cfg.mute_keywords.map((kw, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, background: 'rgba(107,114,128,0.15)', color: '#9ca3af', fontSize: '0.8em' }}>
                    "{kw}"
                    <button onClick={() => updateCfg({ mute_keywords: cfg.mute_keywords.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: '1em' }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Threshold sliders */}
          <div>
            <span style={{ fontWeight: 500, fontSize: '0.9em' }}>Score thresholds</span>
            <p style={{ fontSize: '0.78em', color: 'var(--muted-foreground, #888)', margin: '2px 0 8px' }}>
              Scores range 0–100. Emails scoring above the high threshold get full processing. Below the low threshold, metadata only.
            </p>
            <div style={{ display: 'flex', gap: 20 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <span style={{ fontSize: '0.82em' }}>High threshold: <strong style={{ color: '#22c55e' }}>{cfg.tier_thresholds.high}</strong></span>
                <input
                  type="range" min={40} max={90} step={5}
                  value={cfg.tier_thresholds.high}
                  onChange={(e) => updateCfg({ tier_thresholds: { ...cfg.tier_thresholds, high: Number(e.target.value) } })}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <span style={{ fontSize: '0.82em' }}>Low threshold: <strong style={{ color: '#6b7280' }}>{cfg.tier_thresholds.low}</strong></span>
                <input
                  type="range" min={10} max={50} step={5}
                  value={cfg.tier_thresholds.low}
                  onChange={(e) => updateCfg({ tier_thresholds: { ...cfg.tier_thresholds, low: Number(e.target.value) } })}
                />
              </label>
            </div>
          </div>

          {/* Skip observe toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={cfg.skip_observe_low}
              onChange={(e) => updateCfg({ skip_observe_low: e.target.checked })}
            />
            <span style={{ fontSize: '0.9em' }}>Skip LLM processing for low-priority emails</span>
            <span style={{ fontSize: '0.75em', color: 'var(--muted-foreground, #888)' }}>(saves tokens)</span>
          </label>
        </div>
      )}
    </div>
  );
}

export function IntegrationConnectionModal({ token, integrationId, open, onClose, onCommitted }: Props) {
  const meta = INTEGRATION_META[integrationId];

  const isGmail = integrationId === 'gmail';

  const initialState: WizardState = {
    filters: { ...meta.defaultFilters },
    cadence: { ...meta.defaultCadence },
    scope_routing: { ...DEFAULT_SCOPE_ROUTING },
    ...(isGmail ? { signal_config: { ...DEFAULT_GMAIL_SIGNAL_CONFIG } } : {}),
  };

  const steps: WizardStep<WizardState>[] = [
    {
      id: 'filters',
      title: 'What to observe',
      subtitle: 'Choose the data types and filters for this integration.',
      render: ({ state, setState }) => <FilterStep meta={meta} state={state} setState={setState} />,
    },
    // Gmail gets a signal priority step between filters and cadence
    ...(isGmail ? [{
      id: 'signal',
      title: 'Signal priority',
      subtitle: 'Control how emails are prioritised — reduce noise, save tokens.',
      render: ({ state, setState }: { state: WizardState; setState: (patch: Partial<WizardState> | ((prev: WizardState) => WizardState)) => void }) =>
        <SignalPriorityStep state={state} setState={setState} />,
    }] : []) as WizardStep<WizardState>[],
    {
      id: 'cadence',
      title: 'Sync cadence',
      subtitle: 'How often should we check for new data?',
      render: ({ state, setState }) => <CadenceStep state={state} setState={setState} />,
    },
    {
      id: 'scope',
      title: 'Scope routing',
      subtitle: 'Where should observations be stored?',
      render: ({ state, setState }) => <ScopeStep state={state} setState={setState} />,
    },
    {
      id: 'confirm',
      title: 'Review & connect',
      subtitle: 'Confirm your configuration.',
      render: ({ state }) => {
        const sc = state.signal_config;
        const filterCount = Object.entries(state.filters).filter(([,v]) => v !== false && v !== null).length;
        const cadenceLabel = state.cadence.mode.replace(/_/g, ' ').replace(/^poll /, 'Every ');
        return (
          <div className="wizard-confirm">
            <dl className="wizard-confirm-grid">
              <div className="wizard-confirm-row">
                <dt>Sync cadence</dt>
                <dd>{cadenceLabel}</dd>
              </div>
              <div className="wizard-confirm-row">
                <dt>Scope</dt>
                <dd>{state.scope_routing.mode.replace(/_/g, ' ')}</dd>
              </div>
              <div className="wizard-confirm-row">
                <dt>Filters</dt>
                <dd>{filterCount > 0 ? `${filterCount} active` : 'None'}</dd>
              </div>
              {sc && (
                <div className="wizard-confirm-row">
                  <dt>Signal priority</dt>
                  <dd>
                    {sc.mode === 'auto' ? 'Auto' : 'Custom'}
                    {sc.mode === 'custom' && (
                      <span className="wizard-confirm-detail">
                        high &ge; {sc.tier_thresholds.high}, low &lt; {sc.tier_thresholds.low}
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {sc?.mode === 'custom' && sc.vip_senders.length > 0 && (
                <div className="wizard-confirm-row">
                  <dt>VIP senders</dt>
                  <dd className="wizard-confirm-vip">{sc.vip_senders.join(', ')}</dd>
                </div>
              )}
              {sc?.mode === 'custom' && sc.mute_senders.length > 0 && (
                <div className="wizard-confirm-row">
                  <dt>Muted senders</dt>
                  <dd className="wizard-confirm-muted">{sc.mute_senders.join(', ')}</dd>
                </div>
              )}
              {sc?.mode === 'custom' && sc.mute_keywords.length > 0 && (
                <div className="wizard-confirm-row">
                  <dt>Muted keywords</dt>
                  <dd className="wizard-confirm-muted">{sc.mute_keywords.map(k => `"${k}"`).join(', ')}</dd>
                </div>
              )}
            </dl>
          </div>
        );
      },
    },
  ];

  return (
    <ConnectionWizard<WizardState>
      open={open}
      title={meta.title}
      subtitle={meta.subtitle}
      headerIcon={<ServiceLogo service={integrationId} size={24} />}
      steps={steps}
      initialState={initialState}
      commitLabel="Save & Connect"
      commitBusyLabel="Saving..."
      onCommit={async (state) => {
        await postJson(`/integrations/${integrationId}/configure`, token, {
          filters: state.filters,
          cadence: state.cadence,
          scope_routing: state.scope_routing,
          ...(state.signal_config ? { signal_config: state.signal_config } : {}),
        });
        onCommitted();
      }}
      onClose={onClose}
    />
  );
}
