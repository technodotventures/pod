// Webhook receiver routes for native sidecars (PR-17 / E2 + E3).
//
// Routes:
//   POST /webhooks/slack    — Slack Events API receiver
//   POST /webhooks/github   — GitHub webhook receiver
//
// Each verifies the provider HMAC, applies the sidecar's filter,
// then OBSERVEs each kept event with a deterministic operation_id.
//
// VERIFICATION NOTE
// These routes compile and the signature/filter logic is unit-tested.
// Live end-to-end OAuth + webhook delivery requires:
//   - Provider OAuth app registration
//   - Reachable webhook URL (Coffee Cloud or ngrok during dev)
//   - SLACK_SIGNING_SECRET / GITHUB_WEBHOOK_SECRET in env
// None of those are configured in this session.

import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import {
  filterSlackMessage,
  slackOperationId,
  verifySlackSignature,
  type SlackMessage,
} from '../services/sidecars/slack.js';
import {
  filterGithubEvent,
  githubOperationId,
  verifyGithubSignature,
  type GithubEvent,
} from '../services/sidecars/github.js';
import { ensureAppDataSpace } from '../pod/data-spaces.js';
import { getSmartwareCore } from '../smartware/core.js';
import {
  compileConversationProjection,
  conversationMessageContent,
  slackTimestampToIso,
} from '../services/conversation-memory.js';

function envSecret(name: string): string | null {
  const v = process.env[name];
  return v && v.length > 0 ? v : null;
}

