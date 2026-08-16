export interface CoffeeClientGrant {
  client_id: string;
  client_name: string;
  pod_url: string;
  actor_id: string;
  grant_id: string;
  client_token: string;
  token_prefix: string;
  status: 'connected';
  created_at: string;
}

export interface CoffeeMeetingAttendee {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
}

export interface CoffeeMeetingDocument {
  id?: string;
  title: string;
  url?: string;
  text?: string;
}

export interface CoffeeMeetingInput {
  id: string;
  title: string;
  start_at?: string;
  end_at?: string;
  location?: string;
  url?: string;
  attendees?: CoffeeMeetingAttendee[];
  notes?: string;
  documents?: CoffeeMeetingDocument[];
}

export interface CoffeeMeetingSyncBody {
  actor_id: string;
  meetings: CoffeeMeetingInput[];
}

export interface CoffeeMeetingBriefBody {
  actor_id: string;
  query?: string;
  limit?: number;
}

export interface CoffeeMeetingCaptureBody {
  actor_id: string;
  notes: string;
  decisions?: string[];
  tasks?: string[];
  followups?: Array<{
    title: string;
    description?: string;
    to?: string;
  }>;
}

/**
 * A Pod-owned alias (for example `personal`) or an app-space key such as
 * `app:coffee`. The server resolves it against the current data-space catalog.
 */
export type PodScopeAlias = string;

export interface PodObserveBody {
  actor_id: string;
  operation_id: string;
  actor_display_name?: string;
  type?: 'message' | 'file' | 'meeting' | 'preference' | 'decision' | 'tool_output' | 'feedback' | 'system'
    | 'agent_run_started' | 'agent_run_completed' | 'workflow_run_started' | 'workflow_run_completed'
    | 'task_created' | 'task_completed';
  scope?: string;
  scope_alias?: PodScopeAlias;
  idempotency_key?: string;
  content: string | object;
  content_format?: 'text/markdown' | 'text/plain' | 'application/json';
  visibility?: 'private' | 'scope' | 'workspace' | 'public';
  source_id?: string;
  informed_by?: string[];
  sensitive?: boolean;
  pod_object_id?: string;
  pod_object_version?: number;
  pod_object_hash?: { hash_algorithm: string; hash_value: string };
  observed_excerpt_hash?: { hash_algorithm: string; hash_value: string };
}

export interface PodQueryContext {
  kind: 'map_selection' | 'doc_selection' | 'memory_selection';
  node_ids?: string[];
  object_ids?: string[];
  entity_ids?: string[];
  edges?: Array<{ id: string; source: string; target: string; label?: string }>;
  labels?: string[];
}

export interface PodQueryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface PodQueryBody {
  actor_id: string;
  actor_display_name?: string;
  query: string;
  scope?: string;
  scope_alias?: PodScopeAlias;
  limit?: number;
  include_sensitive?: boolean;
  min_confidence?: number;
  include_observations?: boolean;
  use_llm?: boolean;
  include_external_mcp?: boolean;
  model_mode?: 'auto' | 'fast' | 'deep';
  history?: PodQueryTurn[];
  context?: PodQueryContext;
  /** Explicit timeframe filter (ISO bounds, half-open [start, end)). When set,
   *  takes precedence over any temporal phrase parsed from the query text. */
  date_start?: string;
  date_end?: string;
  /** Human-readable timeframe label for LLM grounding (e.g. "Today"). */
  timeframe_label?: string;
}

export interface PodRecallBody {
  actor_id: string;
  actor_display_name?: string;
  query: string | object;
  scope?: string;
  scope_alias?: PodScopeAlias;
  depth?: 'oneline' | 'paragraph' | 'full';
  resolution?: {
    max_results?: number;
    include_stale?: boolean;
    min_confidence?: 'high' | 'medium' | 'low';
  };
  delivery_mode?: 'inline' | 'file_reference' | 'context_bundle';
  include_observations?: boolean;
  include_external_mcp?: boolean;
  use_llm?: boolean;
  model_mode?: 'auto' | 'fast' | 'deep';
}

export interface PodReflectBody {
  actor_id: string;
  operation_id: string;
  actor_display_name?: string;
  scope?: string;
  scope_alias?: PodScopeAlias;
  target?: {
    type: 'page' | 'profile' | 'scope';
    id?: string;
  };
  mode?: 'explicit' | 'autonomous';
  use_llm?: boolean;
}

export interface PodDreamBody {
  actor_id: string;
  scope?: string;
  scope_alias?: PodScopeAlias;
}

