import type { SmartwareConflictSnapshot } from 'smartware';

import type { RetrievalEvidenceCandidate } from './retrieval-evidence.js';

export type AskPodConflictClaim = SmartwareConflictSnapshot['claims'][number];

export interface AskPodConflict {
  id: string;
  subject_id: string;
  subject_name: string;
  predicate: string;
  scope: string;
  claims: AskPodConflictClaim[];
}

/** Build connected conflict groups from Smartware's explicit contestation links. */
export function groupAskPodConflicts(
  claims: SmartwareConflictSnapshot['claims'],
): AskPodConflict[] {
  const byId = new Map(claims.map(claim => [claim.claim_id, claim]));
  const adjacency = new Map<string, Set<string>>();
  for (const claim of claims) {
    const neighbours = adjacency.get(claim.claim_id) ?? new Set<string>();
    adjacency.set(claim.claim_id, neighbours);
    for (const otherId of claim.contested_by) {
      if (!byId.has(otherId)) continue;
      neighbours.add(otherId);
      const reverse = adjacency.get(otherId) ?? new Set<string>();
      reverse.add(claim.claim_id);
      adjacency.set(otherId, reverse);
    }
  }

  const visited = new Set<string>();
  const groups: AskPodConflict[] = [];
  for (const claimId of [...byId.keys()].sort()) {
    if (visited.has(claimId)) continue;
    const queue = [claimId];
    const members: AskPodConflictClaim[] = [];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const current = byId.get(currentId);
      if (current) members.push(current);
      for (const neighbour of adjacency.get(currentId) ?? []) {
        if (!visited.has(neighbour)) queue.push(neighbour);
      }
    }
    members.sort((left, right) => left.claim_id.localeCompare(right.claim_id));
    const first = members[0]!;
    groups.push({
      id: `conflict:${members.map(member => member.claim_id).join(':')}`,
      subject_id: first.subject_id,
      subject_name: first.subject_name,
      predicate: first.predicate,
      scope: first.scope,
      claims: members,
    });
  }
  return groups.sort((left, right) =>
    left.subject_name.localeCompare(right.subject_name)
    || left.predicate.localeCompare(right.predicate)
    || left.id.localeCompare(right.id));
}

export function askPodConflictEvidence(
  conflicts: AskPodConflict[],
): RetrievalEvidenceCandidate[] {
  return conflicts.flatMap(conflict => conflict.claims.map(claim => ({
    id: `claim:${claim.claim_id}`,
    type: 'claim' as const,
    title: claim.subject_name,
    snippet: `${claim.predicate}: ${formatConflictValue(claim.object.value)}`,
    claim_id: claim.claim_id,
    entity_id: claim.subject_id,
    observation_ids: claim.provenance.observation_ids,
    scope: claim.scope,
    score: 1,
    confidence: claim.confidence,
    retrievers: ['conflict_status'],
    resolver: { method: 'POST' as const, path: '/pod/explain' },
  })));
}

function formatConflictValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function conflictLabel(conflict: AskPodConflict): string {
  return `${conflict.subject_name} · ${conflict.predicate.replace(/_/g, ' ')}`;
}

export function buildAskPodConflictAnswer(
  conflicts: AskPodConflict[],
  markersByClaimId: Map<string, string>,
): string {
  if (conflicts.length === 0) {
    return 'I found no confirmed conflicting memories in the selected scope. Duplicate source views and corroborating evidence are not counted as conflicts.';
  }

  const lines = conflicts.map(conflict => {
    const values = conflict.claims.map(claim => {
      const marker = markersByClaimId.get(claim.claim_id);
      return `"${formatConflictValue(claim.object.value)}"${marker ? ` [${marker}]` : ''}`;
    });
    return `- **${conflictLabel(conflict)}** — ${values.join(' vs ')}`;
  });
  return [
    `I found ${conflicts.length} unresolved conflict${conflicts.length === 1 ? '' : 's'}:`,
    '',
    ...lines,
  ].join('\n');
}
