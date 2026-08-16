// F2 / F3 / F4 UI surfaces (PR-16). F2 is wired into the main Pod shell;
// F3/F4 remain reusable views for future navigation work.
//
// All three views are read-only or correction-via-OBSERVE per spec.
// Backend: /pod/wiki/* routes from src/routes/wiki.ts.
//
// The Endorse button on AgentPagesView opens EndorsementModal (PR-8 UI).

import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  CircleUserRound,
  Fingerprint,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { EndorsementModal } from './EndorsementModal.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select.js';
import { createOperationId } from '../operation-id.js';
import {
  PROFILE_CATEGORY_LABELS,
  PROFILE_CATEGORY_ORDER,
  groupProfileFacts,
  profileCorrectionContent,
  type ProfileFact,
  type ProfileFactCategory,
  type SelfProfileResponse,
} from '../profile-model.js';

interface PageSummary {
  slug: string;
  page_id: string;
  category: string;
  title: string;
  summary: string;
  author: 'agent' | 'user' | 'unknown';
  updated?: string;
  endorsed_by?: string;
  sources_count: number;
}

interface PageDetail {
  category: string;
  slug: string;
  frontmatter: Record<string, string>;
  body: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

// ─────────────────────────────────────────────────────────────────────
// F2: Your Profile
// ─────────────────────────────────────────────────────────────────────

function profileTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Source date unknown';
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return 'Observed today';
  if (days === 1) return 'Observed yesterday';
  if (days < 30) return `Observed ${days} days ago`;
  return `Observed ${new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function categoryIcon(category: ProfileFactCategory): React.ReactNode {
  if (category === 'identity') return <Fingerprint size={15} />;
  if (category === 'instruction') return <MessageSquareText size={15} />;
  if (category === 'trait') return <Sparkles size={15} />;
  return <BadgeCheck size={15} />;
}

function ProfileCategorySelect({
  value,
  onValueChange,
  label,
}: {
  value: ProfileFactCategory;
  onValueChange: (value: ProfileFactCategory) => void;
  label: string;
}): React.ReactElement {
  return (
    <Select value={value} onValueChange={nextValue => onValueChange(nextValue as ProfileFactCategory)}>
      <SelectTrigger className="profile-category-select" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="profile-category-menu" align="start" position="popper">
        {PROFILE_CATEGORY_ORDER.map(category => (
          <SelectItem key={category} value={category}>
            {PROFILE_CATEGORY_LABELS[category]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ProfileView({ actorId, authToken = '' }: { actorId: string; authToken?: string }): React.ReactElement {
  const [profile, setProfile] = useState<SelfProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftCategory, setDraftCategory] = useState<ProfileFactCategory>('preference');
  const [editingFact, setEditingFact] = useState<ProfileFact | null>(null);
  const [removingFactId, setRemovingFactId] = useState<string | null>(null);

  const headers = React.useMemo(() => ({
    'content-type': 'application/json',
    ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
  }), [authToken]);

  const loadProfile = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/pod/wiki/profile', { headers: authToken ? { authorization: `Bearer ${authToken}` } : {} });
      if (response.status === 404) {
        setProfile(null);
        return;
      }
      if (!response.ok) throw new Error(`Profile could not be loaded (${response.status}).`);
      setProfile(await response.json() as SelfProfileResponse);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const buildProfile = async () => {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/pod/reflect', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          actor_id: actorId,
          operation_id: createOperationId(),
          target: { type: 'profile', id: 'self' },
          mode: 'explicit',
        }),
      });
      if (!response.ok) throw new Error(`Profile could not be refreshed (${response.status}).`);
      await loadProfile();
      setNotice(profile ? 'Profile refreshed.' : 'Profile created.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  const writeCorrection = async (input: {
    action: 'add' | 'replace' | 'remove';
    category?: ProfileFactCategory;
    text?: string;
    targetFactId?: string;
  }) => {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/pod/observe', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          actor_id: actorId,
          operation_id: createOperationId(),
          scope_alias: 'personal',
          type: 'preference',
          content_format: 'application/json',
          content: profileCorrectionContent(input),
        }),
      });
      if (!response.ok) throw new Error(`Profile change could not be saved (${response.status}).`);
      setDraftText('');
      setEditingFact(null);
      setRemovingFactId(null);
      await loadProfile();
      setNotice(input.action === 'add' ? 'Added to your profile.' : input.action === 'replace' ? 'Profile updated.' : 'Removed from your profile.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  const groups = groupProfileFacts(profile?.facts ?? []);

  return (
    <div className="profile-page">
      <header className="profile-page-header">
        <div>
          <span className="profile-page-eyebrow"><CircleUserRound size={14} /> Personal grounding</span>
          <h1>Your profile</h1>
          <p>The details Pod uses to make its answers feel more like they’re meant for you.</p>
        </div>
        <button className="profile-refresh-button" onClick={buildProfile} disabled={submitting}>
          <RefreshCw size={15} className={submitting ? 'spin' : ''} />
          Refresh profile
        </button>
      </header>

      {error && <div className="profile-error" role="alert">{error}</div>}
      {notice && <div className="profile-notice" role="status">{notice}</div>}

      <div className="profile-layout">
        <aside className="profile-carry-card">
          <div className="profile-carry-orbit" aria-hidden="true">
            <div className="profile-carry-core"><CircleUserRound size={27} /></div>
          </div>
          <span className="profile-live-label"><i /> Used by Ask Pod</span>
          <strong>{profile?.facts.length ?? 0}</strong>
          <span className="profile-fact-count">
            {profile?.facts.length === 1 ? 'detail in your profile' : 'details in your profile'}
          </span>
          <p>{profile?.summary ?? 'Build your profile to give Pod durable personal grounding.'}</p>
          {profile && (
            <div className="profile-carry-meta">
              <span>Version {profile.version}</span>
              <span>{profileTime(profile.updated_at).replace('Observed', 'Updated')}</span>
            </div>
          )}
        </aside>

        <main className="profile-ledger">
          {loading && <div className="profile-loading"><RefreshCw size={18} className="spin" /> Reading your profile…</div>}

          {!loading && !profile && (
            <section className="profile-empty">
              <div className="profile-empty-mark"><Fingerprint size={25} /></div>
              <h2>Nothing is being carried yet</h2>
              <p>Build a profile from the durable preferences and identity signals already in your Pod.</p>
              <button onClick={buildProfile} disabled={submitting}><Sparkles size={15} /> Build my profile</button>
            </section>
          )}

          {!loading && profile && groups.length === 0 && (
            <section className="profile-empty compact">
              <h2>Teach Pod its first stable fact</h2>
              <p>Add a preference or instruction below. Pod will carry it into future answers.</p>
            </section>
          )}

          {groups.map(group => (
            <section className="profile-fact-group" key={group.category}>
              <div className="profile-group-heading">
                <span>{categoryIcon(group.category)}</span>
                <h2>{group.label}</h2>
                <small>{group.facts.length}</small>
              </div>
              <div className="profile-fact-spine">
                {group.facts.map(fact => (
                  <article className="profile-fact" key={fact.id}>
                    <i className="profile-fact-node" aria-hidden="true" />
                    {editingFact?.id === fact.id ? (
                      <form
                        className="profile-edit-form"
                        onSubmit={event => {
                          event.preventDefault();
                          void writeCorrection({ action: 'replace', category: draftCategory, text: draftText, targetFactId: fact.id });
                        }}
                      >
                        <label className="profile-form-field">
                          <span>Category</span>
                          <ProfileCategorySelect value={draftCategory} onValueChange={setDraftCategory} label="Profile category" />
                        </label>
                        <label className="profile-form-field">
                          <span>What should Pod remember?</span>
                          <textarea value={draftText} onChange={event => setDraftText(event.target.value)} rows={3} autoFocus />
                        </label>
                        <div className="profile-form-actions">
                          <button type="button" className="profile-button-subtle" onClick={() => { setEditingFact(null); setDraftText(''); }}><X size={14} /> Cancel</button>
                          <button type="submit" className="profile-button-primary" disabled={submitting || !draftText.trim()}>Save change</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p>{fact.text}</p>
                        <div className="profile-fact-provenance">
                          <span>{profileTime(fact.observed_at)}</span>
                          <span>{fact.source_ids.length} source{fact.source_ids.length === 1 ? '' : 's'}</span>
                          {fact.origin === 'correction' && <span className="profile-corrected-label">Corrected by you</span>}
                        </div>
                        <div className="profile-fact-actions">
                          {removingFactId === fact.id ? (
                            <div className="profile-remove-confirm" role="group" aria-label="Confirm removal">
                              <span>Remove this detail?</span>
                              <button type="button" onClick={() => setRemovingFactId(null)}>Keep</button>
                              <button type="button" className="remove" disabled={submitting} onClick={() => void writeCorrection({ action: 'remove', targetFactId: fact.id })}>Remove</button>
                            </div>
                          ) : (
                            <>
                              <button type="button" onClick={() => { setRemovingFactId(null); setEditingFact(fact); setDraftCategory(fact.category); setDraftText(fact.text); }}><Pencil size={13} /> Edit</button>
                              <button type="button" className="remove" disabled={submitting} onClick={() => setRemovingFactId(fact.id)}><Trash2 size={13} /> Remove</button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}

          {profile && (
            <section className="profile-teach-card">
              <div className="profile-teach-intro">
                <span className="profile-page-eyebrow"><Plus size={13} /> Teach Pod</span>
                <h2>Add something Pod should remember</h2>
                <p>Add a stable preference, detail, or instruction you want Pod to use in future answers. You can edit or remove it any time.</p>
              </div>
              <form
                className="profile-add-form"
                onSubmit={event => {
                  event.preventDefault();
                  void writeCorrection({ action: 'add', category: draftCategory, text: draftText });
                }}
              >
                <label className="profile-form-field">
                  <span>Category</span>
                  <ProfileCategorySelect value={draftCategory} onValueChange={setDraftCategory} label="New profile detail category" />
                </label>
                <label className="profile-form-field">
                  <span>What should Pod remember?</span>
                  <textarea
                    id="profile-new-fact"
                    value={editingFact ? '' : draftText}
                    onChange={event => setDraftText(event.target.value)}
                    rows={3}
                    disabled={Boolean(editingFact)}
                    placeholder="For example: Prefer concise updates with concrete verification status."
                  />
                </label>
                <div className="profile-add-footer">
                  <span>{editingFact ? 'Finish editing the detail above before adding another.' : 'This will be available to Ask Pod.'}</span>
                  <button type="submit" className="profile-button-primary" disabled={submitting || Boolean(editingFact) || !draftText.trim()}>
                    <Plus size={15} /> Add to profile
                  </button>
                </div>
              </form>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// F3: Your Writing (Synthesis)
// ─────────────────────────────────────────────────────────────────────

export function SynthesisView(): React.ReactElement {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [selected, setSelected] = useState<PageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<PageSummary[]>('/pod/wiki/pages?category=synthesis&author=user')
      .then(setPages)
      .catch((e) => setError(String(e)));
  }, []);

  const openPage = async (slug: string) => {
    try {
      const p = await fetchJson<PageDetail>(`/pod/wiki/page/${slug}`);
      setSelected(p);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="synthesis-view" style={{ maxWidth: 960, margin: '0 auto', padding: 24, display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
      <aside>
        <h2>Your Writing</h2>
        <p style={{ fontSize: '0.85em', color: '#666' }}>
          Pages you’ve authored or endorsed. Agents cannot modify the body of these pages.
        </p>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        {pages.length === 0 && !error && <p>No synthesis pages yet.</p>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {pages.map((p) => (
            <li key={p.slug} style={{ marginBottom: 8 }}>
              <button
                onClick={() => openPage(p.slug)}
                style={{ background: 'transparent', border: 'none', padding: 8, textAlign: 'left', cursor: 'pointer', width: '100%', borderRadius: 4 }}
              >
                <div style={{ fontWeight: selected?.slug === p.slug ? 'bold' : 'normal' }}>{p.title}</div>
                <div style={{ fontSize: '0.8em', color: '#666' }}>{p.summary}</div>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main>
        {selected ? (
          <>
            <h1>{selected.frontmatter.title ?? selected.slug}</h1>
            <small style={{ color: '#666' }}>
              {selected.frontmatter.endorsed_by ? `endorsed by ${selected.frontmatter.endorsed_by}` : selected.frontmatter.author}
              {' · '}updated {selected.frontmatter.updated ?? '—'}
            </small>
            <article style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>{selected.body}</article>
            {/* TODO: agent-notice panel — read frontmatter.notices and render
                inline. Markdown editor for in-place editing of user-authored
                bodies is a future PR. */}
          </>
        ) : (
          <p>Select a page from the left to read.</p>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// F4: What the substrate has learned (agent-authored pages)
// ─────────────────────────────────────────────────────────────────────

export function AgentPagesView({ actorId }: { actorId: string }): React.ReactElement {
  const [category, setCategory] = useState<'concepts' | 'entities' | 'decisions'>('concepts');
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [endorseTarget, setEndorseTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = React.useCallback(() => {
    fetchJson<PageSummary[]>(`/pod/wiki/pages?category=${category}&author=agent`)
      .then(setPages)
      .catch((e) => setError(String(e)));
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="agent-pages-view" style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1>What the substrate has learned</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['concepts', 'entities', 'decisions'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              border: '1px solid #d1d5db',
              background: c === category ? '#2563eb' : 'white',
              color: c === category ? 'white' : 'black',
              cursor: 'pointer',
            }}
          >
            {c}
          </button>
        ))}
      </div>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {pages.length === 0 && !error && <p>No {category} pages yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {pages.map((p) => (
          <li key={p.slug} style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold' }}>{p.title}</div>
              <div style={{ fontSize: '0.9em', color: '#666' }}>{p.summary}</div>
              <div style={{ fontSize: '0.8em', color: '#999', marginTop: 4 }}>
                {p.sources_count} source{p.sources_count !== 1 ? 's' : ''} · agent-authored · updated {p.updated ?? '—'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setEndorseTarget(p.page_id)}
                style={{ background: '#2563eb', color: 'white', padding: '6px 12px', borderRadius: 4 }}
              >
                Endorse
              </button>
              {/* TODO: Forget button → POST /pod/forget with confirmation modal */}
            </div>
          </li>
        ))}
      </ul>
      {endorseTarget && (
        <EndorsementModal
          open
          pageId={endorseTarget}
          actorId={actorId}
          onClose={() => {
            setEndorseTarget(null);
            load();
          }}
          onEndorsed={() => {
            setEndorseTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}