export async function registerWebhookRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  // ── Slack ──────────────────────────────────────────────────────────
  app.post('/webhooks/slack', {
    schema: { summary: 'Slack Events API receiver. HMAC-verified.' },
  }, async (request, reply) => {
    const secret = envSecret('SLACK_SIGNING_SECRET');
    if (!secret) {
      return reply.code(503).send({ error: { code: 'sidecar_unconfigured', message: 'SLACK_SIGNING_SECRET not set.' } });
    }

    const sig = request.headers['x-slack-signature'];
    const ts = request.headers['x-slack-request-timestamp'];
    if (typeof sig !== 'string' || typeof ts !== 'string') {
      return reply.code(400).send({ error: { code: 'invalid_payload', message: 'missing Slack signature headers' } });
    }
    const rawBody = JSON.stringify(request.body);
    if (!verifySlackSignature(secret, ts, rawBody, sig)) {
      return reply.code(401).send({ error: { code: 'forbidden', message: 'invalid Slack signature' } });
    }

    // Handle URL verification handshake.
    const body = request.body as Record<string, unknown>;
    if (body.type === 'url_verification') {
      return { challenge: body.challenge };
    }

    if (body.type === 'event_callback' && body.event && typeof body.event === 'object') {
      const event = body.event as { type: string };
      if (event.type === 'message') {
        const msg = event as unknown as SlackMessage;
        const decision = filterSlackMessage(msg);
        if (decision.decision === 'keep') {
          const core = await getSmartwareCore(env);
          const slackSpace = ensureAppDataSpace(core, env, 'slack');
          core.ensureTrustedClientGrant('sidecar:slack', 'agent', [slackSpace.scope]);
          const occurredAt = slackTimestampToIso(msg.ts);
          await core.observe({
            actor: { type: 'agent', id: 'sidecar:slack', display_name: 'Slack Sidecar' },
            type: 'message',
            scope: slackSpace.scope,
            content: {
              format: 'application/json',
              body: conversationMessageContent({
                source: 'slack',
                conversation_id: `${msg.channel_id}:${msg.thread_ts ?? msg.ts}`,
                message_id: msg.ts,
                text: msg.text ?? '',
                actor_id: msg.user || 'unknown:slack',
                ...(msg.user_display_name ? { actor_name: msg.user_display_name } : {}),
                channel_id: msg.channel_id,
                ...(msg.channel_name ? { channel_name: msg.channel_name } : {}),
                ...(occurredAt ? { occurred_at: occurredAt } : {}),
                reactions_count: msg.reactions?.reduce((sum, reaction) => sum + reaction.count, 0) ?? 0,
              }),
            },
            visibility: 'scope',
            source_id: `${msg.channel_id}.${msg.ts}`,
            app: 'slack',
            ...(occurredAt ? { observed_at: occurredAt } : {}),
            idempotency_key: slackOperationId(msg),
          });
          await compileConversationProjection(env, slackSpace.scope).catch(error => {
            request.log.warn({ error }, 'slack webhook: conversation projection failed');
          });
        }
      }
    }

    return { ok: true };
  });

  // ── GitHub ─────────────────────────────────────────────────────────
  app.post('/webhooks/github', {
    schema: { summary: 'GitHub webhook receiver. HMAC-verified.' },
  }, async (request, reply) => {
    const secret = envSecret('GITHUB_WEBHOOK_SECRET');
    if (!secret) {
      return reply.code(503).send({ error: { code: 'sidecar_unconfigured', message: 'GITHUB_WEBHOOK_SECRET not set.' } });
    }

    const sig = request.headers['x-hub-signature-256'];
    if (typeof sig !== 'string') {
      return reply.code(400).send({ error: { code: 'invalid_payload', message: 'missing X-Hub-Signature-256' } });
    }
    const rawBody = JSON.stringify(request.body);
    if (!verifyGithubSignature(secret, rawBody, sig)) {
      return reply.code(401).send({ error: { code: 'forbidden', message: 'invalid GitHub signature' } });
    }

    const eventType = request.headers['x-github-event'];
    const body = request.body as Record<string, unknown>;

    // Project the webhook payload into our GithubEvent shape per
    // pod-integration-github-v0_1.md. PR-25: complete event coverage
    // (pull_request, issues, issue_comment, pull_request_review,
    // pull_request_review_comment, push commits on default branch,
    // release).
    const repo = (body.repository as Record<string, unknown> | undefined)?.['full_name'] as string | undefined;
    let projected: GithubEvent | null = null;

    const userOf = (u: unknown): { login: string; is_bot: boolean } => {
      const obj = (u ?? {}) as Record<string, unknown>;
      return {
        login: (obj['login'] as string) ?? 'unknown',
        is_bot: ((obj['type'] as string) ?? '') === 'Bot',
      };
    };

    if (eventType === 'pull_request' && repo) {
      const pr = body.pull_request as Record<string, unknown> | undefined;
      if (pr) {
        const u = userOf(pr.user);
        projected = {
          type: 'pull_request',
          repo,
          number: pr.number as number,
          author: u.login,
          author_login: u.login,
          is_bot: u.is_bot,
          title: pr.title as string,
          body: pr.body as string | undefined,
          labels: ((pr.labels as Array<Record<string, unknown>> | undefined) ?? []).map((l) => l.name as string),
          state: pr.merged ? 'merged' : (pr.state as string),
        };
      }
    } else if (eventType === 'issues' && repo) {
      const iss = body.issue as Record<string, unknown> | undefined;
      if (iss) {
        const u = userOf(iss.user);
        projected = {
          type: 'issue',
          repo,
          number: iss.number as number,
          author: u.login,
          author_login: u.login,
          is_bot: u.is_bot,
          title: iss.title as string,
          body: iss.body as string | undefined,
          labels: ((iss.labels as Array<Record<string, unknown>> | undefined) ?? []).map((l) => l.name as string),
          state: iss.state as string,
        };
      }
    } else if (eventType === 'issue_comment' && repo) {
      const cmt = body.comment as Record<string, unknown> | undefined;
      const iss = body.issue as Record<string, unknown> | undefined;
      if (cmt && iss) {
        const u = userOf(cmt.user);
        projected = {
          type: 'comment',
          repo,
          number: iss.number as number,
          author: u.login,
          author_login: u.login,
          is_bot: u.is_bot,
          body: cmt.body as string | undefined,
          reactions_count: ((cmt.reactions as Record<string, unknown> | undefined)?.['total_count'] as number) ?? 0,
        };
      }
    } else if ((eventType === 'pull_request_review' || eventType === 'pull_request_review_comment') && repo) {
      const review = (body.review ?? body.comment) as Record<string, unknown> | undefined;
      const pr = body.pull_request as Record<string, unknown> | undefined;
      if (review && pr) {
        const u = userOf(review.user);
        projected = {
          type: 'pr_review',
          repo,
          number: pr.number as number,
          author: u.login,
          author_login: u.login,
          is_bot: u.is_bot,
          body: review.body as string | undefined,
          state: review.state as string | undefined,
        };
      }
    } else if (eventType === 'push' && repo) {
      const ref = body.ref as string | undefined;
      const defaultBranch = (body.repository as Record<string, unknown> | undefined)?.['default_branch'] as string | undefined;
      // Only ingest commits on the default branch per spec.
      if (ref && defaultBranch && ref === `refs/heads/${defaultBranch}`) {
        const commits = (body.commits as Array<Record<string, unknown>> | undefined) ?? [];
        for (const commit of commits) {
          const u = userOf(commit.author);
          const projection: GithubEvent = {
            type: 'commit',
            repo,
            sha: commit.id as string,
            author: u.login,
            author_login: u.login,
            is_bot: u.is_bot,
            body: commit.message as string,
          };
          const decision = filterGithubEvent(projection);
          if (decision.decision === 'keep') {
            const core = await getSmartwareCore(env);
            const githubSpace = ensureAppDataSpace(core, env, 'github');
            core.ensureTrustedClientGrant('sidecar:github', 'agent', [githubSpace.scope]);
            await core.observe({
              actor: { type: 'agent', id: 'sidecar:github', display_name: 'GitHub Sidecar' },
              type: 'decision',
              scope: githubSpace.scope,
              content: { format: 'text/markdown', body: `**${repo}** commit ${commit.id}\n\n${commit.message}` },
              visibility: 'scope',
              source_id: `${repo}@${commit.id}`,
              app: 'github',
              idempotency_key: githubOperationId(projection),
            });
          }
        }
        return { ok: true, commits_processed: commits.length };
      }
    } else if (eventType === 'release' && repo) {
      const rel = body.release as Record<string, unknown> | undefined;
      if (rel) {
        const u = userOf(rel.author);
        projected = {
          type: 'release',
          repo,
          author: u.login,
          author_login: u.login,
          is_bot: u.is_bot,
          title: (rel.name as string) ?? (rel.tag_name as string),
          body: rel.body as string | undefined,
        };
      }
    }

    if (projected) {
      const decision = filterGithubEvent(projected);
      if (decision.decision === 'keep') {
        const core = await getSmartwareCore(env);
        const githubSpace = ensureAppDataSpace(core, env, 'github');
        core.ensureTrustedClientGrant('sidecar:github', 'agent', [githubSpace.scope]);
        await core.observe({
          actor: { type: 'agent', id: 'sidecar:github', display_name: 'GitHub Sidecar' },
          type: projected.type === 'pull_request' || projected.type === 'issue' ? 'decision' : 'message',
          scope: githubSpace.scope,
          content: {
            format: 'text/markdown',
            body: `**${projected.repo}** — ${projected.title ?? projected.type}\n\n${projected.body ?? ''}`,
          },
          visibility: 'scope',
          source_id: `${projected.repo}#${projected.number ?? projected.sha ?? 'unknown'}`,
          app: 'github',
          idempotency_key: githubOperationId(projected),
        });
      }
    }

    return { ok: true };
  });
}
