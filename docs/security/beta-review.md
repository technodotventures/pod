# Pod Mac Beta — Security Review

The original audit was performed against commit `614c382` on branch `main`.
The findings below remain the historical record; the 2026-07-15 beta handoff
also revalidated the current dependency tree, Mac package, support diagnostics,
backup/restore path, and vendored Smartware boundary.

Current revalidation: Electron was upgraded to patched release 39.8.10, the unused Anthropic SDK
and vulnerable media parser were removed, and `npm audit --omit=dev` reports no
production dependency advisories. The only full-tree advisory is low severity
and limited to the Windows development server. ASAR and the branded icon are
configured, but the package is still unsigned and unnotarized and therefore not
approved for external release.

## Severity rubric

- **Critical** — unauthenticated remote/local attacker exfiltrates the vault or
  pivots to the host.
- **High** — unauthenticated local attacker exfiltrates a specific account or
  reads arbitrary files; or recovers a credential at rest.
- **Medium** — requires partial auth, yields DoS, or leaks information.
- **Low** — defense-in-depth, packaging hygiene, documentation.

Status codes:
- `fixed` — patched on this branch with a regression test.
- `mitigated` — partial fix shipped, residual risk documented.
- `accepted` — risk acknowledged, no change in this beta.
- `follow-up` — tracked for a later release.

## Findings

### CP-SEC-001 · Local HTTP API ships unauthenticated in the packaged app · Critical · fixed

The Electron main process spawns the Fastify server without setting
`COFFEE_POD_API_TOKEN` (`electron/main.cjs:34-45`). `registerOptionalApiTokenAuth`
treats an absent token as "no auth" (`src/security/auth.ts:43-46`), so any
process on the user's Mac — or any web page that DNS-rebinds to `127.0.0.1` —
can read the entire vault, import arbitrary local folders, and exfiltrate Drive
content.

**Fix.** Electron main auto-provisions a 256-bit token at first launch, stores
it under `userData/data/.coffee-token` (mode `0600`), and passes it to the
spawned server. A new preload script exposes the token to the renderer via
`contextBridge`, and a thin fetch wrapper in `ui/src/main.tsx` attaches
`Authorization: Bearer …` to every same-origin request. Public routes (PIN
status/verify, OAuth callback, `/health`, `/docs`) keep working without the
header. Third-party callers (Coffee staging etc.) continue to use the
`/coffee/connect` flow which is unchanged.

**Test.** `src/test/security.test.ts` boots the app with a token set and
verifies a representative set of routes return 401 without the header.

### CP-SEC-002 · DNS-rebinding bypasses localhost-only binding · High · fixed

Fastify is started with no `Host`/`Origin` allowlist. A browser tab on an
attacker-controlled origin can lower its DNS TTL, swap the resolved IP to
`127.0.0.1`, and issue same-origin requests against the Pod. Even with
CP-SEC-001's token, a malicious page that learns the token (e.g. via a leaked
log) keeps working until a process restart.

**Fix.** A new `src/security/host-guard.ts` hook rejects any request whose
`Host` header is not in `{127.0.0.1, localhost}[:port]`, with `:port`
matching the configured `COFFEE_POD_PORT`. Registered ahead of the auth hook
in `src/app.ts`.

**Test.** Probe with `Host: evil.example` returns 421.

### CP-SEC-003 · Google Drive OAuth state mismatch is logged-and-ignored · High · fixed

`src/routes/google-drive.ts:215-217` logs a warning when the OAuth `state`
returned by Google does not match the value the Pod stored, then exchanges the
code anyway. Combined with the unauthenticated API in CP-SEC-001, any page in
any browser could hit
`/integrations/google-drive/callback?code=ATTACKER_CODE&state=anything`,
causing the Pod to swap the attacker's authorization code for a refresh token
and overwrite the user's stored credentials — silently routing future Drive
reads to the attacker's account.

**Fix.** State mismatch now hard-fails with a 400 and a clean HTML error page.
Missing state on the Pod side (e.g. user restarted the app mid-flow) is also
rejected. The `client_id` is no longer echoed by `/status` to non-owners; cap
added on `/import?limit=` (≤50).

**Test.** Callback with wrong state returns 400; `/status` returns minimal
fields for unauthenticated callers.

### CP-SEC-004 · Skill registry proxies forward arbitrary paths and content-types · Medium · fixed

`/pod/skills/registry/clawhub/*` and `/pod/skills/registry/skillsmp/*`
(`src/routes/skills.ts:246-262, 318-334`) concatenate the user-controlled
wildcard path into a fixed upstream URL and forward the upstream
`content-type` verbatim. The fixed base prevents classic SSRF, but a malicious
or compromised upstream could return `text/html` and turn the cockpit UI into
a stored-XSS target the next time the response is rendered.

**Fix.** Path is now validated against `^[A-Za-z0-9/_-]+$` (no `..`, no
encoded traversal, no scheme injection). Response `content-type` is clamped
to `application/json` regardless of what the upstream sends.

**Test.** `..%2F..%2Fadmin` rejected with 400; HTML upstream response is
re-typed as JSON.

### CP-SEC-005 · Client-token store written with default umask · Medium · fixed

