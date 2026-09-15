// F5 History view (PR-19). [WRITTEN-BUT-UNVERIFIED.]
//
// Filterable view of the canonical operations log. Backend:
// GET /pod/history?actor_id=&op=&since=&until=&artifact=&limit=.

import React, { useEffect, useState } from 'react';

interface OpLogEntry {
  operation_id: string;
  actor_id: string;
  timestamp: string;
  op: string;
  details?: Record<string, unknown>;
}

const OP_TYPES = [
  'observe', 'recall', 'reflect.explicit', 'reflect.auto', 'reflect.profile',
  'revise.claim', 'endorse', 'revive', 'forget',
  'watch.subscribe', 'watch.event',
  'access.allow', 'access.deny', 'guardian',
] as const;

export function HistoryView(): React.ReactElement {
  const [entries, setEntries] = useState<OpLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [actorFilter, setActorFilter] = useState('');
  const [opFilter, setOpFilter] = useState<string>('');
  const [artifactFilter, setArtifactFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = React.useCallback(async () => {
    const params = new URLSearchParams();
    if (actorFilter) params.set('actor_id', actorFilter);
    if (opFilter) params.set('op', opFilter);
    if (artifactFilter) params.set('artifact', artifactFilter);
    params.set('limit', '100');
    try {
      const response = await fetch(`/pod/history?${params}`);
      if (!response.ok) throw new Error(`${response.status}`);
      const body = await response.json() as { entries: OpLogEntry[]; total_matched: number };
      setEntries(body.entries);
      setTotal(body.total_matched);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [actorFilter, opFilter, artifactFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 24 }}>
      <h1>History</h1>
      <p style={{ color: '#666', fontSize: '0.9em' }}>
        Canonical operations log. Includes autonomous REFLECT silent returns and ACCESS denials.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          placeholder="actor_id (e.g. user:stevie)"
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          style={{ padding: 8, flex: 1, border: '1px solid #d1d5db', borderRadius: 4 }}
        />
        <select
          value={opFilter}
          onChange={(e) => setOpFilter(e.target.value)}
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }}
        >
          <option value="">all op types</option>
          {OP_TYPES.map((op) => <option key={op} value={op}>{op}</option>)}
        </select>
        <input
          placeholder="artifact (claim_id, page_id, ...)"
          value={artifactFilter}
          onChange={(e) => setArtifactFilter(e.target.value)}
          style={{ padding: 8, flex: 1, border: '1px solid #d1d5db', borderRadius: 4 }}
        />
        <button onClick={load} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', borderRadius: 4 }}>
          Refresh
        </button>
      </div>

      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      <p style={{ fontSize: '0.85em', color: '#666' }}>
        {entries.length} of {total} matching entries (newest first; bounded to 100).
      </p>

      <table style={{ width: '100%', fontSize: '0.9em', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ textAlign: 'left', padding: '8px 4px' }}>When</th>
            <th style={{ textAlign: 'left', padding: '8px 4px' }}>Op</th>
            <th style={{ textAlign: 'left', padding: '8px 4px' }}>Actor</th>
            <th style={{ textAlign: 'left', padding: '8px 4px' }}>Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.operation_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '6px 4px', whiteSpace: 'nowrap', color: '#666' }}>
                {new Date(entry.timestamp).toLocaleString()}
              </td>
              <td style={{ padding: '6px 4px', fontFamily: 'monospace' }}>{entry.op}</td>
              <td style={{ padding: '6px 4px', fontFamily: 'monospace' }}>{entry.actor_id}</td>
              <td style={{ padding: '6px 4px', fontFamily: 'monospace', fontSize: '0.8em', color: '#444' }}>
                {entry.details ? JSON.stringify(entry.details) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
