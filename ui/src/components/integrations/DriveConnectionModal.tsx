/**
 * Six-step Google Drive connection wizard:
 *   1 Auth → 2 Folders → 3 File filters → 4 Content handling → 5 Cadence → 6 Scope+Preview
 *
 * drive.readonly scope: the user picks folders via the in-app folder
 * browser (DriveFolderBrowserStep) which lists folders directly through
 * the Drive API. No Google Picker / no GCP project number / no extra
 * API key required.
 */

import * as React from 'react';
import { CheckCircle2, Loader2, RefreshCw, FolderOpen, ChevronRight, X, AlertTriangle } from 'lucide-react';
import { ConnectionWizard, type WizardStep } from './ConnectionWizard';
import { ServiceLogo } from './ServiceLogo';
import { PreviewCard } from './PreviewCard';
import { getJson, postJson } from './api';
import {
  type DriveSource,
  type DriveFileFilters,
  type DriveContentHandling,
  type Cadence,
  type ScopeRouting,
  type PreviewResponse,
  DEFAULT_DRIVE_FILE_FILTERS,
  DEFAULT_DRIVE_CONTENT_HANDLING,
  DEFAULT_CADENCE_DRIVE,
  DEFAULT_SCOPE_ROUTING,
} from './types';

interface DriveWizardState {
  connected: boolean;
  scope_mismatch: boolean;
  sources: DriveSource[];
  file_filters: DriveFileFilters;
  content_handling: DriveContentHandling;
  cadence: Cadence;
  scope_routing: ScopeRouting;
  access_token: string | null;
}

interface DriveStatusShape {
  configured: boolean;
  connected: boolean;
  scope_mismatch?: boolean;
}

interface Props {
  token: string;
  open: boolean;
  startConnected: boolean;
  onClose: () => void;
  onCommitted: () => void;
}

