import * as React from 'react';
import {
  ArrowLeft,
  Check,
  GitCompareArrows,
  History,
  Loader2,
  Quote,
  ShieldCheck,
  X,
} from 'lucide-react';

import {
  buildConflictResolutionBody,
  formatActivityConflictValue,
  type ActivityConflict,
  type ActivityConflictClaim,
} from '../activity-conflicts';
import { createOperationId } from '../operation-id';

interface ConflictEvidence {
  app: string;
  actor: string;
  observed_at: string;
  content_preview: string;
}

interface ConflictResolverProps {
  eventId: string;
  conflict: ActivityConflict;
  authToken?: string;
  actorId: string;
  onBack: () => void;
  onClose: () => void;
  onResolved: () => void;
}

export function ConflictResolver({
  eventId,
  conflict,
  authToken,
  actorId,
  onBack,
  onClose,
  onResolved,
}: ConflictResolverProps) {
  const [selectedClaimId, setSelectedClaimId] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState('');
  const [evidence, setEvidence] = React.useState<Record<string, ConflictEvidence | null>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resolvedValue, setResolvedValue] = React.useState<string | null>(null);
  const selectedClaim = conflict.claims.find(claim => claim.claim_id === selectedClaimId) ?? null;
  const predicate = conflict.predicate.replace(/_/g, ' ');

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.all(conflict.claims.map(async (claim) => {
      try {
        const response = await fetch('/pod/explain', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ actor_id: actorId, claim_id: claim.claim_id }),
          signal: controller.signal,
        });
        if (!response.ok) return [claim.claim_id, null] as const;
        const payload = await response.json() as {
          claim?: {
            source_observation?: {
              app?: string;
              actor?: { display_name?: string };
              observed_at?: string;
              content_preview?: string;
            } | null;
            derived_observations?: Array<{
              app?: string;
              actor?: { display_name?: string };
              observed_at?: string;
              content_preview?: string;
            }>;
          };
        };
        const source = payload.claim?.source_observation ?? payload.claim?.derived_observations?.[0];
        return [claim.claim_id, source ? {
          app: source.app ?? 'Pod',
          actor: source.actor?.display_name ?? 'Unknown source',
          observed_at: source.observed_at ?? claim.valid_at,
          content_preview: source.content_preview ?? '',
        } : null] as const;
      } catch {
        return [claim.claim_id, null] as const;
      }
    })).then(entries => {
      if (!controller.signal.aborted) setEvidence(Object.fromEntries(entries));
    });
    return () => controller.abort();
  }, [actorId, authToken, conflict.claims]);

  async function resolveConflict(): Promise<void> {
    if (!selectedClaim) return;
    setSaving(true);
    setError(null);
    const value = formatActivityConflictValue(selectedClaim.object.value);
    const auditReason = reason.trim() || `Selected "${value}" as current during conflict review.`;
    try {
      const response = await fetch('/pod/conflicts/resolve', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(buildConflictResolutionBody({
          actorId,
          eventId,
          selectedClaimId: selectedClaim.claim_id,
          operationId: createOperationId(),
          reason: auditReason,
        })),
      });
      const payload = await response.json().catch(() => ({})) as {
        status?: 'resolved' | 'already_resolved';
        message?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? payload.message ?? `Could not resolve this conflict (${response.status})`);
      }
      setResolvedValue(value);
      window.setTimeout(onResolved, 900);
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : 'Could not resolve this conflict.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="activity-detail-panel activity-conflict-panel" aria-label={`Resolve conflict for ${conflict.subject_name}`}>
      <div className="activity-detail-inner conflict-resolver">
        <div className="conflict-resolver-scroll">
          <div className="inspector-top">
            <button type="button" className="activity-attention-back" onClick={onBack}>
              <ArrowLeft size={13} /> Attention
            </button>
            <button type="button" className="activity-detail-close" onClick={onClose} aria-label="Close conflict review">
              <X size={14} />
            </button>
          </div>

          <header className="conflict-resolver-header">
            <span className="conflict-resolver-eyebrow"><GitCompareArrows size={13} /> Resolve conflict</span>
            <h2>{conflict.subject_name}</h2>
            <p>Pod has more than one value for <strong>{predicate}</strong>. Choose what should be current.</p>
          </header>

          <div className="conflict-preservation-note">
            <History size={15} />
            <span>Nothing is deleted. Other versions stay in history with their sources.</span>
          </div>

          <div className="conflict-claim-group" role="radiogroup" aria-label="Competing memories">
            {conflict.claims.map((claim, index) => {
              const selected = claim.claim_id === selectedClaimId;
              const source = evidence[claim.claim_id];
              const evidenceLoaded = Object.prototype.hasOwnProperty.call(evidence, claim.claim_id);
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  key={claim.claim_id}
                  className={`conflict-claim-option${selected ? ' is-selected' : ''}`}
                  onClick={() => {
                    setSelectedClaimId(claim.claim_id);
                    setError(null);
                  }}
                >
                  <span className="conflict-claim-rail" aria-hidden="true">
                    <span className="conflict-claim-node">{selected ? <Check size={12} /> : index + 1}</span>
                  </span>
                  <span className="conflict-claim-card">
                    <span className="conflict-claim-card-top">
                      <span>{selected ? 'Current memory' : `Option ${index + 1}`}</span>
                      <small>{formatClaimDate(claim.valid_at)}</small>
                    </span>
                    <strong>{formatActivityConflictValue(claim.object.value)}</strong>
                    <span className="conflict-claim-meta">
                      {originLabel(claim)} · {Math.round(claim.confidence * 100)}% confidence · {claim.provenance.observation_ids.length} source{claim.provenance.observation_ids.length === 1 ? '' : 's'}
                    </span>
                    {source ? (
                      <span className="conflict-claim-evidence">
                        <Quote size={12} />
                        <span>
                          <em>{source.content_preview || 'Source content is available in Pod.'}</em>
                          <small>{source.app} · {source.actor} · {formatClaimDate(source.observed_at)}</small>
                        </span>
                      </span>
                    ) : evidenceLoaded ? (
                      <span className="conflict-claim-evidence is-loading">
                        <Quote size={12} /> Source details unavailable
                      </span>
                    ) : (
                      <span className="conflict-claim-evidence is-loading">
                        <Loader2 size={12} /> Loading source…
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="conflict-resolver-footer">
          {resolvedValue ? (
            <div className="conflict-resolved-state" role="status">
              <ShieldCheck size={18} />
              <span><strong>{resolvedValue}</strong> is now current</span>
            </div>
          ) : (
            <>
              {selectedClaim && (
                <div className="conflict-outcome-preview">
                  <span className="conflict-outcome-dot" />
                  <span>
                    <strong>{formatActivityConflictValue(selectedClaim.object.value)}</strong> becomes current
                    <small>{conflict.claims.length - 1} other version{conflict.claims.length === 2 ? '' : 's'} preserved in history</small>
                  </span>
                </div>
              )}
              <label className="conflict-reason-field">
                <span>Why is this current? <small>Optional</small></span>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Add a note for the memory history"
                />
              </label>
              {error && <p className="conflict-resolver-error" role="alert">{error}</p>}
              <div className="conflict-resolver-actions">
                <button type="button" className="conflict-decide-later" onClick={onBack} disabled={saving}>
                  Decide later
                </button>
                <button
                  type="button"
                  className="conflict-use-current"
                  disabled={!selectedClaim || saving}
                  onClick={() => void resolveConflict()}
                >
                  {saving ? <><Loader2 size={15} className="spin-inline" /> Updating…</> : selectedClaim ? <>Use this as current <Check size={15} /></> : 'Choose a memory'}
                </button>
              </div>
            </>
          )}
        </footer>
      </div>
    </aside>
  );
}

function originLabel(claim: ActivityConflictClaim): string {
  if (claim.provenance.origin === 'user') return 'Recorded by you';
  if (claim.provenance.origin === 'model') return 'Model-inferred';
  return 'Source-extracted';
}

function formatClaimDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unknown';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date);
}
