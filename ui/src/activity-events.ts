export interface ActivityAttentionInput {
  id: string;
  type: string;
  process: string;
  title: string;
  detail?: string;
  observed_at: string;
  requires_attention?: boolean;
  resolved_at?: string | null;
  dismissed_at?: string | null;
  severity?: string;
  attention_reason?: string;
  attention_action_label?: string;
  attention_action?: ActivityAttentionAction;
}

export type ActivityAttentionAction = 'access' | 'connection' | 'conflict' | 'inspect';

const ATTENTION_PHRASES = [
  'action required',
  'approval required',
  'needs attention',
  'pending review',
  'requesting access',
  'permission request',
  'failed',
  'failure',
  'blocked',
  'conflict',
  'disconnected',
  'reconnect',
  'expired',
  'flagged',
];

function attentionSearchable(event: ActivityAttentionInput): string {
  // Recall titles include the user's query, so they are not system metadata.
  // Other legacy event titles remain part of the compatibility fallback.
  return event.type === 'recall_completed'
    ? event.type.toLowerCase()
    : `${event.type} ${event.title}`.toLowerCase();
}

/** Keep the fallback deliberately conservative until the API emits an explicit flag. */
export function activityNeedsAttention(event: ActivityAttentionInput): boolean {
  if (event.resolved_at || event.dismissed_at) return false;
  if (typeof event.requires_attention === 'boolean') return event.requires_attention;
  if (['critical', 'error'].includes((event.severity ?? '').toLowerCase())) return true;

  const searchable = attentionSearchable(event);
  return ATTENTION_PHRASES.some(phrase => searchable.includes(phrase));
}

export function activityAttentionPresentation(event: ActivityAttentionInput): { reason: string; actionLabel: string; action: ActivityAttentionAction } {
  if (event.attention_reason || event.attention_action_label) {
    return {
      reason: event.attention_reason ?? 'Pod needs your input',
      actionLabel: event.attention_action_label ?? 'View details',
      action: event.attention_action ?? 'inspect',
    };
  }

  const searchable = attentionSearchable(event);
  if (['requesting access', 'permission request', 'approval required', 'pending review'].some(phrase => searchable.includes(phrase))) {
    return { reason: 'Your approval is needed', actionLabel: 'Review access', action: 'access' };
  }
  if (['disconnected', 'reconnect', 'expired'].some(phrase => searchable.includes(phrase))) {
    return { reason: 'The connection needs you', actionLabel: 'Reconnect', action: 'connection' };
  }
  if (searchable.includes('conflict')) {
    return { reason: 'Choose which memory is current', actionLabel: 'Compare', action: 'conflict' };
  }
  if (['failed', 'failure', 'blocked'].some(phrase => searchable.includes(phrase))) {
    return { reason: 'This operation could not continue', actionLabel: 'Inspect issue', action: 'inspect' };
  }
  if (searchable.includes('flagged')) {
    return { reason: 'Pod has flagged this for you', actionLabel: 'Inspect', action: 'inspect' };
  }
  return { reason: 'Pod needs your input', actionLabel: 'View details', action: 'inspect' };
}

export function activityAttentionEvents<Event extends ActivityAttentionInput>(events: Event[]): Event[] {
  return events
    .filter(activityNeedsAttention)
    .sort((a, b) => new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime());
}
