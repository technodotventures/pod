/**
 * Six-step Google Calendar connection wizard:
 *   1 Auth → 2 Calendars → 3 Filters → 4 Capture → 5 Cadence+Scope → 6 Preview
 */

import * as React from 'react';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { ConnectionWizard, type WizardStep } from './ConnectionWizard';
import { ServiceLogo } from './ServiceLogo';
import { PreviewCard } from './PreviewCard';
import { getJson, postJson } from './api';
import {
  type CalendarSource,
  type CalendarFilters,
  type CalendarCapture,
  type Cadence,
  type ScopeRouting,
  type PreviewResponse,
  DEFAULT_CALENDAR_FILTERS,
  DEFAULT_CALENDAR_CAPTURE,
  DEFAULT_CADENCE_CALENDAR,
  DEFAULT_SCOPE_ROUTING,
} from './types';

interface CalendarWizardState {
  /** Whether the OAuth grant has been confirmed in this session. */
  connected: boolean;
  calendars: CalendarSource[];
  filters: CalendarFilters;
  capture: CalendarCapture;
  cadence: Cadence;
  scope_routing: ScopeRouting;
}

interface CalendarStatusShape {
  status: string;
  scope_mismatch?: boolean;
}

interface Props {
  token: string;
  open: boolean;
  /** When the user is already connected and just configuring, skip auth. */
  startConnected: boolean;
  onClose: () => void;
  onCommitted: () => void;
}

export function CalendarConnectionModal({ token, open, startConnected, onClose, onCommitted }: Props) {
  const [bootstrapped, setBootstrapped] = React.useState(false);
  const [initial, setInitial] = React.useState<CalendarWizardState | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const state: CalendarWizardState = {
        connected: startConnected,
        calendars: [],
        filters: DEFAULT_CALENDAR_FILTERS,
        capture: DEFAULT_CALENDAR_CAPTURE,
        cadence: DEFAULT_CADENCE_CALENDAR,
        scope_routing: DEFAULT_SCOPE_ROUTING,
      };
      // Pre-fetch persisted calendars if the user is already connected.
      if (startConnected) {
        try {
          const data = await getJson<{ calendars: CalendarSource[] }>('/integrations/google-calendar/calendars', token);
          state.calendars = data.calendars;
        } catch { /* leave empty; Step 2 will retry */ }
      }
      if (!cancelled) {
        setInitial(state);
        setBootstrapped(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, startConnected, token]);

  const steps: WizardStep<CalendarWizardState>[] = React.useMemo(() => [
    {
      id: 'auth',
      title: 'Authenticate',
      subtitle: 'Your Pod reads your calendars locally — nothing leaves your machine.',
      render: ({ state, setState }) => (
        <AuthStep
          connected={state.connected}
          onConnected={() => setState({ connected: true })}
          token={token}
        />
      ),
      canAdvance: (s) => s.connected,
      advanceLabel: 'Continue',
    },
    {
      id: 'calendars',
      title: 'Calendars',
      subtitle: 'Pick which calendars feed your Pod.',
      render: ({ state, setState }) => (
        <CalendarsStep
          token={token}
          value={state.calendars}
          onChange={(calendars) => setState({ calendars })}
        />
      ),
      canAdvance: (s) => s.calendars.some(c => c.enabled),
    },
    {
      id: 'filters',
      title: 'Filters',
      subtitle: 'Excluded events never enter your Pod.',
      render: ({ state, setState }) => (
        <FiltersStep value={state.filters} onChange={(filters) => setState({ filters })} />
      ),
    },
    {
      id: 'capture',
      title: 'Capture',
      subtitle: 'For each kept event, which fields land in your Pod?',
      render: ({ state, setState }) => (
        <CaptureStep value={state.capture} onChange={(capture) => setState({ capture })} />
      ),
    },
    {
      id: 'cadence',
      title: 'Cadence',
      subtitle: 'When does the Pod check for new events, and where do they go?',
      render: ({ state, setState }) => (
        <CadenceStep
          cadence={state.cadence}
          onCadence={(cadence) => setState({ cadence })}
          routing={state.scope_routing}
          onRouting={(scope_routing) => setState({ scope_routing })}
        />
      ),
    },
    {
      id: 'preview',
      title: 'Preview',
      subtitle: 'A live sample of what would land in your Pod with these settings.',
      render: ({ state }) => <PreviewStep token={token} state={state} />,
      advanceLabel: 'Connect Calendar',
    },
  ], [token]);

  if (!open) return null;
  if (!bootstrapped || !initial) {
    return (
      <div className="conn-wizard-bootstrap">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <ConnectionWizard
      open={open}
      title="Connect Google Calendar"
      subtitle="Meetings, attendees, and scheduled context for your agents."
      headerIcon={<ServiceLogo service="google-calendar" size={24} />}
      steps={steps}
      initialState={initial}
      initialStepIndex={initial.connected ? 1 : 0}
      commitLabel="Connect Calendar"
      commitBusyLabel="Saving…"
      onClose={onClose}
      onCommit={async (state) => {
        await postJson('/integrations/google-calendar/wizard-config', token, {
          calendars: state.calendars.filter(c => c.enabled),
          filters: state.filters,
          capture_fields: state.capture,
          cadence: state.cadence,
          scope_routing: state.scope_routing,
        });
        onCommitted();
        onClose();
      }}
    />
  );
}

/* ── Steps ── */

function AuthStep({ connected, onConnected, token }: { connected: boolean; onConnected: () => void; token: string }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const pollRef = React.useRef<number | null>(null);

  React.useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const data = await getJson<{ url: string }>('/integrations/google-calendar/auth-url?actor_id=person-local', token);
      window.open(data.url, '_blank', 'noopener,noreferrer');
      pollRef.current = window.setInterval(async () => {
        try {
          const status = await getJson<CalendarStatusShape>('/integrations/google-calendar/status', token);
          if (status.status === 'active' && !status.scope_mismatch) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            onConnected();
            setBusy(false);
          }
        } catch { /* ignore until popup completes */ }
      }, 2000);
      window.setTimeout(() => { if (pollRef.current) window.clearInterval(pollRef.current); }, 120_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start sign-in');
      setBusy(false);
    }
  }

  if (connected) {
    return (
      <div className="auth-step connected">
        <CheckCircle2 size={20} />
        <span>Google Calendar is connected.</span>
      </div>
    );
  }

  return (
    <div className="auth-step">
      <p className="auth-step-blurb">Your Pod will read your calendars so your agents know about your meetings, commitments, and the people involved. Calendar data stays in your Pod.</p>
      <button className="service-auth-button" onClick={signIn} disabled={busy}>
        <span className="service-auth-button-logo"><ServiceLogo service="google" size={22} /></span>
        {busy ? 'Waiting for Google sign-in…' : 'Authenticate with Google'}
      </button>
      {error && <div className="conn-wizard-error">{error}</div>}
    </div>
  );
}