export function DriveConnectionModal({ token, open, startConnected, onClose, onCommitted }: Props) {
  const [bootstrapped, setBootstrapped] = React.useState(false);
  const [initial, setInitial] = React.useState<DriveWizardState | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      let scopeMismatch = false;
      let sources: DriveSource[] = [];
      try {
        const status = await getJson<{ google_drive: DriveStatusShape }>('/integrations/google-drive/status', token);
        scopeMismatch = Boolean(status.google_drive.scope_mismatch);
      } catch { /* defaults */ }
      try {
        const data = await getJson<{ sources: DriveSource[] }>('/integrations/google-drive/sources', token);
        sources = data.sources ?? [];
      } catch { /* empty */ }
      if (cancelled) return;
      setInitial({
        connected: startConnected && !scopeMismatch,
        scope_mismatch: scopeMismatch,
        sources,
        file_filters: DEFAULT_DRIVE_FILE_FILTERS,
        content_handling: DEFAULT_DRIVE_CONTENT_HANDLING,
        cadence: DEFAULT_CADENCE_DRIVE,
        scope_routing: DEFAULT_SCOPE_ROUTING,
        access_token: null,
      });
      setBootstrapped(true);
    })();
    return () => { cancelled = true; };
  }, [open, startConnected, token]);

  const steps: WizardStep<DriveWizardState>[] = React.useMemo(() => [
    {
      id: 'auth',
      title: 'Authenticate',
      subtitle: 'Pod reads your Google Drive so you can pick which folders to ingest.',
      render: ({ state, setState }) => (
        <DriveAuthStep
          token={token}
          state={state}
          onConnected={(accessToken) => setState({ connected: true, scope_mismatch: false, access_token: accessToken })}
        />
      ),
      canAdvance: (s) => s.connected,
    },
    {
      id: 'sources',
      title: 'Folders',
      subtitle: 'Browse your Drive and choose which folders the Pod should ingest.',
      render: ({ state, setState }) => (
        <DriveFolderBrowserStep
          token={token}
          state={state}
          onSources={(sources) => setState({ sources })}
        />
      ),
      canAdvance: (s) => s.sources.length > 0,
    },
    {
      id: 'file_filters',
      title: 'Files',
      subtitle: 'Narrow what gets ingested.',
      render: ({ state, setState }) => (
        <FileFiltersStep value={state.file_filters} onChange={(file_filters) => setState({ file_filters })} />
      ),
    },
    {
      id: 'content',
      title: 'Content',
      subtitle: 'How deeply to ingest each file.',
      render: ({ state, setState }) => (
        <ContentHandlingStep value={state.content_handling} onChange={(content_handling) => setState({ content_handling })} />
      ),
    },
    {
      id: 'cadence',
      title: 'Cadence',
      subtitle: 'When does the Pod check for new files?',
      render: ({ state, setState }) => (
        <CadenceStep value={state.cadence} onChange={(cadence) => setState({ cadence })} />
      ),
    },
    {
      id: 'preview',
      title: 'Preview',
      subtitle: 'A live sample of what would land in your Pod with these settings.',
      render: ({ state, setState }) => (
        <ScopeAndPreviewStep
          token={token}
          state={state}
          onRouting={(scope_routing) => setState({ scope_routing })}
        />
      ),
      advanceLabel: 'Connect Drive',
    },
  ], [token]);

  if (!open) return null;
  if (!bootstrapped || !initial) {
    return <div className="conn-wizard-bootstrap"><Loader2 className="animate-spin" size={20} /></div>;
  }

  return (
    <ConnectionWizard
      open={open}
      title="Connect Google Drive"
      subtitle="Documents and files for your agents — you pick which folders the Pod can see."
      headerIcon={<ServiceLogo service="google-drive" size={24} />}
      steps={steps}
      initialState={initial}
      initialStepIndex={initial.connected && initial.sources.length > 0 ? 1 : 0}
      commitLabel="Connect Drive"
      commitBusyLabel="Saving…"
      onClose={onClose}
      onCommit={async (state) => {
        // Sources are already persisted by the folder browser step. Persist
        // everything else via the wizard-config allow-listed endpoint.
        await postJson('/integrations/google-drive/wizard-config', token, {
          file_filters: state.file_filters,
          content_handling: state.content_handling,
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

function DriveAuthStep({ token, state, onConnected }: { token: string; state: DriveWizardState; onConnected: (accessToken: string | null) => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const pollRef = React.useRef<number | null>(null);

  React.useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  async function signIn() {
    setBusy(true); setError(null);
    try {
      const data = await getJson<{ url: string }>('/integrations/google-drive/auth-url?actor_id=person-local', token);
      window.open(data.url, '_blank', 'noopener,noreferrer');
      pollRef.current = window.setInterval(async () => {
        try {
          const status = await getJson<{ google_drive: DriveStatusShape }>('/integrations/google-drive/status', token);
          if (status.google_drive.connected && !status.google_drive.scope_mismatch) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            onConnected(null);
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

  if (state.connected) {
    return (
      <div className="auth-step connected">
        <CheckCircle2 size={20} />
        <span>Google Drive is connected (drive.readonly scope).</span>
      </div>
    );
  }

  return (
    <div className="auth-step">
      {state.scope_mismatch && (
        <div className="conn-wizard-warning">
          <AlertTriangle size={14} /> Your existing Drive token uses a different scope than this Pod expects. Reconnect to refresh it.
        </div>
      )}
      <p className="auth-step-blurb">
        Your Pod will read your Drive so you can pick folders to ingest. The Pod only ingests files in the folders you pick —
        nothing else is uploaded or kept.
      </p>
      <button className="service-auth-button" onClick={signIn} disabled={busy}>
        <span className="service-auth-button-logo"><ServiceLogo service="google" size={22} /></span>
        {busy ? 'Waiting for Google sign-in…' : 'Authenticate with Google'}
      </button>
      {error && <div className="conn-wizard-error">{error}</div>}
    </div>
  );
}

/* ── Folder browser step ── */

interface DriveFolder { id: string; name: string }
interface BreadcrumbEntry { id: string; name: string }

function DriveFolderBrowserStep({ token, state, onSources }: { token: string; state: DriveWizardState; onSources: (s: DriveSource[]) => void }) {
  const [crumbs, setCrumbs] = React.useState<BreadcrumbEntry[]>([{ id: 'root', name: 'My Drive' }]);
  const [folders, setFolders] = React.useState<DriveFolder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busySelection, setBusySelection] = React.useState(false);

  const currentParent = crumbs[crumbs.length - 1];

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await getJson<{ folders: DriveFolder[] }>(
          `/integrations/google-drive/folders?parent=${encodeURIComponent(currentParent.id)}&pageSize=200`,
          token,
        );
        if (!cancelled) setFolders(data.folders ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not list folders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentParent.id, token]);

  const selectedIds = React.useMemo(() => new Set(state.sources.map(s => s.folder_id)), [state.sources]);

  async function toggleSelect(folder: DriveFolder) {
    setBusySelection(true);
    setError(null);
    try {
      const isSelected = selectedIds.has(folder.id);
      const next = isSelected
        ? state.sources.filter(s => s.folder_id !== folder.id)
        : [...state.sources, { folder_id: folder.id, folder_path: folder.name } as DriveSource];
      const result = await postJson<{ sources: DriveSource[]; failures: Array<{ folder_id: string; reason: string }> }>(
        '/integrations/google-drive/sources',
        token,
        { folders: next.map(s => ({ folder_id: s.folder_id, folder_path: s.folder_path, scope_override: s.scope_override })) },
      );
      onSources(result.sources);
      if (result.failures.length > 0) setError(result.failures[0]?.reason ?? 'Could not save folder');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update selection');
    } finally {
      setBusySelection(false);
    }
  }

  function drillInto(folder: DriveFolder) {
    setCrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
  }

  function jumpToCrumb(index: number) {
    setCrumbs(prev => prev.slice(0, index + 1));
  }

  return (
    <div className="folder-browser">
      <nav className="folder-browser-crumbs" aria-label="Drive folder breadcrumb">
        {crumbs.map((c, i) => (
          <React.Fragment key={`${c.id}-${i}`}>
            {i > 0 && <ChevronRight size={12} className="folder-browser-crumb-sep" />}
            <button
              className={`folder-browser-crumb${i === crumbs.length - 1 ? ' current' : ''}`}
              onClick={() => jumpToCrumb(i)}
              disabled={i === crumbs.length - 1}
            >
              {c.name}
            </button>
          </React.Fragment>
        ))}
      </nav>

      {loading && <div className="folder-browser-loading"><Loader2 className="animate-spin" size={14} /> Loading folders…</div>}

      {!loading && folders.length === 0 && !error && (
        <div className="folder-browser-empty">No subfolders here.</div>
      )}

      {!loading && folders.length > 0 && (
        <ul className="folder-browser-list">
          {folders.map(f => {
            const checked = selectedIds.has(f.id);
            return (
              <li key={f.id} className={`folder-browser-row${checked ? ' selected' : ''}`}>
                <label className="folder-browser-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busySelection}
                    onChange={() => void toggleSelect(f)}
                  />
                  <FolderOpen size={14} />
                  <span className="folder-browser-name">{f.name}</span>
                </label>
                <button
                  className="folder-browser-drill"
                  onClick={() => drillInto(f)}
                  aria-label={`Open ${f.name}`}
                >
                  <ChevronRight size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {state.sources.length > 0 && (
        <div className="folder-browser-selected">
          <div className="folder-browser-selected-label">Selected ({state.sources.length})</div>
          <div className="folder-browser-selected-chips">
            {state.sources.map(s => (
              <span key={s.folder_id} className="folder-browser-chip">
                <FolderOpen size={11} />
                <span>{s.folder_path}</span>
                <button
                  onClick={() => void toggleSelect({ id: s.folder_id, name: s.folder_path })}
                  aria-label={`Remove ${s.folder_path}`}
                ><X size={10} /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {error && <div className="conn-wizard-error">{error}</div>}
    </div>
  );
}

/* ── Filter / handling / cadence / preview steps ── */

function FileFiltersStep({ value, onChange }: { value: DriveFileFilters; onChange: (v: DriveFileFilters) => void }) {
  const allTypes: Array<[string, string]> = [
    ['doc', 'Docs'], ['sheet', 'Sheets'], ['slide', 'Slides'],
    ['pdf', 'PDFs'], ['text', 'Plain text'], ['markdown', 'Markdown'],
  ];
  return (
    <div className="filters-step">
      <FieldRow label="File types">
        <div className="filter-chips">
          {allTypes.map(([k, label]) => (
            <label key={k} className={`filter-chip ${value.types.includes(k) ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={value.types.includes(k)}
                onChange={(e) => onChange({
                  ...value,
                  types: e.target.checked ? [...new Set([...value.types, k])] : value.types.filter(t => t !== k),
                })}
              />
              {label}
            </label>
          ))}
        </div>
      </FieldRow>

      <ToggleRow label="Include binary files (images, videos, archives)" value={value.include_binaries} onChange={(v) => onChange({ ...value, include_binaries: v })} />

      <FieldRow label="Maximum file size">
        <select value={value.max_size_mb} onChange={(e) => onChange({ ...value, max_size_mb: Number(e.target.value) })}>
          <option value={1}>1 MB</option>
          <option value={10}>10 MB</option>
          <option value={100}>100 MB</option>
          <option value={0}>No limit</option>
        </select>
      </FieldRow>

      <ToggleRow label="Skip files marked confidential" value={value.skip_confidential} onChange={(v) => onChange({ ...value, skip_confidential: v })} />

      <FieldRow label="Exclude name patterns (comma-separated, * wildcard)">
        <input
          type="text"
          value={value.exclude_patterns.join(', ')}
          placeholder="*draft*, temp_*"
          onChange={(e) => onChange({ ...value, exclude_patterns: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
        />
      </FieldRow>
    </div>
  );
}

function ContentHandlingStep({ value, onChange }: { value: DriveContentHandling; onChange: (v: DriveContentHandling) => void }) {
  return (
    <div className="content-step">
      <FieldRow label="Ingestion depth">
        <div className="radio-stack">
          {(['summaries', 'metadata', 'full'] as const).map(d => (
            <label key={d} className={`radio-row ${value.ingestion_depth === d ? 'on' : ''}`}>
              <input type="radio" name="depth" value={d} checked={value.ingestion_depth === d} onChange={() => onChange({ ...value, ingestion_depth: d })} />
              <div>
                <strong>{depthLabel(d)}</strong>
                <span className="radio-help">{depthHelp(d)}</span>
              </div>
            </label>
          ))}
        </div>
      </FieldRow>

      {value.ingestion_depth !== 'metadata' && (
        <FieldRow label="Chunk size">
          <select value={value.chunk_size} onChange={(e) => onChange({ ...value, chunk_size: e.target.value as DriveContentHandling['chunk_size'] })}>
            <option value="paragraph">Paragraph</option>
            <option value="section">Section (recommended)</option>
            <option value="page">Page</option>
            <option value="whole_doc">Whole document</option>
          </select>
        </FieldRow>
      )}

      <ToggleRow label="Include comments" value={value.include_comments} onChange={(v) => onChange({ ...value, include_comments: v })} />
      <ToggleRow label="Include revision history" value={value.include_revisions} onChange={(v) => onChange({ ...value, include_revisions: v })} />
      <ToggleRow label="Include suggested edits" value={value.include_suggestions} onChange={(v) => onChange({ ...value, include_suggestions: v })} />
      <ToggleRow label="Re-ingest on edit" value={value.reingest_on_edit} onChange={(v) => onChange({ ...value, reingest_on_edit: v })} />
    </div>
  );
}

function CadenceStep({ value, onChange }: { value: Cadence; onChange: (v: Cadence) => void }) {
  return (
    <div className="cadence-step">
      <FieldRow label="Sync cadence">
        <select value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value as Cadence['mode'] })}>
          <option value="webhook">Real-time (webhook — not yet wired; falls back to polling)</option>
          <option value="poll_5m">Every 5 minutes</option>
          <option value="poll_hour">Every hour</option>
          <option value="manual">Manual ("sync now" only)</option>
        </select>
      </FieldRow>
      <FieldRow label="Backfill window (first sync only)">
        <select value={value.backfill ?? 'last_30d'} onChange={(e) => onChange({ ...value, backfill: e.target.value as Cadence['backfill'] })}>
          <option value="last_30d">Last 30 days</option>
          <option value="last_90d">Last 90 days</option>
          <option value="all">All files</option>
          <option value="none">No backfill (new changes only)</option>
        </select>
      </FieldRow>
    </div>
  );
}

function ScopeAndPreviewStep({ token, state, onRouting }: { token: string; state: DriveWizardState; onRouting: (r: ScopeRouting) => void }) {
  const [data, setData] = React.useState<PreviewResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await postJson<PreviewResponse>('/integrations/google-drive/preview', token, {
        sources: state.sources,
        file_filters: state.file_filters,
        content_handling: state.content_handling,
        scope_routing: state.scope_routing,
      });
      setData(result);
    } catch (err) { setError(err instanceof Error ? err.message : 'Preview failed'); }
    finally { setLoading(false); }
  }, [token, state]);

  React.useEffect(() => { void load(); }, [load]);

  return (
    <div className="preview-step">
      <FieldRow label="Scope routing">
        <select value={state.scope_routing.mode} onChange={(e) => onRouting({ ...state.scope_routing, mode: e.target.value as ScopeRouting['mode'] })}>
          <option value="auto_detect">Use Google Drive data space</option>
          <option value="all_self">Everything to Self scope</option>
          <option value="all_project">Everything to a specific project scope</option>
          <option value="per_source">Per-folder rules (set above on each folder)</option>
        </select>
      </FieldRow>
      {state.scope_routing.mode === 'all_project' && (
        <FieldRow label="Project scope">
          <input
            type="text"
            value={state.scope_routing.project_scope ?? ''}
            onChange={(e) => onRouting({ ...state.scope_routing, project_scope: e.target.value || null })}
            placeholder="pod/founder/projects/q1-platform"
          />
        </FieldRow>
      )}

      <div className="preview-divider" />

      {loading && <div className="conn-wizard-loading"><Loader2 className="animate-spin" size={16} /> Generating preview from your live folders…</div>}
      {error && <div className="conn-wizard-error">{error} <button className="conn-link" onClick={load}>Retry</button></div>}
      {data && data.samples.length === 0 && (
        <div className="conn-wizard-empty">No files passed your filters in the preview window. Adjust filters or pick a different folder.</div>
      )}
      {data && data.samples.length > 0 && (
        <>
          {data.counters && (
            <div className="preview-counters">
              {data.counters.kept} kept · {data.counters.dropped} filtered out · {data.counters.fetched} fetched
              <button className="conn-link" onClick={load}><RefreshCw size={12} /> Refresh</button>
            </div>
          )}
          <div className="preview-cards-grid">
            {data.samples.map((s, i) => <PreviewCard key={`${s.source_id}-${i}`} obs={s} />)}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Shared widgets ── */

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

function depthLabel(d: 'summaries' | 'metadata' | 'full'): string {
  return ({ summaries: 'Summaries only (recommended)', metadata: 'Metadata only', full: 'Full content' })[d];
}

function depthHelp(d: 'summaries' | 'metadata' | 'full'): string {
  return ({
    summaries: 'Deterministic summary at ingest (title + owner + sharing + first ~500 chars). REFLECT upgrades later. No LLM at ingest.',
    metadata: 'Just title, owner, last modified, sharing info. Smallest footprint.',
    full: 'Whole document text stored in Layer 0. Largest footprint; richest recall.',
  })[d];
}
