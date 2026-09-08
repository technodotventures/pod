# Install Pod by Coffee

Pod by Coffee is a user-owned memory companion that can run as a local Mac app,
a local developer service, a VPS service, or a Coffee-hosted runtime. This guide
is the first public onboarding path: install or start the runtime, verify it,
connect a client, then make one useful memory call.

## Current Status

The source and local runtime paths are ready for developers and staging
integrators. The Mac app beta path exists, but external distribution should wait
for a signed and notarized DMG. Do not describe Pod as a one-command install
until packaging, signing, and MCP client setup are reliable end to end.

## Choose A Path

### Mac Beta

Use this path for internal testers once a signed and notarized DMG is available.

1. Install `Pod.app` from the DMG.
2. Open the app.
3. The cockpit should load at `http://127.0.0.1:8732/`.
4. The app provisions its own local API token for the cockpit.

For release checks, signing, notarization, logs, and uninstall instructions, see
[security/beta-release-runbook.md](security/beta-release-runbook.md).

### Local Developer Runtime

**Quick start (verified on macOS, Node 26)**

```bash
git clone https://github.com/technodotventures/pod.git
cd pod
npm install                    # native better-sqlite3 compiles here
cp .env.example .env           # leave COFFEE_POD_API_TOKEN EMPTY for local dev
npm run dev:all                # API on 127.0.0.1:8733 + UI on http://127.0.0.1:5173
```

Open http://127.0.0.1:5173. The launcher waits for the expected backend before
starting the browser UI, so the browser cannot silently connect to a missing or
unrelated backend. Alternatively, run the Electron app for the real product
experience (see below).

Prerequisites:

- Node.js >= 20. **Use the Homebrew Node 26 build** (`/opt/homebrew/bin/node`,
  first on PATH) on macOS — the repo's native `better-sqlite3` is compiled
  against the modern ABI and fails with `ERR_DLOPEN_FAILED` under older
  Node distributions (e.g. `~/.local`/volta/nvm node 22).
- npm
- A writable data directory

Gotchas (all hit in real onboarding):

- **Data lives in `pod/data/`** for the browser dev runtime. It is isolated
  from the Electron app's data (`~/Library/Application Support/...`) and from
  any external/VPS Pod. `pod/data/` is disposable — delete it to reset.
- **Leave `COFFEE_POD_API_TOKEN` empty in `.env` for local throwaway dev.** A
  token enables auth on every non-health route, which you do not need unless
  you are pairing a third-party app against your local instance.
- **Do not run `dev:all` and `desktop:dev` simultaneously.** Two Pod servers
  on different ports (8733 vs 8732) each with their own data dir is confusing
  state; pick one per session.
- **Ports:** browser dev = `COFFEE_POD_PORT` (8733 per `.env.example`,
  configurable), Electron = 8732 default. Vite's dev proxy auto-targets the
  `COFFEE_POD_PORT` backend and attaches the token from `.env` when set.

For live backend development:

```bash
COFFEE_POD_DATA_DIR=../coffee-pod-dev-data npm run dev
```

For normal web development, start the paired backend and cockpit together:

```bash
COFFEE_POD_DATA_DIR=../coffee-pod-dev-data npm run ui:dev
```

The paired launcher waits for the expected backend before starting the browser
UI. Use `npm run ui:only` only when a matching backend is already running.

### Local Or VPS Service

Use this path when Pod should run as an external memory/runtime service for
Coffee or another app.

```bash
npm install
npm run build:all
COFFEE_POD_API_TOKEN=replace-me COFFEE_POD_DATA_DIR=/data/coffee-pod npm start
```

The default local URL is:

```text
http://127.0.0.1:8732
```

For Docker handoff notes, see [cto-handoff.md](cto-handoff.md). Docker and source
installs restore the reviewed Smartware release from `package-lock.json`; no
sibling checkout is required.

## Verify The Runtime

Health is public:

```bash
curl http://127.0.0.1:8732/health
```

OpenAPI docs are public:

```text
http://127.0.0.1:8732/docs
```

Capabilities describe the Pod protocol and whether API auth is required:

```bash
curl http://127.0.0.1:8732/pod/capabilities
```

If `COFFEE_POD_API_TOKEN` is set, send either header for protected routes:

```text
Authorization: Bearer replace-me
```

or:

```text
x-coffee-pod-token: replace-me
```

## Connect Coffee

Coffee should treat Pod as an external runtime. The basic pairing flow is:

1. Discover or enter a Pod URL.
2. Call `GET /health`.
3. Call `GET /pod/capabilities`.
4. If auth is required, call `POST /coffee/connect` with the owner token.
5. Store the returned `client_token` securely.
6. Use that client token for meeting sync, briefs, captures, and approved
   follow-up actions.

Start with [coffee-staging-integration.md](coffee-staging-integration.md) for
the current staging contract.

## Connect Agents With MCP

Pod includes a stdio MCP server that proxies the local HTTP API.

Build first:

```bash
npm run build
```

Then run:

```bash
npm run mcp
```

Set `COFFEE_POD_URL` if the Pod API is not running at the local default:

```bash
COFFEE_POD_URL=http://127.0.0.1:8732 npm run mcp
```

If the Pod is protected, set either `COFFEE_POD_MCP_API_TOKEN` or
`COFFEE_POD_API_TOKEN`:

```bash
COFFEE_POD_URL=http://127.0.0.1:8732 COFFEE_POD_MCP_API_TOKEN=replace-me npm run mcp
```

Publish client-specific MCP snippets only after they have been tested against
the target host. The next version of this guide should include verified snippets
for the supported agent tools and a setup command with dry-run output.

## First Useful Calls

Write a memory observation:

```bash
curl -sS -X POST http://127.0.0.1:8732/pod/observe \
  -H "content-type: application/json" \
  -H "authorization: Bearer replace-me" \
  -d '{"actor_id":"coffee:local-dev","scope_alias":"workspace","type":"decision","content":"Pod by Coffee is running locally for developer onboarding.","source_id":"install-guide-smoke","operation_id":"op_01J00000000000000000000001"}'
```

Query memory:

```bash
curl -sS -X POST http://127.0.0.1:8732/pod/query \
  -H "content-type: application/json" \
  -H "authorization: Bearer replace-me" \
  -d '{"actor_id":"coffee:local-dev","scope_alias":"workspace","query":"developer onboarding","limit":5}'
```

For Coffee staging, run the smoke script after the Pod server is running:

```bash
COFFEE_POD_URL=http://127.0.0.1:8732 COFFEE_POD_API_TOKEN=replace-me npm run smoke:coffee
```

## Troubleshooting

- `401` means the route requires a valid owner or client token.
- `403` usually means a client token is calling with the wrong `actor_id` or
  trying to use an owner-only route.
- `421` means the host guard rejected a non-loopback or unexpected Host header.
- Port conflicts on `8732` must be resolved before the local runtime can start.
- Mac app logs live at
  `~/Library/Application Support/Pod/coffee-pod-server.log` for new installs.
  Upgraded installations may continue using the legacy product directory so
  existing memory is not stranded.
- Mac beta uninstall:
  Remove `/Applications/Pod.app` and its application-support directory.

## Roadmap For Public Onboarding

The polished public version should add:

- A dedicated homepage install panel that links here.
- Platform tabs for Mac app, local source, VPS/Docker, and hosted runtime.
- Verified MCP client snippets.
- A `coffee-pod setup ... --dry-run` style flow if a CLI is added.
- A supported-client matrix.
- A short first-memory walkthrough for developers and agent users.