export interface PodReviseBody {
  actor_id: string;
  operation_id: string;
  claim_id: string;
  new_state: {
    content: string;
    tag?: string;
    confidence?: number;
  };
  reason: string;
}

export interface PodAccessBody {
  requester: {
    id: string;
    type?: 'person' | 'agent' | 'system';
  };
  operation: 'OBSERVE' | 'RECALL' | 'REFLECT' | 'WATCH' | 'REVISE' | 'FORGET' | 'ACCESS' | string;
  scope: string;
  target?: string;
}

export interface PodActivityQuery {
  scope?: string;
  scope_alias?: PodScopeAlias;
  actor_id?: string;
  type?: string | string[];
  limit?: number;
  include_sensitive?: boolean | string;
}

export interface PodSessionStartBody {
  actor_id: string;
  scope?: string;
  scope_alias?: PodScopeAlias;
  goal: string;
  session_id?: string;
  workflow_id?: string;
  query?: string;
  limit?: number;
  task?: {
    key: string;
    title?: string;
    goal?: string;
    environment?: string;
    tags?: string[];
  };
}

export interface PodSessionCheckpointBody {
  actor_id: string;
  scope?: string;
  scope_alias?: PodScopeAlias;
  operation_id: string;
  checkpoint_id: string;
  session_id: string;
  trigger: 'post_turn' | 'pre_compaction' | 'shutdown' | 'manual';
  generation: number;
  summary: string;
  decisions: string[];
  open_loops: string[];
  source_digest: string;
}

export interface PodSessionEndBody {
  actor_id: string;
  scope?: string;
  scope_alias?: PodScopeAlias;
  outcome: string;
  session_id?: string;
  workflow_id?: string;
  decisions?: string[];
  tasks?: string[];
  experience?: {
    status: 'success' | 'failure';
    task?: {
      key: string;
      title?: string;
      goal?: string;
      environment?: string;
      tags?: string[];
    };
    error_signature?: string;
    applied_lesson_ids?: string[];
    reflection?: string;
    recommended_action?: string;
    applies_when?: string;
  };
}

export interface PodAgentActionBody {
  actor_id: string;
  scope?: string;
  scope_alias?: PodScopeAlias;
  action_id?: string;
  action_type: string;
  title: string;
  description?: string;
  external_system?: string;
  payload?: object;
}

export interface PodAgentActionReviewBody {
  actor_id: string;
  scope?: string;
  scope_alias?: PodScopeAlias;
  action_id: string;
  reason?: string;
}

export interface PodApprovalQuery {
  scope?: string;
  scope_alias?: PodScopeAlias;
  limit?: number;
  include_resolved?: boolean | string;
}

export interface PodExplainBody {
  actor_id: string;
  claim_id?: string;
  entity_id?: string;
}

export interface PodCorrectBody {
  actor_id: string;
  target_claim_id: string;
  reason: 'changed' | 'wrong' | 'extraction_error' | 'duplicate';
  corrected_predicate?: string;
  corrected_object_type?: string;
  corrected_object_value?: string;
  corrected_valid_from?: string | null;
  corrected_valid_to?: string | null;
  merge_into_claim_id?: string;
}

export interface PodForgetBody {
  actor_id: string;
  operation_id: string;
  target: {
    type: 'claim' | 'observation' | 'object' | 'source' | 'collection';
    id: string;
  };
  mode: 'tombstone' | 'delete_object' | 'redact_if_supported';
  reason?: string;
  redaction_reason?: 'sensitive' | 'requested_by_user' | 'extraction_error' | 'policy_violation';
  cascade?: boolean;
}

export interface PodReadBody {
  actor_id: string;
  entity_id?: string;
  entity_name?: string;
  scope?: string;
  scope_alias?: PodScopeAlias;
  resolution?: 'oneliner' | 'paragraph' | 'full';
  include_sensitive?: boolean;
}

export interface PodEventBody {
  actor_id: string;
  source_app: string;
  event_type: string;
  object?: {
    id?: string;
    kind?: string;
    title?: string;
    content?: unknown;
    url?: string;
    metadata?: Record<string, unknown>;
  };
  text?: string;
  scope?: string;
  scope_alias?: PodScopeAlias;
  collection_id?: string;
  memory_policy?: {
    extract?: boolean;
    use_llm?: boolean;
    sensitive?: boolean;
    visibility?: 'private' | 'scope' | 'workspace' | 'public';
  };
}
