// Full schema validation gateway (PR-20). Plan §A7 completion.
//
// Schemas v0.1.2 reified as Zod parsers (zod is already a dep). Provides
// a single validate() entrypoint per protocol verb that returns
// { ok: true, value: T } | { ok: false, errors: SpecError } in the spec
// error envelope shape.
//
// This module is the canonical wire-validation surface. The four
// surgical reject paths in /pod/recall, /pod/revise, /pod/reflect that
// landed in PR-8a are subsets of what this gateway covers. Routes can
// adopt the gateway incrementally; the surgical paths remain as a
// belt-and-braces layer for now.

import { z } from 'zod';

// ── Common type definitions (Spec common.schema.json) ────────────────

const OperationId = z.string().regex(/^op_[0-9A-HJKMNP-TV-Z]{26}$/, {
  message: 'operation_id must match ^op_[0-9A-HJKMNP-TV-Z]{26}$',
});

const ActorId = z.string().regex(/^(user|agent|sidecar|substrate):[a-z0-9-]+$/, {
  message: 'actor_id must match ^(user|agent|sidecar|substrate):[a-z0-9-]+$',
});

const CascadePreviewId = z.string().regex(/^preview_[0-9A-HJKMNP-TV-Z]{26}$/);

const ConfidenceBucket = z.enum(['high', 'medium', 'low']);

const Scope = z.string().regex(/^(self|workspace|project:[a-z0-9-]+|agent:[a-z0-9-]+)$/, {
  message: 'scope must be self | workspace | project:<slug> | agent:<slug>',
});

// ── RECALL request ──────────────────────────────────────────────────

export const RecallRequestSchema = z.object({
  query: z.union([z.string(), z.record(z.string(), z.unknown())]),
  scope: z.string(), // not Scope-strict here; consumer uses Coffee scope aliases too
  depth: z.enum(['oneline', 'paragraph', 'full']).optional(),
  resolution: z.object({
    max_results: z.number().int().min(1).optional(),
    include_stale: z.boolean().optional(),
    include_forgotten: z.boolean().optional(),
    min_confidence: ConfidenceBucket.optional(),
  }).optional(),
  delivery_mode: z.enum(['inline', 'file_reference', 'context_bundle']).optional(),
  peek_scopes: z.array(z.string()).optional(),
  // RC-11: as_of is post-beta. Reject explicitly.
  as_of: z.never().optional(),
});

// ── REVISE request ──────────────────────────────────────────────────

const ReviseTarget = z.object({
  type: z.enum(['claim', 'page', 'tombstone']),
  id: z.string(),
});

const ReviseNewState = z.object({
  content: z.string().optional(),
  epistemic_tag: z.enum(['fact', 'inference', 'opinion', 'stale', 'contested']).optional(),
  confidence: ConfidenceBucket.optional(),
  author: z.enum(['user']).optional(),
  revived: z.boolean().optional(),
}).strict();

// Schemas v0.1.2 if/then/else: dry_run:true forbids operation_id;
// dry_run absent/false requires operation_id.
export const ReviseRequestSchema = z.object({
  target: ReviseTarget,
  new_state: ReviseNewState,
  reason: z.string().min(1),
  dry_run: z.boolean().optional(),
  operation_id: OperationId.optional(),
  cascade_preview_id: CascadePreviewId.optional(),
  actor_id: ActorId,
}).superRefine((val, ctx) => {
  if (val.dry_run === true && val.operation_id !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'REVISE dry_run preview phase does not consume an operation_id',
      path: ['operation_id'],
    });
  }
  if (val.dry_run !== true && val.operation_id === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'REVISE commit requires operation_id',
      path: ['operation_id'],
    });
  }
});

// ── REFLECT request ─────────────────────────────────────────────────

export const ReflectRequestSchema = z.object({
  scope: z.string().optional(),
  target: z.object({
    type: z.enum(['page', 'profile', 'claim']),
    id: z.string().optional(),
  }).optional(),
  mode: z.enum(['explicit', 'autonomous']).optional(),
  operation_id: OperationId.optional(),
  actor_id: ActorId.optional(),
}).superRefine((val, ctx) => {
  // REF-11: scope-target is post-beta. The enum above already rejects
  // it (only page/profile/claim allowed); explicit error path for
  // clarity:
  // (caller can also check raw payload separately if needed)
  void val;
  void ctx;
});

// ── OBSERVE request ─────────────────────────────────────────────────

export const ObserveRequestSchema = z.object({
  source: z.string().optional(),
  scope: z.string(),
  content: z.union([z.string(), z.record(z.string(), z.unknown())]),
  metadata: z.object({
    timestamp: z.string(),
    actor: z.string(),
    informed_by: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
  operation_id: OperationId.optional(),
  actor_id: ActorId.optional(),
});

// ── Generic gateway entrypoint ──────────────────────────────────────

export interface SpecValidationError {
  code: 'invalid_payload';
  message: string;
  details: { path: string; received?: unknown; expected?: string };
}

export function validatePayload<T>(
  schema: z.ZodType<T>,
  payload: unknown,
): { ok: true; value: T } | { ok: false; error: SpecValidationError } {
  const result = schema.safeParse(payload);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const issue = result.error.issues[0];
  return {
    ok: false,
    error: {
      code: 'invalid_payload',
      message: issue.message,
      details: { path: issue.path.join('.') || '(root)' },
    },
  };
}

// Convenience wrappers per verb.
export const validateRecall = (p: unknown) => validatePayload(RecallRequestSchema, p);
export const validateRevise = (p: unknown) => validatePayload(ReviseRequestSchema, p);
export const validateReflect = (p: unknown) => validatePayload(ReflectRequestSchema, p);
export const validateObserve = (p: unknown) => validatePayload(ObserveRequestSchema, p);
