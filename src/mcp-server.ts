import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { pathToFileURL } from 'node:url';
import * as z from 'zod/v4';

import { getPodJson, loadCoffeePodMcpEnv, postPodJson, type CoffeePodMcpEnv } from './mcp/pod-api.js';
import { deterministicOperationId, freshOperationId } from './services/sidecar-framework.js';

const jsonObjectSchema = z.record(z.string(), z.unknown());
const operationIdSchema = z.string()
  .regex(/^op_[0-9A-HJKMNP-TV-Z]{26}$/)
  .optional()
  .describe('Optional idempotency ID. Pod generates a valid ULID when omitted.');

function mcpOperationId(input: {
  actor_id: string;
  operation_id?: string;
  idempotency_key?: string;
  source_id?: string;
}): string {
  if (input.operation_id) return input.operation_id;
  const stableKey = input.idempotency_key?.trim() || input.source_id?.trim();
  return stableKey
    ? deterministicOperationId(input.actor_id, stableKey)
    : freshOperationId();
}

function textResult(payload: unknown): { content: Array<{ type: 'text'; text: string }>; structuredContent?: Record<string, unknown> } {
  const structuredContent = typeof payload === 'object' && payload !== null
    ? payload as Record<string, unknown>
    : undefined;
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent,
  };
}

function objectPayload(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function registerJsonTool<Input extends z.ZodTypeAny>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: Input,
  handler: (input: z.infer<Input>) => Promise<unknown>,
): void {
  server.registerTool(
    name,
    { description, inputSchema } as any,
    async (input: unknown) => textResult(await handler(input as z.infer<Input>)),
  );
}

export interface CoffeePodMcpServerOptions {
  env?: CoffeePodMcpEnv;
  actorId?: string;
}

