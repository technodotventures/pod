/**
 * Owner-facing detail panel for one paired agent (actor_id). Shows:
 *   - connection_grants for that actor (with per-grant revoke)
 *   - last N audit entries (success + error + denial)
 *   - pending grant requests from the actor (with approve/deny)
 *
 * Drop into the Connections > Agents tab next to the selected-actor handler.
 *   <AgentGrantsPanel token={token} actorId={selectedActorId} onChange={() => ...} />
 *
 * Self-contained: fetches its own data from /pod/connection-grants*,
 * /pod/connection-grants/requests, and /pod/connection-grants/audit.
 */

import * as React from 'react';
import { CheckCircle2, ShieldOff, XCircle, AlertCircle, Loader2, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { deleteJson, getJson, postJson } from './api';

interface ConnectionGrant {
  id: string;
  actor_id: string;
  service_id: string;
  tool_pattern: string;
  expires_at: number | null;
  revoked_at: string | null;
  created_at: string;
  created_by: string;
  note: string | null;
}

interface ConnectionGrantRequest {
  id: string;
  actor_id: string;
  service_id: string;
  tool_pattern: string;
  reason: string | null;
  requested_expires_at: number | null;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
}

interface McpCallAuditEntry {
  id: string;
  actor_id: string;
  service_id: string;
  tool_name: string;
  args_summary: string | null;
  status: 'ok' | 'error';
  error_kind: string | null;
  duration_ms: number;
  grant_id: string | null;
  caller_kind: 'owner' | 'client' | 'unauthenticated';
  observed_at: string;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function AgentGrantsPanel({ token, actorId, onChange }: { token: string; actorId: string; onChange?: () => void }) {
  const [grants, setGrants] = React.useState<ConnectionGrant[] | null>(null);
  const [requests, setRequests] = React.useState<ConnectionGrantRequest[] | null>(null);
  const [audit, setAudit] = React.useState<McpCallAuditEntry[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const [grantsResp, reqResp, auditResp] = await Promise.all([
      getJson<{ grants: ConnectionGrant[] }>(`/pod/connection-grants?actor_id=${encodeURIComponent(actorId)}`, token).catch(() => ({ grants: [] })),
      getJson<{ requests: ConnectionGrantRequest[] }>(`/pod/connection-grants/requests?status=pending&actor_id=${encodeURIComponent(actorId)}`, token).catch(() => ({ requests: [] })),
      getJson<{ calls: McpCallAuditEntry[] }>(`/pod/connection-grants/audit?actor_id=${encodeURIComponent(actorId)}&limit=20`, token).catch(() => ({ calls: [] })),
    ]);
    setGrants(grantsResp.grants);
    setRequests(reqResp.requests);
    setAudit(auditResp.calls);
  }, [token, actorId]);

  React.useEffect(() => { void load(); }, [load]);

  async function revoke(grantId: string) {
    setBusyId(grantId); setMsg(null);
    try {
      await deleteJson(`/pod/connection-grants/${grantId}`, token);
      await load();
      onChange?.();
    } catch (err) {
      setMsg(`Revoke failed: ${(err as Error).message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function resolveRequest(requestId: string, action: 'approve' | 'deny') {
    setBusyId(requestId); setMsg(null);
    try {
      await postJson(`/pod/connection-grants/requests/${requestId}/${action}`, token, {});
      await load();
      onChange?.();
    } catch (err) {
      setMsg(`${action} failed: ${(err as Error).message}`);
    } finally {
      setBusyId(null);
    }
  }

  if (grants === null || requests === null || audit === null) {
    return <div className="agent-grants-panel-loading"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  }

  return (
    <div className="agent-grants-panel">
      {msg && <div className="agent-grants-panel-msg">{msg}</div>}

      {/* Pending requests — needs owner action */}
      {requests.length > 0 && (
        <section className="agent-grants-panel-section">
          <header className="agent-grants-panel-section-header">
            <AlertCircle size={13} />
            <h4>Pending requests</h4>
            <Badge variant="outline">{requests.length}</Badge>
          </header>
          <ul className="agent-grants-panel-list">
            {requests.map(req => (
              <li key={req.id} className="agent-grants-panel-request">
                <div className="agent-grants-panel-request-meta">
                  <code>{req.tool_pattern}</code> on <strong>{req.service_id}</strong>
                  <span className="agent-grants-panel-when">· {relTime(req.created_at)}</span>
                </div>
                {req.reason && <p className="agent-grants-panel-request-reason">"{req.reason}"</p>}
                <div className="agent-grants-panel-request-actions">
                  <Button size="sm" variant="ghost" disabled={busyId !== null} onClick={() => resolveRequest(req.id, 'deny')}>Deny</Button>
                  <Button size="sm" disabled={busyId !== null} onClick={() => resolveRequest(req.id, 'approve')}>Approve</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Active connection grants */}
      <section className="agent-grants-panel-section">
        <header className="agent-grants-panel-section-header">
          <h4>Connection grants</h4>
          <Badge variant="outline">{grants.length}</Badge>
        </header>
        {grants.length === 0 ? (
          <p className="agent-grants-panel-empty">No connection grants. {actorId} cannot call any external integrations yet.</p>
        ) : (
          <ul className="agent-grants-panel-list">
            {grants.map(grant => {
              const expired = grant.expires_at !== null && grant.expires_at <= Date.now();
              const revoked = !!grant.revoked_at;
              const status = revoked ? 'revoked' : expired ? 'expired' : 'active';
              return (
                <li key={grant.id} className={`agent-grants-panel-grant agent-grants-panel-grant-${status}`}>
                  <div className="agent-grants-panel-grant-row">
                    <div className="agent-grants-panel-grant-meta">
                      <code>{grant.tool_pattern}</code> on <strong>{grant.service_id}</strong>
                      {status === 'revoked' && <Badge variant="destructive">Revoked</Badge>}
                      {status === 'expired' && <Badge variant="outline">Expired</Badge>}
                      {status === 'active' && <Badge>Active</Badge>}
                    </div>
                    {!revoked && (
                      <Button size="sm" variant="ghost" disabled={busyId !== null} onClick={() => revoke(grant.id)}>
                        <ShieldOff size={12} /> Revoke
                      </Button>
                    )}
                  </div>
                  <div className="agent-grants-panel-grant-detail">
                    <span><Clock size={10} /> created {relTime(grant.created_at)}</span>
                    {grant.expires_at && <span>· expires {new Date(grant.expires_at).toLocaleString()}</span>}
                    {grant.note && <span>· {grant.note}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recent audit — read-only */}
      <section className="agent-grants-panel-section">
        <header className="agent-grants-panel-section-header">
          <h4>Recent activity</h4>
          <Badge variant="outline">{audit.length}</Badge>
        </header>
        {audit.length === 0 ? (
          <p className="agent-grants-panel-empty">No tool calls recorded yet.</p>
        ) : (
          <ul className="agent-grants-panel-list">
            {audit.map(call => (
              <li key={call.id} className={`agent-grants-panel-audit agent-grants-panel-audit-${call.status}`}>
                <div className="agent-grants-panel-audit-row">
                  {call.status === 'ok' ? <CheckCircle2 size={12} className="agent-grants-panel-audit-ok" /> : <XCircle size={12} className="agent-grants-panel-audit-err" />}
                  <code>{call.tool_name}</code>
                  <span className="agent-grants-panel-when">· {relTime(call.observed_at)}</span>
                  <span className="agent-grants-panel-duration">· {call.duration_ms}ms</span>
                  {call.error_kind && <Badge variant="outline">{call.error_kind}</Badge>}
                </div>
                {call.args_summary && <div className="agent-grants-panel-audit-args">args: <code>{call.args_summary}</code></div>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