function CalendarsStep({ token, value, onChange }: { token: string; value: CalendarSource[]; onChange: (cals: CalendarSource[]) => void }) {
  const [loading, setLoading] = React.useState(value.length === 0);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await getJson<{ calendars: CalendarSource[] }>('/integrations/google-calendar/calendars', token);
      onChange(data.calendars);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load calendars');
    } finally {
      setLoading(false);
    }
  }, [token, onChange]);

  React.useEffect(() => { if (value.length === 0) void load(); }, [load, value.length]);

  if (loading) return <div className="conn-wizard-loading"><Loader2 className="animate-spin" size={16} /> Loading calendars…</div>;
  if (error) return <div className="conn-wizard-error">{error} <button className="conn-link" onClick={load}>Retry</button></div>;

  return (
    <div className="calendars-step">
      <div className="calendars-list">
        {value.map(cal => (
          <label key={cal.id} className="calendar-row">
            <input
              type="checkbox"
              checked={cal.enabled}
              onChange={(e) => onChange(value.map(c => c.id === cal.id ? { ...c, enabled: e.target.checked } : c))}
            />
            <span className="calendar-row-swatch" style={{ background: cal.color ?? '#888' }} />
            <span className="calendar-row-name">{cal.name}</span>
            <span className="calendar-row-role">{cal.primary ? 'Primary' : cal.access_role ?? ''}</span>
          </label>
        ))}
      </div>
      <button className="conn-link" onClick={load}><RefreshCw size={12} /> Refresh</button>
    </div>
  );
}