export function createCoffeePodMcpServer(options: CoffeePodMcpServerOptions = {}): McpServer {
  const env = options.env ?? loadCoffeePodMcpEnv();
  const actorInstruction = options.actorId
    ? `Your Pod actor_id is ${options.actorId}. Use exactly this value for every actor_id field.`
    : 'Use the actor_id issued in your Pod connection invite for every actor_id field.';
  const server = new McpServer({
    name: 'coffee-pod',
    version: '0.1.0',
  }, {
    instructions: [
      'Pod is the user\'s memory layer. Use it as a loop:',
      '1. START of a task → call pod_context to load a ranked, cited context pack scoped to your brain. Prepend it to your reasoning.',
      '2. END of a task → call pod_observe to write back what you learned or decided (a durable summary), so the next session — yours or another agent\'s — starts smarter.',
      'Also available: pod_query/pod_recall for targeted lookups, reflect/revise/forget/explain to maintain memory. Respect the epistemic tags (fact vs inference vs opinion) and confidence in what you read.',
      actorInstruction,
    ].join('\n'),
  });

  registerJsonTool(server, 'pod_capabilities', 'Describe the Pod protocol and available capabilities.', z.object({}), async () => {
    return getPodJson(env, '/pod/capabilities');
  });

  registerJsonTool(server, 'pod_status', 'Get the current Pod status and Smartware runtime state.', z.object({}), async () => {
    return getPodJson(env, '/pod/status');
  });

  registerJsonTool(server, 'pod_query', 'Query Pod memory and optionally include the supporting observations.', z.object({
    actor_id: z.string(),
    actor_display_name: z.string().optional(),
    query: z.string(),
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
    limit: z.number().int().positive().optional(),
    include_sensitive: z.boolean().optional(),
    min_confidence: z.number().min(0).max(1).optional(),
    include_observations: z.boolean().optional(),
    use_llm: z.boolean().optional(),
    model_mode: z.enum(['auto', 'fast', 'deep']).optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/query', input);
  });

  registerJsonTool(server, 'pod_recall', 'RECALL knowledge from compiled memory and indexed observations. Supports inline and file_reference delivery.', z.object({
    actor_id: z.string(),
    actor_display_name: z.string().optional(),
    query: z.union([z.string(), jsonObjectSchema]),
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
    depth: z.enum(['oneline', 'paragraph', 'full']).optional(),
    resolution: z.object({
      max_results: z.number().int().positive().optional(),
      include_stale: z.boolean().optional(),
      min_confidence: z.enum(['high', 'medium', 'low']).optional(),
    }).optional(),
    delivery_mode: z.enum(['inline', 'file_reference']).optional(),
    include_observations: z.boolean().optional(),
    include_external_mcp: z.boolean().optional(),
    use_llm: z.boolean().optional(),
    model_mode: z.enum(['auto', 'fast', 'deep']).optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/recall', input);
  });

  registerJsonTool(server, 'pod_context',
    'Assemble a ranked, provenance-tagged CONTEXT PACK to prepend to your prompt. It resolves your brain and returns applicable experience lessons before relevant claims, all within your memory view and token budget. Call this at the start of a task before answering the user.',
    z.object({
      query: z.string().optional().describe('What you need context about. Omit for recent/salient memory.'),
      scope: z.union([z.string(), z.array(z.string())]).optional().describe('Scope alias, resolved scope ID, or "all". Intersected with your brain view; never widens it.'),
      agent_id: z.string().optional().describe('Resolve this brain explicitly (usually inferred from your token).'),
      token_budget: z.number().int().positive().optional().describe('Max tokens for the pack. Falls back to your brain budget.'),
      task: z.object({
        key: z.string().optional().describe('Stable task or workflow key shared across harnesses.'),
        goal: z.string().optional(),
        environment: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }).optional().describe('Structured task identity used to retrieve prior lessons deterministically.'),
      retrieval_mode: z.enum(['always', 'auto', 'never']).optional()
        .describe('Memory admission policy. Defaults to always; auto skips only clearly self-contained requests.'),
      min_confidence: z.number().min(0).max(1).optional(),
      epistemic: z.array(z.string()).optional().describe('Restrict to these tags: fact, inference, opinion, stale.'),
      include_sensitive: z.boolean().optional(),
      include_stale: z.boolean().optional(),
      source_types: z.array(z.enum(['claim', 'profile', 'lesson', 'conversation'])).optional()
        .describe('Restrict retrieval before candidate generation and token packing.'),
    }), async (input) => {
      return postPodJson(env, '/pod/context', input);
    });

  registerJsonTool(server, 'pod_search_evidence',
    'Search Pod and return only normalized, cited evidence rows. This is a retrieval primitive: it performs no answer synthesis and stays inside the calling agent\'s authorized memory view.',
    z.object({
      actor_id: z.string(),
      query: z.string(),
      scope: z.union([z.string(), z.array(z.string())]).optional(),
      limit: z.number().int().min(1).max(50).optional(),
      token_budget: z.number().int().positive().optional(),
      min_confidence: z.number().min(0).max(1).optional(),
      epistemic: z.array(z.string()).optional(),
      include_sensitive: z.boolean().optional(),
      include_stale: z.boolean().optional(),
      source_types: z.array(z.enum([
        'claim', 'observation', 'object', 'external', 'profile', 'lesson', 'conversation', 'expertise',
      ])).optional(),
      detail: z.enum(['compact', 'full']).optional().describe('Compact evidence is the default; full includes complete provenance and ranking metadata.'),
    }), async (input) => {
      const response = objectPayload(await postPodJson(env, '/pod/context', {
        query: input.query,
        scope: input.scope,
        agent_id: input.actor_id,
        token_budget: input.token_budget,
        min_confidence: input.min_confidence,
        epistemic: input.epistemic,
        include_sensitive: input.include_sensitive,
        include_stale: input.include_stale,
        source_types: input.source_types,
      }));
      const requestedTypes = new Set<string>(input.source_types ?? []);
      const fullEvidence = (Array.isArray(response['evidence']) ? response['evidence'] : [])
        .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
        .filter(row => requestedTypes.size === 0 || requestedTypes.has(String(row['type'])))
        .slice(0, input.limit ?? 20);
      const evidence = input.detail === 'full'
        ? fullEvidence
        : fullEvidence.map(row => {
            const provenance = objectPayload(row['provenance']);
            const ranking = objectPayload(row['ranking']);
            return {
              id: row['id'],
              type: row['type'],
              text: row['text'],
              scope: row['scope'],
              confidence: ranking['confidence'] ?? null,
              observation_ids: provenance['observation_ids'] ?? [],
            };
          });
      return {
        query: input.query,
        scopes_read: response['scopes_read'] ?? [],
        retrieval: response['retrieval'] ?? {},
        evidence,
      };
    });

  registerJsonTool(server, 'pod_search_conversations',
    'Search source-backed conversation projections and return question, resolution, participants, and original observation citations without synthesizing an answer.',
    z.object({
      actor_id: z.string(),
      query: z.string(),
      scope: z.union([z.string(), z.array(z.string())]).optional(),
      limit: z.number().int().min(1).max(20).optional(),
      token_budget: z.number().int().positive().optional(),
    }), async (input) => {
      const response = objectPayload(await postPodJson(env, '/pod/context', {
        query: input.query,
        scope: input.scope,
        agent_id: input.actor_id,
        token_budget: input.token_budget,
      }));
      const limit = input.limit ?? 8;
      return {
        query: input.query,
        scopes_read: response['scopes_read'] ?? [],
        conversations: (Array.isArray(response['conversations']) ? response['conversations'] : []).slice(0, limit),
        evidence: (Array.isArray(response['evidence']) ? response['evidence'] : [])
          .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null && row['type'] === 'conversation')
          .slice(0, limit),
      };
    });

  registerJsonTool(server, 'pod_who_knows',
    'Find people or agents with demonstrated expertise on a topic. Rankings require cited resolutions, substantive contributions, or successfully validated lessons; profile claims are not enough.',
    z.object({
      actor_id: z.string(),
      query: z.string(),
      scope: z.string().optional(),
      scopes: z.array(z.string()).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }), async (input) => {
      return postPodJson(env, '/pod/expertise', input);
    });

  registerJsonTool(server, 'pod_spawn_subagent',
    'Spawn a SUBAGENT with a narrower brain than yours. Its memory view is intersected with yours (it can never see more than you), its trust tier drops a notch, and its budget is capped at yours. Returns a token the child uses with pod_context. Use for delegated work you want scoped tightly. When the child finishes, have it pod_observe a summary so its findings return to shared memory.',
    z.object({
      name: z.string().describe('A short name for the subagent, e.g. "researcher".'),
      persona: z.string().optional().describe('The child\'s self-concept. Defaults to inheriting yours.'),
      scopes: z.array(z.string()).optional().describe('Requested scope view — intersected with yours. Defaults to inheriting your view.'),
      context_budget: z.number().int().positive().optional().describe('Capped at your budget.'),
      model: z.string().optional(),
    }), async (input) => {
      return postPodJson(env, '/pod/agents/spawn', input);
    });

  registerJsonTool(server, 'pod_observe', 'Write an observation into Pod memory.', z.object({
    actor_id: z.string(),
    operation_id: operationIdSchema,
    actor_display_name: z.string().optional(),
    type: z.enum([
      'message', 'file', 'meeting', 'preference', 'decision', 'tool_output', 'feedback', 'system',
      'agent_run_started', 'agent_run_completed', 'workflow_run_started', 'workflow_run_completed',
      'task_created', 'task_completed',
    ]).optional(),
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
    idempotency_key: z.string().optional(),
    content: z.union([z.string(), jsonObjectSchema]),
    content_format: z.enum(['text/markdown', 'text/plain', 'application/json']).optional(),
    visibility: z.enum(['private', 'scope', 'workspace', 'public']).optional(),
    source_id: z.string().optional(),
    informed_by: z.array(z.string()).optional(),
    sensitive: z.boolean().optional(),
    pod_object_id: z.string().optional(),
    pod_object_version: z.number().int().positive().optional(),
    pod_object_hash: jsonObjectSchema.optional(),
    observed_excerpt_hash: jsonObjectSchema.optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/observe', {
      ...input,
      operation_id: mcpOperationId(input),
    });
  });

  registerJsonTool(server, 'pod_record_experience',
    'Record a completed attempt or corrective feedback using Pod\'s typed experience envelope. Failed attempts plus linked feedback become source-backed lessons available to other authorized agents.',
    z.object({
      actor_id: z.string(),
      operation_id: operationIdSchema,
      idempotency_key: z.string().optional().describe('Stable retry key used to derive operation_id when it is omitted.'),
      source_id: z.string().optional().describe('Stable source event ID used to derive operation_id when it is omitted.'),
      actor_display_name: z.string().optional(),
      scope: z.string().optional(),
      scope_alias: z.string().optional(),
      visibility: z.enum(['private', 'scope', 'workspace', 'public']).optional(),
      event: z.enum(['attempt_finished', 'feedback_received']),
      task: z.object({
        key: z.string(),
        title: z.string().optional(),
        goal: z.string().optional(),
        environment: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
      attempt: z.object({
        id: z.string(),
        status: z.enum(['success', 'failure']),
        summary: z.string(),
        error_signature: z.string().optional(),
        applied_lesson_ids: z.array(z.string()).optional(),
        reflection: z.string().optional(),
        recommended_action: z.string().optional(),
        applies_when: z.string().optional(),
      }).optional(),
      attempt_id: z.string().optional(),
      feedback: z.string().optional(),
      recommended_action: z.string().optional(),
      applies_when: z.string().optional(),
    }), async (input) => {
      return postPodJson(env, '/pod/observe', {
        actor_id: input.actor_id,
        operation_id: mcpOperationId({
          ...input,
          source_id: input.source_id
            ?? (input.event === 'attempt_finished' ? input.attempt?.id : input.attempt_id)
            ?? undefined,
        }),
        actor_display_name: input.actor_display_name,
        scope: input.scope,
        scope_alias: input.scope_alias,
        visibility: input.visibility,
        source_id: input.source_id,
        type: input.event === 'attempt_finished' ? 'agent_run_completed' : 'feedback',
        content_format: 'application/json',
        content: {
          kind: 'experience_event',
          event: input.event,
          task: input.task,
          attempt: input.attempt,
          attempt_id: input.attempt_id,
          feedback: input.feedback,
          recommended_action: input.recommended_action,
          applies_when: input.applies_when,
        },
      });
    });

  registerJsonTool(server, 'pod_compile', 'Compile Pod memory into searchable pages.', z.object({
    actor_id: z.string(),
    operation_id: z.string(),
    actor_display_name: z.string().optional(),
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
    use_llm: z.boolean().optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/compile', input);
  });

  registerJsonTool(server, 'pod_reflect', 'REFLECT by compiling page or Self profile artifacts. Autonomous mode honors Pod REFLECT cadence settings.', z.object({
    actor_id: z.string(),
    operation_id: z.string(),
    actor_display_name: z.string().optional(),
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
    target: z.object({
      type: z.enum(['page', 'profile', 'scope']),
      id: z.string().optional(),
    }).optional(),
    mode: z.enum(['explicit', 'autonomous']).optional(),
    use_llm: z.boolean().optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/reflect', input);
  });

  registerJsonTool(server, 'pod_dream', 'Run one owner-authorized, derived-only maintenance inspection. This never schedules itself or rewrites canonical memory.', z.object({
    actor_id: z.string(),
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/dream', input);
  });

  registerJsonTool(server, 'pod_read', 'Read a compiled entity page or browse memory in a scope.', z.object({
    actor_id: z.string(),
    entity_id: z.string().optional(),
    entity_name: z.string().optional(),
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
    resolution: z.enum(['oneliner', 'paragraph', 'full']).optional(),
    include_sensitive: z.boolean().optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/read', input);
  });

  registerJsonTool(server, 'pod_explain', 'Trace provenance for a claim or entity.', z.object({
    actor_id: z.string(),
    claim_id: z.string().optional(),
    entity_id: z.string().optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/explain', input);
  });

  registerJsonTool(server, 'pod_correct', 'Correct an existing claim.', z.object({
    actor_id: z.string(),
    target_claim_id: z.string(),
    reason: z.enum(['changed', 'wrong', 'extraction_error', 'duplicate']),
    corrected_predicate: z.string().optional(),
    corrected_object_type: z.string().optional(),
    corrected_object_value: z.string().optional(),
    corrected_valid_from: z.string().nullable().optional(),
    corrected_valid_to: z.string().nullable().optional(),
    merge_into_claim_id: z.string().optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/correct', input);
  });

  registerJsonTool(server, 'pod_revise', 'REVISE an existing claim while preserving audit history.', z.object({
    actor_id: z.string(),
    operation_id: z.string(),
    claim_id: z.string(),
    new_state: z.object({
      content: z.string(),
      tag: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
    }),
    reason: z.string(),
  }), async (input) => {
    return postPodJson(env, '/pod/revise', input);
  });

  registerJsonTool(server, 'pod_forget', 'Forget a claim, observation, object, source, or collection.', z.object({
    actor_id: z.string(),
    operation_id: z.string(),
    target: z.object({
      type: z.enum(['claim', 'observation', 'object', 'source', 'collection']),
      id: z.string(),
    }),
    mode: z.enum(['tombstone', 'delete_object', 'redact_if_supported']),
    reason: z.string().optional(),
    redaction_reason: z.enum(['sensitive', 'requested_by_user', 'extraction_error', 'policy_violation']).optional(),
    cascade: z.boolean().optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/forget', input);
  });

  registerJsonTool(server, 'pod_access', 'ACCESS policy decision for a requester, operation, and scope.', z.object({
    requester: z.object({
      id: z.string(),
      type: z.enum(['person', 'agent', 'system']).optional(),
    }),
    operation: z.string(),
    scope: z.string(),
    target: z.string().optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/access', input);
  });

  registerJsonTool(server, 'pod_activity', 'List Pod activity events.', z.object({
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
    actor_id: z.string().optional(),
    type: z.union([z.string(), z.array(z.string())]).optional(),
    limit: z.number().int().positive().optional(),
    include_sensitive: z.boolean().optional(),
  }), async (input) => {
    const url = new URL('/pod/activity', env.baseUrl);
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, item);
        }
        continue;
      }
      url.searchParams.set(key, String(value));
    }
    return getPodJson(env, `${url.pathname}${url.search}`);
  });

  registerJsonTool(server, 'pod_session_start', 'Start a Pod work session.', z.object({
    actor_id: z.string(),
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
    goal: z.string(),
    session_id: z.string().optional(),
    workflow_id: z.string().optional(),
    query: z.string().optional(),
    limit: z.number().int().positive().optional(),
    task: z.object({
      key: z.string(),
      title: z.string().optional(),
      goal: z.string().optional(),
      environment: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }).optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/session/start', input);
  });

  registerJsonTool(server, 'pod_session_checkpoint', 'Record the minimum resumable state for a started session. Keep decisions and open loops selective; omit transcript text, duplicates, secrets, and unsupported speculation.', z.object({
    actor_id: z.string(),
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
    operation_id: z.string().regex(/^op_[0-9A-HJKMNP-TV-Z]{26}$/),
    checkpoint_id: z.string().regex(/^checkpoint_[a-f0-9]{64}$/),
    session_id: z.string().min(1).max(256),
    trigger: z.enum(['post_turn', 'pre_compaction', 'shutdown', 'manual']),
    generation: z.number().int().nonnegative(),
    summary: z.string().min(1).max(4_000),
    decisions: z.array(z.string().min(1).max(1_000)).max(20),
    open_loops: z.array(z.string().min(1).max(1_000)).max(20),
    source_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  }).refine(input => Boolean(input.scope || input.scope_alias), {
    message: 'scope or scope_alias is required',
  }), async (input) => {
    return postPodJson(env, '/pod/session/checkpoint', input);
  });

  registerJsonTool(server, 'pod_session_end', 'Summarize and close a Pod work session.', z.object({
    actor_id: z.string(),
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
    outcome: z.string(),
    session_id: z.string().optional(),
    workflow_id: z.string().optional(),
    decisions: z.array(z.string()).optional(),
    tasks: z.array(z.string()).optional(),
    experience: z.object({
      status: z.enum(['success', 'failure']),
      task: z.object({
        key: z.string(),
        title: z.string().optional(),
        goal: z.string().optional(),
        environment: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }).optional(),
      error_signature: z.string().optional(),
      applied_lesson_ids: z.array(z.string()).optional(),
      reflection: z.string().optional(),
      recommended_action: z.string().optional(),
      applies_when: z.string().optional(),
    }).optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/session/end', input);
  });

  registerJsonTool(server, 'pod_approvals', 'List proposed agent actions awaiting review.', z.object({
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
    limit: z.number().int().positive().optional(),
    include_resolved: z.boolean().optional(),
  }), async (input) => {
    const url = new URL('/pod/approvals', env.baseUrl);
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
    return getPodJson(env, `${url.pathname}${url.search}`);
  });

  registerJsonTool(server, 'pod_agent_action_propose', 'Propose an agent action requiring human review.', z.object({
    actor_id: z.string(),
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
    action_id: z.string().optional(),
    action_type: z.string(),
    title: z.string(),
    description: z.string().optional(),
    external_system: z.string().optional(),
    payload: jsonObjectSchema.optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/agent/action/propose', input);
  });

  registerJsonTool(server, 'pod_agent_action_approve', 'Approve a proposed agent action.', z.object({
    actor_id: z.string(),
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
    action_id: z.string(),
    reason: z.string().optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/agent/action/approve', input);
  });

  registerJsonTool(server, 'pod_agent_action_reject', 'Reject a proposed agent action.', z.object({
    actor_id: z.string(),
    scope: z.string().optional(),
    scope_alias: z.string().optional(),
    action_id: z.string(),
    reason: z.string().optional(),
  }), async (input) => {
    return postPodJson(env, '/pod/agent/action/reject', input);
  });

  /* ── Connections: permission-gated gateway to Klavis MCP servers ── */
  // When an MCP client (e.g. Coffee workspace agent) talks to Pod with a client token,
  // the underlying HTTP endpoints automatically enforce that actor's connection_grants.
  // Owner-token holders bypass enforcement (full access).

  registerJsonTool(server, 'pod_connections_list_services',
    'List integration services that expose tools via Klavis MCP servers.',
    z.object({}),
    async () => {
      // No dedicated services endpoint yet — read from /integrations and filter to MCP-supported.
      const { integrations } = await getPodJson<{ integrations: Array<{ id: string; name: string; status?: string; auth_type?: string }> }>(env, '/integrations');
      const mcpSupported = new Set(['google-drive', 'google-calendar', 'gmail', 'github', 'slack', 'notion', 'linear']);
      return {
        services: integrations.filter(i => mcpSupported.has(i.id)).map(i => ({
          id: i.id, name: i.name, status: i.status, auth_type: i.auth_type,
        })),
      };
    },
  );

  registerJsonTool(server, 'pod_connections_list_tools',
    'List MCP tools exposed by an integration. Caller sees only tools their grants permit (owner sees everything).',
    z.object({ service_id: z.string() }),
    async (input) => {
      return getPodJson(env, `/integrations/${encodeURIComponent(input.service_id)}/tools`);
    },
  );

  registerJsonTool(server, 'pod_connections_call_tool',
    'Invoke an MCP tool on an integration. Requires a connection_grant (or owner auth). Calls are recorded in the audit log.',
    z.object({
      service_id: z.string(),
      tool: z.string(),
      arguments: jsonObjectSchema.optional(),
    }),
    async (input) => {
      return postPodJson(env, `/integrations/${encodeURIComponent(input.service_id)}/tools/${encodeURIComponent(input.tool)}/call`, {
        arguments: input.arguments ?? {},
      });
    },
  );

  registerJsonTool(server, 'pod_connections_request_grant',
    'Request permission to call MCP tools on an integration. Creates a pending request the Pod owner can approve. Client tokens always request for their own actor; owner tokens may target any actor.',
    z.object({
      service_id: z.string(),
      tool_pattern: z.string().optional(),
      reason: z.string().optional(),
      actor_id: z.string().optional(),
      requested_expires_at: z.number().int().nullable().optional(),
    }),
    async (input) => {
      return postPodJson(env, '/pod/connection-grants/requests', input);
    },
  );

  return server;
}

async function main(): Promise<void> {
  const server = createCoffeePodMcpServer();
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Pod MCP server failed to start:', error);
    process.exit(1);
  });
};
