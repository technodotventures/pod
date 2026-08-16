# Pod

Pod is a standalone, user-owned memory companion powered by Smartware.
It can run locally, on a VPS, or as a Coffee-hosted runtime. Coffee apps connect
to the Pod, but the Pod is also designed to serve third-party apps, IDEs, and
agents through HTTP/OpenAPI and MCP surfaces.

The Pod is intentionally a generic library and memory substrate. Coffee-specific
routes are adapter conveniences that write into the same generic object store
and Smartware memory/event layer.

## Install And Onboarding

Start with [docs/install.md](docs/install.md) for local development, Mac beta,
VPS/service, Coffee pairing, and MCP onboarding paths.

## Development

```bash
npm install
COFFEE_POD_DATA_DIR=../coffee-pod-dev-data npm run ui:dev
```

This starts the paired Pod API and cockpit UI. The launcher waits for the
expected Pod runtime before exposing the UI, so the browser cannot silently
connect to a missing or unrelated backend.

For API-only development:

```bash
COFFEE_POD_DATA_DIR=../coffee-pod-dev-data npm run dev
```

Copy `.env.example` when configuring a local, VPS, or staging deployment.

Default HTTP address:

```text
http://127.0.0.1:8732
```

When `npm run ui:build` has been run, the backend serves the built cockpit at:

```text
http://127.0.0.1:8732/
```

Default UI address:

```text
http://127.0.0.1:5173
```

The paired development backend uses the `COFFEE_POD_PORT` in `.env` (`8733` in
the example configuration). Use `npm run ui:only` only when that matching
backend is already running separately.

Optional local/VPS API protection:

```bash
COFFEE_POD_API_TOKEN=replace-me COFFEE_POD_DATA_DIR=../coffee-pod-dev-data npm run dev
```

When `COFFEE_POD_API_TOKEN` is set, send either header:

```text
Authorization: Bearer replace-me
```

or:

```text
x-coffee-pod-token: replace-me
```

`/health` and `/docs` remain public so hosts and humans can inspect service health.

`POST /coffee/connect` uses the owner token when API protection is enabled, then
returns a one-time `client_token` for the Coffee app to store and use on later
Pod requests. The Pod stores only a hash of issued client tokens. Client tokens
are bound to their returned `actor_id`; owner-only endpoints still require the
owner token.

Core routes:

- `GET /health`
- `GET /pod/capabilities`
- `GET /pod/collections`
- `POST /pod/collections`
- `GET /pod/objects`
- `POST /pod/objects`
- `GET /pod/objects/:object_id`
- `GET /pod/status`
- `POST /pod/observe`
- `POST /pod/query`
- `POST /pod/context` (bounded peer card, lessons, conversations, and cited claims for an agent)
- `POST /pod/expertise` (authorized, evidence-backed “who knows” lookup)
- `POST /pod/compile`
- `POST /pod/dream` (owner-triggered run of the shared, derived-only Dream cycle)
- `GET /pod/experience/lessons` (owner view of learned approaches and proof of later usefulness)
- `GET /pod/diagnostics` (owner-only, content-free)
- `POST /pod/export` (owner-only, complete checksummed backup)
- `POST /pod/import` (owner-only, staged restore applied on restart)
- `GET /pod/activity`
- `GET /pod/approvals`
- `POST /pod/session/start`
- `POST /pod/session/checkpoint`
- `POST /pod/session/end`
- `POST /pod/agent/action/propose`
- `POST /pod/agent/action/approve`
- `POST /pod/agent/action/reject`
- `GET /pod/registry/agents/:agent_id/profile-manifest` (secret-free portable agent profile)
- `GET /pod/registry/agents/:agent_id/profile-materializations/:target_id` (non-destructive native preview)
- `POST /pod/registry/agents/:agent_id/migrations/openclaw/preview` (secret-safe migration plan)
- `POST /pod/registry/agents/:agent_id/migrations/openclaw/apply` (reviewed, reversible import)
- `GET /pod/registry/agents/:agent_id/migration-receipts`
- `POST /pod/registry/agents/:agent_id/migration-receipts/:receipt_id/rollback`
- `POST /coffee/connect`
- `GET /coffee/clients`
- `POST /coffee/clients/:client_id/revoke`
- `POST /coffee/sync/meetings`
- `POST /coffee/meetings/:meeting_id/brief`
- `POST /coffee/meetings/:meeting_id/capture`
- `GET /docs`

MCP integration:

```bash
npm run mcp
```

Set `COFFEE_POD_URL` if the Pod API is running somewhere other than the local
default, and set `COFFEE_POD_API_TOKEN` or `COFFEE_POD_MCP_API_TOKEN` when the
Pod is protected.

The MCP server runs over stdio and proxies the existing Pod HTTP API so LLM
clients can call the same memory, query, session, and approval operations the
HTTP app already exposes.

Portable agent profiles can be projected for Hermes, Codex, Claude Code,
OpenClaw, and Kimi Code without exporting agent tokens or writing native
runtime state. An OpenClaw workspace can also be previewed, conflict-resolved,
imported into Pod/Smartware, projected to Hermes, and rolled back from the
Agents screen. See
[docs/agent-profile-portability.md](docs/agent-profile-portability.md).

`pod_record_experience` records completed attempts and corrective feedback.
Pod derives cited lessons from that evidence and returns applicable lessons to
other authorized agents through `pod_context`. See
[docs/experience-loop.md](docs/experience-loop.md) for the event contract and
safety boundary.

`pod_search_evidence`, `pod_search_conversations`, and `pod_who_knows` expose
small retrieval primitives for MCP clients without hiding answer synthesis
inside the tools. Ask Pod uses the same normalized evidence rows, including
source-backed conversation memory and demonstrated expertise. See
[docs/retrieval-memory.md](docs/retrieval-memory.md) for the retrieval contract,
Slack thread projection, and authorization boundary.

`pod_dream` is an owner-authorized maintenance inspection. It runs once when
called, does not schedule itself, and cannot write canonical memory data. See
`vendor/smartware/docs/dream-status.md` for its current safety boundary.

External MCP connectors:

- Configure read-only third-party MCP servers from Settings → Developers.
- Pod stores connector configs in `COFFEE_POD_DATA_DIR/mcp-servers.json` with
  file mode `0o600`.
- Ask Pod can include enabled external MCP context during `/pod/query` when
  `include_external_mcp` is true.
- Tools must either declare `readOnlyHint: true` or be explicitly allowlisted in
  the connector config before Pod will call them.

## Test

```bash
npm test
```

The regression suite uses Fastify injection against the real app builder, with a
temporary Smartware data directory per test.

Build the UI:

```bash
npm run ui:build
```

Build server and UI together:

```bash
npm run build:all
```

Backup and restore behavior is documented in
[docs/backup-restore.md](docs/backup-restore.md). Support diagnostics are a
separate content-free artifact; a full backup should never be sent to support.

## Mac App

Run the local Mac shell in development:

```bash
npm run desktop:dev
```

Create an unpacked `.app` for testing:

```bash
npm run desktop:pack
```

The app output is written to `release/mac*/Pod.app`.

## Coffee Staging Smoke

With a Pod server running:

```bash
COFFEE_POD_URL=http://127.0.0.1:8732 COFFEE_POD_API_TOKEN=replace-me npm run smoke:coffee
```

See [docs/coffee-staging-integration.md](docs/coffee-staging-integration.md) for
the staging contract.

## CTO Handoff

See [docs/cto-handoff.md](docs/cto-handoff.md) for local run, Docker run, and
Coffee staging integration notes.
