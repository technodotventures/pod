import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { SmartwareCore } from 'smartware';

import type { CoffeePodEnv } from '../config/env.js';
import {
  DEFAULT_WORKSPACE_ID,
  createWorkspace,
  deleteWorkspace,
  getDb,
  getWorkspace,
  listWorkspaces,
  patchWorkspace,
  workspaceContentCount,
  type PodWorkspace,
} from '../pod/db.js';
import { requireOwnerAuth } from '../security/auth.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';

export const WORKSPACE_HEADER = 'x-pod-workspace-id';

const MAX_WORKSPACE_NAME_LENGTH = 60;
const MAX_WORKSPACE_EMOJI_LENGTH = 8;

export function requestWorkspaceId(request: FastifyRequest): string {
  const value = request.headers[WORKSPACE_HEADER];
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_WORKSPACE_ID;
}

export function workspaceScopeId(env: CoffeePodEnv, workspaceId: string): string {
  return workspaceId === DEFAULT_WORKSPACE_ID
    ? `pod/${env.podId}/workspace`
    : `pod/${env.podId}/workspaces/${workspaceId}`;
}

export function ensureWorkspaceScope(core: SmartwareCore, env: CoffeePodEnv, workspaceId: string): string {
  if (workspaceId === DEFAULT_WORKSPACE_ID) return getPodProfile(core, env).scopes.workspace;
  const scope = workspaceScopeId(env, workspaceId);
  core.ensureScopes([{ id: scope, parent: null, visibility_default: 'workspace' }]);
  return scope;
}

function serializeWorkspace(env: CoffeePodEnv, workspace: PodWorkspace) {
  return {
    ...workspace,
    scope: workspaceScopeId(env, workspace.id),
  };
}

function validateWorkspaceValues(values: { name?: unknown; emoji?: unknown }, partial = false): string | null {
  if (!partial || values.name !== undefined) {
    if (typeof values.name !== 'string' || !values.name.trim()) return 'Workspace name is required.';
    if (values.name.trim().length > MAX_WORKSPACE_NAME_LENGTH) {
      return `Workspace name must be ${MAX_WORKSPACE_NAME_LENGTH} characters or fewer.`;
    }
  }
  if (values.emoji !== undefined) {
    if (typeof values.emoji !== 'string' || !values.emoji.trim()) return 'Workspace icon cannot be blank.';
    if (Array.from(values.emoji.trim()).length > MAX_WORKSPACE_EMOJI_LENGTH) {
      return 'Workspace icon is too long.';
    }
  }
  return null;
}

export async function registerWorkspaceRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);

  app.addHook('preValidation', async (request, reply) => {
    const explicit = request.headers[WORKSPACE_HEADER];
    if (explicit === undefined) return;
    const workspaceId = requestWorkspaceId(request);
    if (!getWorkspace(db, workspaceId)) {
      return reply.code(404).send({
        error: 'workspace_not_found',
        message: 'The selected workspace no longer exists.',
      });
    }
  });

  app.get('/pod/workspaces', {
    schema: { summary: 'List the owner’s Pod workspaces' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    return { workspaces: listWorkspaces(db).map(workspace => serializeWorkspace(env, workspace)) };
  });

  app.post('/pod/workspaces', {
    schema: { summary: 'Create a Pod workspace' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const body = request.body as { name?: unknown; emoji?: unknown };
    const validationError = validateWorkspaceValues(body);
    if (validationError) {
      return reply.code(400).send({ error: 'invalid_workspace', message: validationError });
    }
    const workspace = createWorkspace(db, {
      name: String(body.name),
      emoji: typeof body.emoji === 'string' ? body.emoji : undefined,
    });
    const core = await getSmartwareCore(env);
    ensureWorkspaceScope(core, env, workspace.id);
    return reply.code(201).send({ workspace: serializeWorkspace(env, workspace) });
  });

  app.patch('/pod/workspaces/:workspace_id', {
    schema: { summary: 'Rename a Pod workspace or change its icon' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { workspace_id: workspaceId } = request.params as { workspace_id: string };
    const body = request.body as { name?: unknown; emoji?: unknown };
    const validationError = validateWorkspaceValues(body, true);
    if (validationError) {
      return reply.code(400).send({ error: 'invalid_workspace', message: validationError });
    }
    const workspace = patchWorkspace(db, workspaceId, {
      name: typeof body.name === 'string' ? body.name : undefined,
      emoji: typeof body.emoji === 'string' ? body.emoji : undefined,
    });
    if (!workspace) return reply.code(404).send({ error: 'workspace_not_found', message: 'Workspace not found.' });
    return { workspace: serializeWorkspace(env, workspace) };
  });

  app.delete('/pod/workspaces/:workspace_id', {
    schema: { summary: 'Delete an empty, non-default Pod workspace' },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const { workspace_id: workspaceId } = request.params as { workspace_id: string };
    const workspace = getWorkspace(db, workspaceId);
    if (!workspace) return reply.code(404).send({ error: 'workspace_not_found', message: 'Workspace not found.' });
    if (workspace.is_default) {
      return reply.code(409).send({ error: 'default_workspace', message: 'The default workspace cannot be deleted.' });
    }
    const contentCount = workspaceContentCount(db, workspaceId);
    if (contentCount > 0) {
      return reply.code(409).send({
        error: 'workspace_not_empty',
        message: 'Move or remove this workspace’s memories before deleting it.',
        content_count: contentCount,
      });
    }
    deleteWorkspace(db, workspaceId);
    return { deleted: true };
  });
}
