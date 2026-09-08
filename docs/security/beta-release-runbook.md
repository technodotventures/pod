# Pod Mac Beta — Release Runbook

This runbook separates the verified engineering gate from the deployment work
that requires Coffee's production identities and credentials.

## 0. Source and dependency pre-flight

Do not cut a release from dirty Pod or Smartware working trees. Record the
reviewed Smartware release in Pod's lockfile and ship that exact package
snapshot.

`coffee-pod-dev-data/` and `coffee-pod-dev-data-v1/` are ignored, excluded from
Docker, and removed from the current Git tree without deleting either local
directory. The content-safe history audit found 26 unique blobs (2,420,641
bytes) across six revisions. No high-confidence credential pattern was found,
but private SQLite, journal, and user-path data was confirmed. Before public
release, coordinate a reviewed history rewrite/force-push; ignore rules and a
normal deletion commit do not remove old blobs. Repeat the
non-content-printing audit with `node scripts/audit-dev-data-history.mjs`
before and after the rewrite.

```bash
npm ci
npm run verify:smartware-release
npm run check:smartware-upstream
npm run beta:gate
npm audit --audit-level=low
```

Expected reviewed baseline:

- clean server and cockpit type-checks;
- 222 Pod tests with no skips;
- successful production cockpit build and beta acceptance journey;
- eight representative recall scenarios with zero forbidden hits;
- zero production or development dependency advisories.

Any Critical or High finding in Electron or a production dependency blocks
release. The current automated gate also fails on Low and Moderate findings so
new advisories are reviewed rather than silently accumulated.

The standalone Smartware repository remains the upstream source of truth, but
Pod no longer rebuilds or vendors a local Smartware tree. Use
`npm run check:smartware-upstream` to confirm the locked release is still the
latest reviewed stable npm package.

## 1. Build and smoke the unsigned engineering package

```bash
npm run desktop:pack
open "release/mac-arm64/Pod.app"
```

`desktop:pack` rebuilds `better-sqlite3` for the exact Electron ABI, copies it
into the app, and restores the checkout's Node ABI afterward. Treat any native
module or launch error as a release blocker.

Expected behavior:

1. The cockpit opens and `curl http://127.0.0.1:8732/health` returns 200.
2. `.coffee-token` is created under the app data directory with mode `0600`.
3. The server binds only to `127.0.0.1`.
4. A protected endpoint rejects a request without the owner or paired-client
   token.
5. A request with an unapproved Host header returns 421.

This package is unsigned. It uses ASAR with only the required native modules
unpacked and the existing branded Pod icon, but it remains an engineering
verification artifact; do not send it to beta users.

## 2. Production identity and distribution — CTO owned

Before external beta distribution:

1. Set the final registered Coffee app ID and release version; confirm the legal
   company metadata and approve the currently configured branded icon.
2. Provision the Developer ID Application certificate and notarization
   credentials outside the repository.
3. Define the minimum reviewed macOS entitlements for the chosen Electron
   version. Do not copy broad entitlement examples without verifying that the
   app needs them.
4. Build the signed universal or architecture-specific DMG with
   `npm run desktop:dmg`.
5. Verify the app and DMG with `codesign`, `spctl`, notarization history, and
   stapler validation.
6. Test install, first launch, update, backup/restore, diagnostics export, and
   uninstall on a clean supported Mac.
7. Publish the signed and notarized DMG through Coffee's controlled beta
   channel with its SHA-256 checksum and support contact.

The current package sets `identity: null`, so signing and notarization are
mandatory for external beta. ASAR is enabled; rerun native-module packaging and
the real-launch smoke after every Electron, ASAR-unpack, signing, or architecture
change.

## 3. Public integrations — CTO owned

- Configure the final Google OAuth client, approved consent screen, production
  redirect URIs, and secret storage. Do not commit OAuth credentials.
- Validate the final Vendro/Coffee adapter using a paired client token, safe
  operation IDs, revocation, and synthetic data before production data.
- Keep external actions user-approved. Pod output must not send messages,
  modify calendars, or mutate other systems autonomously.

## 4. Tester support and recovery

Ask testers to use **Settings → Support** to preview and save the content-free
diagnostics JSON. They share only the file they reviewed; Pod never uploads it
automatically. Never ask a tester to send a backup archive: backups contain
private memory and may include connector credentials.

Before destructive troubleshooting, create a private backup from
**Settings → Storage**. Restore is staged and applied on restart. If a token is
suspected leaked, revoke paired clients or remove the local owner-token file and
restart so a new token is provisioned. Revoke compromised Google access through
the user's Google account and rotate the production OAuth secret through the
normal deployment process.

## 5. Accepted beta residuals

- Pod data and integration configuration are not application-level encrypted
  at rest. Pod now forces its data/config directories to owner-only access and
  credential files to `0600`; FileVault remains the machine-level mitigation.
- The PIN uses scrypt with automatic migration from legacy SHA-256 records, but
  remains a local UX lock rather than filesystem encryption.
- Historical private dev-data blobs must be purged from Git before public
  release.
- The full development dependency audit currently has one low Windows-only
  esbuild development-server advisory. Production dependencies are unaffected;
  do not force an unsupported esbuild override outside `tsx`'s declared range.

These residuals must remain visible in release approval; none supports a claim
of production-quality semantic retrieval or full Smartware specification
conformance.
