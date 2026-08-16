import type { FastifyInstance } from 'fastify';
import type { CoffeeClientGrant, CoffeeMeetingBriefBody, CoffeeMeetingCaptureBody, CoffeeMeetingInput, CoffeeMeetingSyncBody } from '../pod/types.js';
import type { CoffeePodEnv } from '../config/env.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { getDb, upsertCollection, upsertObject } from '../pod/db.js';
import { ensureAppDataSpace } from '../pod/data-spaces.js';
import { issueClientToken, listClientTokens, revokeClientToken } from '../security/client-tokens.js';
import { requireActorAuth, requireOwnerAuth } from '../security/auth.js';
import { syncArtifactMemory } from '../services/artifact-memory.js';

function stringifyMeeting(meeting: CoffeeMeetingInput): string {
  return [
    `Meeting: ${meeting.title}`,
    `Coffee meeting id: ${meeting.id}`,
    meeting.start_at ? `Starts: ${meeting.start_at}` : undefined,
    meeting.end_at ? `Ends: ${meeting.end_at}` : undefined,
    meeting.location ? `Location: ${meeting.location}` : undefined,
    meeting.url ? `URL: ${meeting.url}` : undefined,
    meeting.attendees?.length ? `Attendees: ${meeting.attendees.map(attendee => attendee.name ?? attendee.email ?? attendee.id).filter(Boolean).join(', ')}` : undefined,
    meeting.notes ? `Notes: ${meeting.notes}` : undefined,
    meeting.documents?.length ? `Documents: ${meeting.documents.map(document => document.title).join(', ')}` : undefined,
  ].filter(Boolean).join('\n');
}

function briefFromSnippets(meetingId: string, snippets: string[]): string {
  const context = snippets.length > 0
    ? snippets.map((snippet, index) => `${index + 1}. ${snippet}`).join('\n')
    : 'No prior Pod memory was found for this meeting yet.';

  return [
    `Meeting brief for Coffee meeting ${meetingId}`,
    '',
    'Relevant Pod context:',
    context,
    '',
    'Suggested agenda:',
    '1. Confirm the desired outcome.',
    '2. Review prior decisions and open commitments.',
    '3. Identify follow-up owners before the meeting ends.',
    '',
    'Risks/questions:',
    '- Check whether any proposed external action needs human approval.',
    '- Capture durable decisions and tasks after the meeting.',
  ].join('\n');
}