function FiltersStep({ value, onChange }: { value: CalendarFilters; onChange: (f: CalendarFilters) => void }) {
  return (
    <div className="filters-step">
      <FieldRow label="Time range">
        <select value={value.time_range} onChange={(e) => onChange({ ...value, time_range: e.target.value as CalendarFilters['time_range'] })}>
          <option value="last_30d_future">Last 30 days + future</option>
          <option value="last_90d_future">Last 90 days + future</option>
          <option value="future_only">Future only</option>
          <option value="all">All history</option>
        </select>
      </FieldRow>

      <FieldRow label="Event types">
        <div className="filter-chips">
          {(['meeting', 'recurring', 'solo', 'all_day'] as const).map(t => (
            <label key={t} className={`filter-chip ${value.event_types.includes(t) ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={value.event_types.includes(t)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? Array.from(new Set([...value.event_types, t]))
                    : value.event_types.filter(x => x !== t);
                  onChange({ ...value, event_types: next });
                }}
              />
              {humanType(t)}
            </label>
          ))}
        </div>
      </FieldRow>

      <FieldRow label={`Minimum attendees: ${value.min_attendees}`}>
        <input
          type="range" min={1} max={10} step={1}
          value={value.min_attendees}
          onChange={(e) => onChange({ ...value, min_attendees: Number(e.target.value) })}
        />
      </FieldRow>

      <ToggleRow label="Exclude declined events" value={value.exclude_declined} onChange={(v) => onChange({ ...value, exclude_declined: v })} />
      <ToggleRow label="Exclude private events" value={value.exclude_private} onChange={(v) => onChange({ ...value, exclude_private: v })} />
      <ToggleRow label="Exclude events marked Free" value={value.exclude_free} onChange={(v) => onChange({ ...value, exclude_free: v })} />

      <FieldRow label="Exclude keywords (comma-separated)">
        <input
          type="text"
          value={value.exclude_keywords.join(', ')}
          placeholder="standup, 1:1"
          onChange={(e) => onChange({ ...value, exclude_keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
        />
      </FieldRow>
    </div>
  );
}

function CaptureStep({ value, onChange }: { value: CalendarCapture; onChange: (c: CalendarCapture) => void }) {
  const items: Array<{ key: keyof CalendarCapture; label: string; locked?: boolean }> = [
    { key: 'title', label: 'Title', locked: true },
    { key: 'time', label: 'Time', locked: true },
    { key: 'attendees', label: 'Attendee list (names + emails)' },
    { key: 'description', label: 'Description / agenda' },
    { key: 'meeting_link', label: 'Meeting link (Zoom, Meet, Teams)' },
    { key: 'attached_files', label: 'Attached files (Drive links)' },
    { key: 'location', label: 'Location' },
    { key: 'recurrence', label: 'Recurrence pattern' },
    { key: 'organizer', label: 'Organizer' },
    { key: 'response_status', label: 'Your response status' },
    { key: 'conference_data', label: 'Conference dial-in info' },
  ];
  return (
    <div className="capture-step">
      {items.map(it => (
        <ToggleRow
          key={it.key}
          label={it.label + (it.locked ? ' (always captured)' : '')}
          value={value[it.key]}
          disabled={it.locked}
          onChange={(v) => onChange({ ...value, [it.key]: v })}
        />
      ))}
    </div>
  );
}

function CadenceStep({ cadence, onCadence, routing, onRouting }: {
  cadence: Cadence; onCadence: (c: Cadence) => void;
  routing: ScopeRouting; onRouting: (r: ScopeRouting) => void;
}) {
  return (
    <div className="cadence-step">
      <FieldRow label="Sync cadence">
        <select value={cadence.mode} onChange={(e) => onCadence({ ...cadence, mode: e.target.value as Cadence['mode'] })}>
          <option value="webhook">Real-time (webhook — not yet wired; falls back to polling)</option>
          <option value="poll_5m">Every 5 minutes</option>
          <option value="poll_hour">Every hour</option>
          <option value="manual">Manual ("sync now" only)</option>
        </select>
      </FieldRow>

      <FieldRow label="Scope routing">
        <select value={routing.mode} onChange={(e) => onRouting({ ...routing, mode: e.target.value as ScopeRouting['mode'] })}>
          <option value="auto_detect">Use Google Calendar data space</option>
          <option value="all_self">Everything to Self scope</option>
          <option value="all_project">Everything to a specific project scope</option>
          <option value="per_source">Per-calendar rules (set above on each calendar)</option>
        </select>
      </FieldRow>

      {routing.mode === 'all_project' && (
        <FieldRow label="Project scope">
          <input
            type="text"
            value={routing.project_scope ?? ''}
            onChange={(e) => onRouting({ ...routing, project_scope: e.target.value || null })}
            placeholder="pod/founder/projects/q1-platform"
          />
        </FieldRow>
      )}
    </div>
  );
}

function PreviewStep({ token, state }: { token: string; state: CalendarWizardState }) {
  const [data, setData] = React.useState<PreviewResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await postJson<PreviewResponse>('/integrations/google-calendar/preview', token, {
        calendars: state.calendars.filter(c => c.enabled),
        filters: state.filters,
        capture_fields: state.capture,
        scope_routing: state.scope_routing,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally { setLoading(false); }
  }, [token, state]);

  React.useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="conn-wizard-loading"><Loader2 className="animate-spin" size={16} /> Generating preview from your live calendar…</div>;
  if (error) return <div className="conn-wizard-error">{error} <button className="conn-link" onClick={load}>Retry</button></div>;
  if (!data || data.samples.length === 0) {
    return <div className="conn-wizard-empty">No events matched your filters in the preview window. Adjust filters or expand the time range.</div>;
  }

  return (
    <div className="preview-step">
      {data.counters && (
        <div className="preview-counters">
          {data.counters.kept} kept · {data.counters.dropped} filtered out · {data.counters.fetched} fetched
          <button className="conn-link" onClick={load}><RefreshCw size={12} /> Refresh</button>
        </div>
      )}
      <div className="preview-cards-grid">
        {data.samples.map((s, i) => <PreviewCard key={`${s.source_id}-${i}`} obs={s} />)}
      </div>
    </div>
  );
}

/* ── Tiny shared widgets ── */

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="filter-field">
      <span className="filter-field-label">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`filter-toggle-row ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function humanType(t: 'meeting' | 'recurring' | 'solo' | 'all_day'): string {
  return ({ meeting: 'Meetings', recurring: 'Recurring', solo: 'Solo blocks', all_day: 'All-day' })[t];
}