`src/security/client-tokens.ts:53-56` writes `coffee-clients.json` without an
explicit file mode; the default umask on macOS yields `0644`, allowing any
other local user (or process not under the current user's home) to read
issued token hashes. Hashes are unsalted SHA-256 of 256-bit secrets so brute
force is not feasible, but the file also leaks the list of client identities
and grant ids.

**Fix.** Write with `mode: 0o600` and `chmod` on save, matching the PIN
store.

### CP-SEC-006 · PIN verify has no rate limit · Medium · fixed

`POST /pod/pin/verify` is on the public allowlist (`src/security/auth.ts:16-24`)
and increments a counter on failure but applies no backoff. An attacker on
localhost (or via DNS rebinding) can brute-force a 4-digit PIN in seconds.

**Fix.** Per-IP token bucket via Fastify hook: after 5 consecutive failures,
verify responses are delayed exponentially up to 30 s and return 429 after
the 10th failure within 10 minutes. Counter resets on success.

### CP-SEC-007 · Folder import accepts any absolute path · Medium · fixed

`POST /pod/import/folder` (`src/routes/folder-import.ts:43-78`) walks any
absolute path the caller supplies. Extensions are filtered (markdown, text,
PDF…), but combined with CP-SEC-001 the API can be coerced into ingesting
private docs from anywhere on disk into the Pod's database.

`walkDirectory` already declines to follow symlinks
(`src/services/file-processor.ts:176-192`, `Dirent.isDirectory()` is false for
symlinks), but the entry path is not guarded.

**Fix.** Resolve the path with `fs.realpath`, reject if it escapes the user's
home directory or resolves into `~/Library`, `~/.ssh`, or `/etc`. Reject
paths that contain `..` post-normalisation. Symlink behaviour documented.

### CP-SEC-008 · Upload endpoint allows 5 GB per request · Medium · fixed

`src/routes/upload.ts:24,30-32` allows 50 files × 100 MB. Total request size
is unbounded and the content is stored as a JSON blob in SQLite, risking
disk-fill on the user's Mac.

**Fix.** Per-request total cap of 250 MB enforced via `@fastify/multipart`'s
`fieldSize`/`fileSize` plus a running byte counter that aborts the request
once exceeded.

### CP-SEC-009 · OAuth callback HTML interpolates `query.error` unescaped · Low · fixed

`src/routes/google-drive.ts:209` writes `query.error` directly into an HTML
response. Google controls the value in practice, but defense-in-depth dictates
escaping.

**Fix.** HTML-escape `query.error` before interpolation.

### CP-SEC-010 · Fastify request logger may serialize Authorization headers · Medium · fixed

`buildApp` (`src/app.ts:25-26`) constructs Fastify with `logger: true` and no
redaction config. Once CP-SEC-001 lands, every request carries
`Authorization: Bearer …` which would be logged to
`coffee-pod-server.log`.

**Fix.** Configure Pino redaction paths
(`req.headers.authorization`, `req.headers["x-coffee-pod-token"]`,
`req.headers.cookie`) when constructing the logger.

### CP-SEC-011 · Mac bundle is unsigned and unnotarized · High · mitigated for local engineering / blocker for external beta

`package.json` sets `mac.identity: null`. Beta testers will face Gatekeeper
warnings, and notarization is mandatory for unattended installs on Apple
Silicon.

**Status.** ASAR is enabled with only `better-sqlite3` and
`@napi-rs/canvas` native files unpacked, and the existing branded icon is
configured. A real isolated ASAR package passed `/health`; the final signed
artifact must repeat that smoke. Developer ID credentials remain an out-of-band
deployment dependency.

### CP-SEC-012 · PIN hash uses single-round SHA-256 · Medium · fixed

Legacy `pin.json` records stored `SHA-256(pin || salt)`. New records now use
Node's memory-hard scrypt implementation, and a valid legacy PIN is re-salted
and migrated on its next successful verification. Constant-time comparison,
rate limiting, and `0600` storage remain in place. A low-entropy PIN is still a
UX lock, not a substitute for encrypting the underlying data.

### CP-SEC-014 · Upstream Electron advisories · High · resolved

The original review accepted Electron 35 advisories because the affected
features were not used. The handoff review rejected that as an adequate market
gate because Electron itself is bundled into the app. Pod now uses
patched release 39.8.10, the newest release line that also passes the current
native SQLite build, and the real packaged app has to pass the launch smoke
after every Electron change.

### CP-SEC-015 · Upstream `@anthropic-ai/sdk` advisory · Medium · resolved

Smartware uses its fetch-based provider implementation and did not import the
SDK. The unused dependency was removed from standalone and vendored Smartware,
eliminating the advisory and reducing the packaged app.

### CP-SEC-013 · `pod.db` and integration configs are unencrypted at rest · High · mitigated / accepted residual

A user with file-system access to Pod's application-support directory
reads the SQLite database, Google Drive refresh token, and every imported
document. iCloud Mail app-specific passwords are an exception: they are stored
only in macOS Keychain, and Pod's integration JSON records only the account
identifier and a `credential_stored` flag. macOS FileVault is the primary
mitigation for the remaining files today. SQLCipher or
Electron `safeStorage`-wrapped blobs would harden this for the v1 release.

**Mitigation.** Pod now creates and corrects the data and integration
directories to `0700`, corrects credential/token files and the Electron server
log to `0600`, and redacts authentication headers from request logs. Regression
coverage starts with deliberately permissive existing files and verifies their
permissions are corrected.

**Residual.** These access controls protect against other local accounts, not
malware running as the user or offline access without FileVault. Application-
level encryption still requires an explicit key/recovery and migration design;
it is treated as an accepted beta residual because the current threat model
requires FileVault.

## Out of Scope (reaffirmed)
- Cryptographic review beyond the tested Smartware integrity and recovery
  behavior documented in `docs/smartware-authority.md`.
- Cryptographic review of Smartware grants.
- Full Plate-editor XSS audit beyond imported HTML objects.
- Cloud / Docker hardening.

## Auth-coverage walk

Per-route audit results live in
[auth-coverage.md](./auth-coverage.md) (generated alongside the fix pass).
