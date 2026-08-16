export interface ActivityConflictClaim {
  claim_id: string;
  subject_id: string;
  subject_name: string;
  predicate: string;
  object: { type: string; value: unknown };
  scope: string;
  status: 'contested';
  contested_by: string[];
  epistemic_tag: string;
  confidence: number;
  version: number;
  created_at: string;
  valid_at: string;
  invalid_at: string | null;
  provenance: {
    origin: 'deterministic' | 'model' | 'user';
    observation_ids: string[];
    model_id?: string;
  };
}

export interface ActivityConflict {
  id: string;
  subject_id: string;
  subject_name: string;
  predicate: string;
  scope: string;
  claims: ActivityConflictClaim[];
}

export interface ConflictResolutionBody {
  actor_id: string;
  event_id: string;
  selected_claim_id: string;
  operation_id: string;
  reason: string;
}

export function activityConflictFromEvent(event: {
  type: string;
  content?: unknown;
}): ActivityConflict | null {
  if (event.type !== 'memory_conflict_detected') return null;
  const content = asRecord(event.content);
  const conflict = asRecord(content?.['conflict']);
  if (
    !conflict
    || typeof conflict['id'] !== 'string'
    || typeof conflict['subject_id'] !== 'string'
    || typeof conflict['subject_name'] !== 'string'
    || typeof conflict['predicate'] !== 'string'
    || typeof conflict['scope'] !== 'string'
    || !Array.isArray(conflict['claims'])
    || conflict['claims'].length < 2
    || !conflict['claims'].every(isConflictClaim)
  ) {
    return null;
  }
  return conflict as unknown as ActivityConflict;
}

export function buildConflictResolutionBody(input: {
  actorId: string;
  eventId: string;
  selectedClaimId: string;
  operationId: string;
  reason: string;
}): ConflictResolutionBody {
  return {
    actor_id: input.actorId,
    event_id: input.eventId,
    selected_claim_id: input.selectedClaimId,
    operation_id: input.operationId,
    reason: input.reason,
  };
}

export function formatActivityConflictValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isConflictClaim(value: unknown): value is ActivityConflictClaim {
  const claim = asRecord(value);
  const object = asRecord(claim?.['object']);
  const provenance = asRecord(claim?.['provenance']);
  return !!claim
    && typeof claim['claim_id'] === 'string'
    && typeof claim['subject_id'] === 'string'
    && typeof claim['subject_name'] === 'string'
    && typeof claim['predicate'] === 'string'
    && !!object
    && typeof object['type'] === 'string'
    && typeof claim['scope'] === 'string'
    && Array.isArray(claim['contested_by'])
    && typeof claim['confidence'] === 'number'
    && Number.isInteger(claim['version'])
    && typeof claim['created_at'] === 'string'
    && typeof claim['valid_at'] === 'string'
    && (claim['invalid_at'] === null || typeof claim['invalid_at'] === 'string')
    && !!provenance
    && typeof provenance['origin'] === 'string'
    && Array.isArray(provenance['observation_ids']);
}
