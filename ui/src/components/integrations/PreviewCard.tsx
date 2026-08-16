/**
 * Renders one observation-shaped preview record as a card. The data
 * comes directly from `/integrations/:service/preview` and matches the
 * shape that would land in Layer 0 if the user commits. Scope is
 * surfaced prominently per the brief.
 */

import * as React from 'react';
import { CalendarDays, FileText, Users, Link as LinkIcon, MapPin, Paperclip } from 'lucide-react';
import type { ObservationPreview } from './types';

function shortScope(scope: string): string {
  // pod/<id>/<alias> → <alias>
  const parts = scope.split('/');
  return parts[parts.length - 1] || scope;
}

function fmtDateRange(start: unknown, end: unknown): string {
  if (typeof start !== 'string' || !start) return '';
  try {
    const s = new Date(start);
    const e = typeof end === 'string' && end ? new Date(end) : null;
    const fmt = (d: Date) => d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return e ? `${fmt(s)} – ${e.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })}` : fmt(s);
  } catch {
    return String(start);
  }
}

export function PreviewCard({ obs }: { obs: ObservationPreview }) {
  if (obs.source === 'google_calendar') return <CalendarPreviewCard obs={obs} />;
  return <DocumentPreviewCard obs={obs} />;
}

function CalendarPreviewCard({ obs }: { obs: ObservationPreview }) {
  const c = obs.content as {
    title?: string;
    start?: string;
    end?: string;
    attendees?: Array<{ email?: string; display_name?: string; response?: string }>;
    description?: string;
    location?: string;
    meeting_link?: string;
    attached_files?: Array<{ file_id?: string; title?: string }>;
    organizer?: { email?: string; display_name?: string };
  };
  const attendeeNames = (c.attendees ?? []).map(a => a.display_name ?? a.email ?? '?').filter(Boolean);
  const visible = attendeeNames.slice(0, 3);
  const overflow = attendeeNames.length - visible.length;

  return (
    <article className="preview-card calendar">
      <div className="preview-card-head">
        <span className="preview-card-kind"><CalendarDays size={13} /> Meeting</span>
        <ScopeBadge scope={obs.scope} />
      </div>
      <h3 className="preview-card-title">{c.title ?? 'Untitled event'}</h3>
      {c.start && <div className="preview-card-meta">{fmtDateRange(c.start, c.end)}</div>}
      {visible.length > 0 && (
        <div className="preview-card-row"><Users size={12} /><span>{visible.join(', ')}{overflow > 0 ? `, +${overflow}` : ''}</span></div>
      )}
      {c.location && <div className="preview-card-row"><MapPin size={12} /><span>{c.location}</span></div>}
      {c.meeting_link && <div className="preview-card-row"><LinkIcon size={12} /><span className="preview-card-link">{c.meeting_link}</span></div>}
      {(c.attached_files ?? []).length > 0 && (
        <div className="preview-card-row"><Paperclip size={12} /><span>{(c.attached_files ?? []).map(a => a.title ?? a.file_id).filter(Boolean).join(', ')}</span></div>
      )}
      {c.description && <p className="preview-card-snippet">{truncate(c.description, 180)}</p>}
      <IdentityHooksFooter hooks={obs.identity_hooks} />
    </article>
  );
}

function DocumentPreviewCard({ obs }: { obs: ObservationPreview }) {
  const c = obs.content as {
    file_name?: string;
    file_url?: string;
    mime_type?: string;
    owner?: string;
    last_modified?: string;
    shared_with?: string[];
    summary?: string;
    text?: string;
    type?: string;
  };
  const kind = c.mime_type?.includes('document') ? 'Doc'
    : c.mime_type?.includes('spreadsheet') ? 'Sheet'
    : c.mime_type?.includes('presentation') ? 'Slides'
    : c.mime_type === 'application/pdf' ? 'PDF'
    : 'File';

  return (
    <article className="preview-card document">
      <div className="preview-card-head">
        <span className="preview-card-kind"><FileText size={13} /> {kind}</span>
        <ScopeBadge scope={obs.scope} />
      </div>
      <h3 className="preview-card-title">{c.file_name ?? 'Untitled'}</h3>
      <div className="preview-card-meta">
        {c.owner ?? 'unknown owner'}
        {c.last_modified && ` · modified ${relativeTime(c.last_modified)}`}
      </div>
      {(c.shared_with ?? []).length > 0 && (
        <div className="preview-card-row"><Users size={12} /><span>Shared with {(c.shared_with ?? []).slice(0, 3).join(', ')}{(c.shared_with ?? []).length > 3 ? ` +${(c.shared_with ?? []).length - 3}` : ''}</span></div>
      )}
      {c.summary && <p className="preview-card-snippet">{truncate(c.summary, 220)}</p>}
      {!c.summary && c.text && <p className="preview-card-snippet">{truncate(c.text, 220)}</p>}
      {c.type === 'document_metadata' && !c.summary && !c.text && (
        <p className="preview-card-snippet preview-card-metadata-only">Metadata only — content not captured.</p>
      )}
      <IdentityHooksFooter hooks={obs.identity_hooks} />
    </article>
  );
}

function ScopeBadge({ scope }: { scope: string }) {
  return <span className="preview-card-scope" title={scope}>scope: {shortScope(scope)}</span>;
}

function IdentityHooksFooter({ hooks }: { hooks: { emails: string[]; file_ids: string[] } }) {
  const has = hooks.emails.length > 0 || hooks.file_ids.length > 0;
  if (!has) return null;
  return (
    <div className="preview-card-hooks" title="Stable identity hooks REFLECT will use to link this with other sources">
      {hooks.emails.length > 0 && <span>{hooks.emails.length} {hooks.emails.length === 1 ? 'person' : 'people'}</span>}
      {hooks.file_ids.length > 0 && <span>· {hooks.file_ids.length} doc {hooks.file_ids.length === 1 ? 'link' : 'links'}</span>}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n).trimEnd()}…`;
}

function relativeTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const day = 24 * 60 * 60 * 1000;
    if (diff < 60_000) return 'just now';
    if (diff < 60 * 60_000) return `${Math.round(diff / 60_000)}m ago`;
    if (diff < day) return `${Math.round(diff / (60 * 60_000))}h ago`;
    if (diff < 7 * day) return `${Math.round(diff / day)}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch { return iso; }
}