export async function registerCoffeeRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);
  app.get('/coffee/clients', {
    schema: {
      summary: 'List connected Coffee clients',
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    return { clients: await listClientTokens(env) };
  });

  app.post('/coffee/connect', {
    schema: {
      summary: 'Connect Coffee as an app-owned Pod data source',
      body: {
        type: 'object',
        properties: {
          client_id: { type: 'string' },
          client_name: { type: 'string' },
          pod_url: { type: 'string' },
          actor_id: { type: 'string' },
          /** Seconds until the issued token expires. Omit/0 for never-expires. */
          ttl_seconds: { type: 'integer', minimum: 0 },
        },
        required: ['client_id', 'client_name', 'pod_url'],
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const body = request.body as Omit<CoffeeClientGrant, 'status' | 'created_at' | 'grant_id'> & { ttl_seconds?: number };
    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const coffeeSpace = ensureAppDataSpace(core, env, 'coffee');
    const actorId = body.actor_id ?? `coffee:${body.client_id}`;
    const grant = core.ensureTrustedClientGrant(actorId, 'agent', [coffeeSpace.scope]);
    const expiresAt = body.ttl_seconds && body.ttl_seconds > 0
      ? new Date(Date.now() + body.ttl_seconds * 1000).toISOString()
      : null;
    const token = await issueClientToken(env, {
      clientId: body.client_id,
      clientName: body.client_name,
      actorId,
      grantId: grant.id,
      expiresAt,
    });
    await core.observe({
      actor: { type: 'person', id: profile.owner_id, display_name: profile.owner_id },
      type: 'consent_change',
      scope: profile.scopes.personal,
      visibility: 'private',
      app: 'coffee-pod',
      source_id: `coffee-connect:${body.client_id}`,
      content: {
        format: 'application/json',
        body: {
          action: 'coffee_client_connected',
          client_id: body.client_id,
          client_name: body.client_name,
          actor_id: actorId,
          grant_id: grant.id,
          token_prefix: token.token_prefix,
          expires_at: token.expires_at,
        },
      },
      sensitive: true,
    });
    return {
      ...body,
      actor_id: actorId,
      grant_id: grant.id,
      client_token: token.token,
      token_prefix: token.token_prefix,
      status: 'connected',
      created_at: token.created_at,
      expires_at: token.expires_at,
    } as CoffeeClientGrant & { expires_at: string | null };
  });

  app.post('/coffee/clients/:client_id/revoke', {
    schema: {
      summary: 'Revoke a connected Coffee client token',
      params: {
        type: 'object',
        properties: {
          client_id: { type: 'string' },
        },
        required: ['client_id'],
      },
    },
  }, async (request, reply) => {
    if (!await requireOwnerAuth(request, reply, env)) return;
    const params = request.params as { client_id: string };
    const revoked = await revokeClientToken(env, params.client_id);
    if (!revoked) {
      return reply.code(404).send({ error: 'not_found', message: 'Client token not found or already revoked' });
    }

    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    await core.observe({
      actor: { type: 'person', id: profile.owner_id, display_name: profile.owner_id },
      type: 'consent_change',
      scope: profile.scopes.personal,
      visibility: 'private',
      app: 'coffee-pod',
      source_id: `coffee-revoke:${params.client_id}`,
      content: {
        format: 'application/json',
        body: {
          action: 'coffee_client_revoked',
          client_id: params.client_id,
          actor_id: revoked.actor_id,
          grant_id: revoked.grant_id,
        },
      },
      sensitive: true,
    });

    return { client: revoked, status: 'revoked' };
  });

  app.post('/coffee/sync/meetings', {
    schema: {
      summary: 'Sync Coffee meetings into Pod memory',
    },
  }, async (request, reply) => {
    const body = request.body as CoffeeMeetingSyncBody;
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    const core = await getSmartwareCore(env);
    const coffeeSpace = ensureAppDataSpace(core, env, 'coffee');
    const synced = [];
    upsertCollection(db, {
      id: 'coffee',
      name: 'Coffee',
      description: 'Objects synced from Coffee.',
      metadata: { app: 'coffee' },
    });

    for (const meeting of body.meetings) {
      const meetingObject = upsertObject(db, {
        id: `coffee:meeting:${meeting.id}`,
        collection_id: 'coffee',
        kind: 'coffee.meeting',
        title: meeting.title,
        content: meeting,
        origin: 'coffee',
        created_origin: 'synced',
        last_modified_by: 'sync',
        sync_status: 'synced',
        processing_state: 'synced',
        summary: meeting.notes ?? null,
        source: {
          app: 'coffee',
          external_id: meeting.id,
          url: meeting.url,
        },
      });

      const result = await syncArtifactMemory({
        db,
        core,
        object: meetingObject,
        actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
        type: 'meeting',
        scope: coffeeSpace.scope,
        content: {
          format: 'application/json',
          body: {
            source: 'coffee',
            meeting,
            summary: stringifyMeeting(meeting),
          },
        },
        visibility: 'scope',
        sensitive: false,
        app: 'coffee',
        observed_at: meeting.start_at,
        legacy_sources: [{ app: 'coffee', source_id: `coffee-meeting:${meeting.id}` }],
      });

      for (const document of meeting.documents ?? []) {
        const documentObject = upsertObject(db, {
          id: document.id ? `coffee:document:${document.id}` : `coffee:meeting:${meeting.id}:document:${document.title}`,
          collection_id: 'coffee',
          kind: 'coffee.document',
          title: document.title,
          content: document,
          origin: 'coffee',
          created_origin: 'synced',
          last_modified_by: 'sync',
          sync_status: 'synced',
          processing_state: 'synced',
          summary: document.text ?? null,
          source: {
            app: 'coffee',
            external_id: document.id,
            url: document.url,
          },
          metadata: {
            meeting_id: meeting.id,
          },
        });

        const legacyDocumentSourceId = document.id
          ? `coffee-document:${document.id}`
          : `coffee-meeting-document:${meeting.id}:${document.title}`;
        await syncArtifactMemory({
          db,
          core,
          object: documentObject,
          actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
          type: 'file',
          scope: coffeeSpace.scope,
          content: {
            format: 'application/json',
            body: {
              source: 'coffee',
              meeting_id: meeting.id,
              document,
            },
          },
          visibility: 'scope',
          sensitive: false,
          app: 'coffee',
          legacy_sources: [{ app: 'coffee', source_id: legacyDocumentSourceId }],
        });
      }

      synced.push({ meeting_id: meeting.id, observation_id: result.observation_id, status: result.status });
    }

    return { synced, count: synced.length };
  });

  app.post('/coffee/meetings/:meeting_id/brief', {
    schema: {
      summary: 'Create a deterministic Pod-backed meeting brief for Coffee',
    },
  }, async (request, reply) => {
    const params = request.params as { meeting_id: string };
    const body = request.body as CoffeeMeetingBriefBody;
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    const core = await getSmartwareCore(env);
    const coffeeSpace = ensureAppDataSpace(core, env, 'coffee');
    const query = body.query ?? params.meeting_id;
    const context = core.searchObservations(query, coffeeSpace.scope, { limit: body.limit ?? 5, includeSensitive: false });
    const brief = briefFromSnippets(params.meeting_id, context.map(item => item.snippet));
    const result = await core.observe({
      actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
      type: 'meeting_brief_created',
      scope: coffeeSpace.scope,
      source_id: `coffee-meeting-brief:${params.meeting_id}`,
      content: {
        format: 'application/json',
        body: {
          meeting_id: params.meeting_id,
          query,
          brief,
          sources: context.map(item => ({
            observation_id: item.id,
            scope: item.scope,
            type: item.type,
            observed_at: item.observed_at,
          })),
        },
      },
      visibility: 'scope',
      app: 'coffee',
    });

    return {
      meeting_id: params.meeting_id,
      brief,
      sources: context,
      observation_id: result.id,
    };
  });

  app.post('/coffee/meetings/:meeting_id/capture', {
    schema: {
      summary: 'Capture Coffee meeting notes, decisions, tasks, and follow-up drafts',
    },
  }, async (request, reply) => {
    const params = request.params as { meeting_id: string };
    const body = request.body as CoffeeMeetingCaptureBody;
    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    const core = await getSmartwareCore(env);
    const coffeeSpace = ensureAppDataSpace(core, env, 'coffee');
    const writes = [];

    writes.push(await core.observe({
      actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
      type: 'meeting',
      scope: coffeeSpace.scope,
      source_id: `coffee-meeting-capture:${params.meeting_id}`,
      content: {
        format: 'application/json',
        body: {
          meeting_id: params.meeting_id,
          notes: body.notes,
          decisions: body.decisions ?? [],
          tasks: body.tasks ?? [],
          followups: body.followups ?? [],
        },
      },
      visibility: 'scope',
      app: 'coffee',
    }));

    for (const decision of body.decisions ?? []) {
      writes.push(await core.observe({
        actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
        type: 'decision',
        scope: coffeeSpace.scope,
        source_id: `coffee-meeting-decision:${params.meeting_id}:${writes.length}`,
        content: { format: 'text/plain', body: decision },
        visibility: 'scope',
        app: 'coffee',
      }));
    }

    for (const task of body.tasks ?? []) {
      writes.push(await core.observe({
        actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
        type: 'task_created',
        scope: coffeeSpace.scope,
        source_id: `coffee-meeting-task:${params.meeting_id}:${writes.length}`,
        content: {
          format: 'application/json',
          body: {
            meeting_id: params.meeting_id,
            title: task,
            status: 'created',
          },
        },
        visibility: 'scope',
        app: 'coffee',
      }));
    }

    for (const followup of body.followups ?? []) {
      writes.push(await core.observe({
        actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
        type: 'followup_drafted',
        scope: coffeeSpace.scope,
        source_id: `coffee-meeting-followup:${params.meeting_id}:${writes.length}`,
        content: {
          format: 'application/json',
          body: {
            meeting_id: params.meeting_id,
            title: followup.title,
            description: followup.description ?? '',
            to: followup.to ?? null,
            requires_review: true,
            status: 'drafted',
          },
        },
        visibility: 'scope',
        app: 'coffee',
      }));
    }

    return {
      meeting_id: params.meeting_id,
      writes: writes.map(write => ({ id: write.id, status: write.status })),
    };
  });
}
