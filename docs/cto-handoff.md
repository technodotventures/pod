# Pod CTO Handoff

This package contains a locally runnable Pod beta candidate that Coffee
staging can plug into before the final Vendro/Coffee production adapter is
available. It is not yet an externally distributable Mac release.

## What Is Ready

- Standalone Fastify API runtime.
- Smartware-backed durable memory.
- Generic Pod collections and objects API.
- Generic private/workspace scopes plus app-owned data spaces. Meeting,
  document, and task remain content types inside the source app boundary.
- Owner token and per-client pairing tokens.
- Client tokens are actor-bound and cannot call owner-only client management
  endpoints.
- Coffee client listing and revocation.
- Meeting sync, brief generation, and capture endpoints.
- Coffee adapter endpoints write into the generic Pod object store as well as
  Smartware memory/events.
- Agent action proposal/approval primitives.
- OpenAPI docs at `/docs`.
- Coffee-style React/Vite Pod cockpit UI.
- Content-free, user-previewed support diagnostics under Settings → Support.
- Complete checksummed backup and staged crash-recoverable restore under
  Settings → Storage.
- Idempotent canonical mutation commits with startup recovery and real
  process-kill regression coverage.
- Strict server and cockpit type-checking, regression tests, a five-minute beta
  acceptance journey, and a staging smoke script.
- A locally packaged arm64 Mac app that has passed a real isolated launch and
  `/health` smoke test.
- ASAR packaging with only required native modules unpacked, Coffee package
  metadata, and the existing branded Pod icon.
- Owner-only local data directories, credential files, token files, and server
  logs; legacy PIN hashes upgrade to scrypt after the next successful unlock.

## Reproducible Beta Gate

From a clean Pod checkout:

```bash
npm install
npm --prefix vendor/smartware run build
npm run beta:gate
npm audit --omit=dev
npm run desktop:pack
```

The reviewed 2026-07-15 baseline is 183 Pod tests with no skips, clean
server and cockpit type-checks, a production UI build, the complete acceptance
journey, and zero production dependency advisories. `desktop:pack` must finish
with a launchable app at `release/mac-arm64/Pod.app` on Apple Silicon.
The full dependency audit may report a low Windows-only development-server
advisory; it is not in the production dependency set or the Mac app runtime.

The standalone Smartware repository is the source of truth and must be checked
separately before recording the two release revisions:

```bash
cd ../smartware
npm install
npm run build
npm test
npm audit --omit=dev
```

The reviewed standalone baseline is 278 tests and zero production dependency
advisories. Do not release from either dirty working tree. Commit Smartware
first, re-vendor from that named revision, record both exact revisions, and
rerun the gate.

## Local Run

```bash
npm install
npm run build
COFFEE_POD_API_TOKEN=replace-me COFFEE_POD_DATA_DIR=../coffee-pod-dev-data npm start
```

Then in another terminal:

```bash
COFFEE_POD_URL=http://127.0.0.1:8732 COFFEE_POD_API_TOKEN=replace-me npm run smoke:coffee
```

For the paired local API and UI:

```bash
npm run ui:dev
```

Use `npm run ui:only` only when a matching backend is already running
separately.

For a local Mac app shell:

```bash
npm run desktop:pack
open "release/mac-arm64/Pod.app"
```

## Docker Run

The Docker build uses the Smartware snapshot committed under
`vendor/smartware`. Run it from the Pod repository root:

```bash
docker build -t coffee-pod .
docker run --rm -p 8732:8732 \
  -e COFFEE_POD_API_TOKEN=replace-me \
  -v coffee-pod-data:/data \
  coffee-pod
```

The build does not read a sibling Smartware checkout. This keeps the runtime on
the reviewed vendor snapshot recorded in
[smartware-authority.md](smartware-authority.md).

## Coffee Staging Integration

Start with [coffee-staging-integration.md](coffee-staging-integration.md).

Minimum staging work:

1. Add a "Connect Pod" staging setting.
2. Accept Pod URL and owner token.
3. Call `POST /coffee/connect`.
4. Store returned `client_token` securely.
5. Sync staging meetings with `POST /coffee/sync/meetings`.
6. Request briefs with `POST /coffee/meetings/:meeting_id/brief`.
7. Capture notes with `POST /coffee/meetings/:meeting_id/capture`.

## Important Notes

- Use synthetic staging data only.
- Do not send emails, update calendars, or message users from Pod output without
  explicit user approval.
- The current brief generator is deterministic. It is designed to prove the
  contract before adding model routing.
- Smartware is a local file dependency backed by the committed
  `vendor/smartware` snapshot. Do not substitute a sibling checkout in release
  builds.
- Full backups contain private memory and connector credentials. Support should
  request the content-free diagnostics JSON, never a backup archive. See
  [backup-restore.md](backup-restore.md) and [diagnostics.md](diagnostics.md).

## CTO Deployment Work Still Required

1. Register the final Mac app identity, confirm the release version, legal
   company metadata, and approved branded icon, then sign, notarize, staple,
   and build the DMG. The engineering package currently uses the Coffee brand
   name and existing Pod icon, not a registered distribution identity.
2. Configure the final public Google OAuth client and production redirect URIs;
   secrets and credentials must remain outside the repository.
3. Connect and validate the final Vendro/Coffee production adapter against the
   pairing and mutation contracts.
4. Re-run the ASAR package and real-launch smoke on the final signed build;
   `better-sqlite3` and `@napi-rs/canvas` are the only native modules unpacked.
5. Run install, first launch, update, backup/restore, diagnostics export, and
   uninstall on a clean supported Mac before inviting external testers.
6. Keep `coffee-pod-dev-data/` and `coffee-pod-dev-data-v1/` out of Git, then
   coordinate a history rewrite before public release. Their local files are
   preserved and ignored. The content-safe audit found 26 unique blobs
   (2,420,641 bytes) across six revisions. It found no high-confidence
   credential pattern, but it confirmed private SQLite, journal, and user-path
   data, so removing only the current tree is insufficient. Use
   `node scripts/audit-dev-data-history.mjs` to repeat the audit without
   printing matched content, and rotate credentials if a later reviewed scan
   finds any.

Signing, notarization, public OAuth credentials, and production deployment are
intentionally not claimed by this handoff. The unsigned local package is an
engineering verification artifact only.
