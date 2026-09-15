// Endorsement cascade preview modal (PR-8 / B6).
//
// ⚠ WRITTEN-BUT-UNVERIFIED: this component compiles but hasn't been
// opened in a browser this session. Wire it in by importing into the
// agent-pages view (PR-13 / F4) and rendering when the user clicks
// "Endorse" on an agent-authored page.
//
// Spec behaviour (Pod Integration v0.1.1):
//   1. Component receives page_id + actor_id and POSTs to /pod/revise
//      with dry_run: true.
//   2. Displays the cascade summary — direct claims that will become
//      user-authored, plus shared claims also cited by other pages
//      with their page list ("also cited by: ...").
//   3. On confirm, POSTs again with dry_run: false, a fresh
//      operation_id, and the cascade_preview_id from step 1.
//   4. Handles 428 (cascade_required_ack / drift), 410 (preview_expired),
//      and 404 (preview_not_found) by transparently re-running dry-run
//      and re-prompting with a clear "re-confirm" framing.

import React, { useEffect, useState } from 'react';
import { createOperationId } from '../operation-id.js';

interface Cascade {
  page_id: string;
  claims_reauthored: string[];
  shared_claims: string[];
}

interface DryRunResponse {
  cascade_preview_id: string;
  cascade: Cascade;
}

interface CommitResponse {
  status: 'endorsed';
  page_id: string;
  cascade: Cascade;
  operation_id: string;
  commit_ts: string;
}

interface SpecError {
  error: {
    code: string;
    message: string;
    cascade_preview_id?: string;
    cascade?: Cascade;
  };
}

async function postRevise(
  fetchImpl: typeof fetch,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: DryRunResponse | CommitResponse | SpecError }> {
  const response = await fetchImpl('/pod/revise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return { ok: response.ok, status: response.status, body };
}

export interface EndorsementModalProps {
  open: boolean;
  pageId: string;
  actorId: string;
  reason?: string;
  onClose: () => void;
  onEndorsed?: (commit: CommitResponse) => void;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export function EndorsementModal({
  open,
  pageId,
  actorId,
  reason,
  onClose,
  onEndorsed,
  fetchImpl,
}: EndorsementModalProps): React.ReactElement | null {
  const f = fetchImpl ?? fetch;
  const [phase, setPhase] = useState<'loading' | 'preview' | 'committing' | 'done' | 'error'>('loading');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [cascade, setCascade] = useState<Cascade | null>(null);
  const [isReConfirm, setIsReConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const reasonValue = reason ?? 'Endorsing this page as my own thinking.';

  const runDryRun = React.useCallback(async () => {
    setPhase('loading');
    setErrorMessage(null);
    const result = await postRevise(f, {
      target: { type: 'page', id: pageId },
      new_state: { author: 'user' },
      reason: reasonValue,
      dry_run: true,
      actor_id: actorId,
    });
    if (!result.ok) {
      const err = (result.body as SpecError).error;
      setErrorMessage(err?.message ?? 'Dry-run failed.');
      setPhase('error');
      return;
    }
    const ok = result.body as DryRunResponse;
    setPreviewId(ok.cascade_preview_id);
    setCascade(ok.cascade);
    setPhase('preview');
  }, [actorId, f, pageId, reasonValue]);

  useEffect(() => {
    if (open) {
      void runDryRun();
    }
  }, [open, runDryRun]);

  const onConfirm = async () => {
    setPhase('committing');
    const result = await postRevise(f, {
      target: { type: 'page', id: pageId },
      new_state: { author: 'user' },
      reason: reasonValue,
      actor_id: actorId,
      operation_id: createOperationId(),
      cascade_preview_id: previewId,
    });
    if (result.status === 428) {
      // Drift or shared-claim ack — re-prompt with the fresh preview.
      const err = (result.body as SpecError).error;
      if (err.cascade_preview_id && err.cascade) {
        setPreviewId(err.cascade_preview_id);
        setCascade(err.cascade);
        setIsReConfirm(true);
        setPhase('preview');
        return;
      }
    }
    if (result.status === 410 || result.status === 404) {
      // Expired or consumed; re-run dry-run from scratch.
      setIsReConfirm(true);
      void runDryRun();
      return;
    }
    if (!result.ok) {
      setErrorMessage((result.body as SpecError).error?.message ?? 'Commit failed.');
      setPhase('error');
      return;
    }
    const ok = result.body as CommitResponse;
    setPhase('done');
    onEndorsed?.(ok);
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', padding: 24, borderRadius: 8, maxWidth: 560, width: '90%' }}>
        <h2>{isReConfirm ? 'Re-confirm endorsement' : 'Endorse this page'}</h2>
        {phase === 'loading' && <p>Computing cascade preview…</p>}
        {phase === 'error' && (
          <>
            <p style={{ color: 'crimson' }}>{errorMessage}</p>
            <button onClick={onClose}>Close</button>
          </>
        )}
        {phase === 'preview' && cascade && (
          <>
            <p>
              Endorsing this page will mark the following claims as your own:
            </p>
            <section>
              <h3>Direct sources ({cascade.claims_reauthored.length})</h3>
              <ul>
                {cascade.claims_reauthored.map((claim) => (
                  <li key={claim}>{claim}</li>
                ))}
              </ul>
            </section>
            {cascade.shared_claims.length > 0 && (
              <section>
                <h3>Shared with other pages ({cascade.shared_claims.length})</h3>
                <p style={{ fontSize: '0.9em', color: '#666' }}>
                  These claims also appear on other pages. Endorsing here makes them user-authored globally.
                </p>
                <ul>
                  {cascade.shared_claims.map((claim) => (
                    <li key={claim}>
                      <strong>{claim}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {isReConfirm && (
              <p style={{ background: '#fff3cd', padding: 8, borderRadius: 4, fontSize: '0.9em' }}>
                The cascade changed since you started. Please re-confirm.
              </p>
            )}
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose}>Cancel</button>
              <button onClick={onConfirm} style={{ background: '#2563eb', color: 'white', padding: '8px 16px', borderRadius: 4 }}>
                {isReConfirm ? 'Re-confirm endorsement' : 'Endorse'}
              </button>
            </div>
          </>
        )}
        {phase === 'committing' && <p>Committing endorsement…</p>}
        {phase === 'done' && (
          <>
            <p style={{ color: 'green' }}>Endorsement committed.</p>
            <button onClick={onClose}>Close</button>
          </>
        )}
      </div>
    </div>
  );
}
