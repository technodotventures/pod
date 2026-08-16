# Support diagnostics

Pod exposes an owner-only `GET /pod/diagnostics` report and a matching
**Settings → Support** preview. The user downloads the exact JSON they reviewed;
Pod does not upload or retain generated reports.

## Included

- Pod, Smartware, Node, Electron, OS, and architecture versions
- Pod SQLite `quick_check` and `user_version`
- Smartware layer counts and replay position
- canonical operation counts by known operation type
- unresolved and malformed operation-intent counts
- connector availability, connection state, and scope-mismatch flags
- up to 100 content-free request-error events within a seven-day report window
- static issue codes suitable for support triage

Request-error events contain only timestamp, HTTP method, registered route
template, status code, an allowlisted error name/code, and a deterministic
fingerprint. Error messages and stack traces are never stored in the diagnostic
event ring. The ring is local, mode `0600`, and rotates at 1 MiB.

## Excluded

- memories, observations, claims, documents, prompts, and snippets
- raw canonical operation logs and full Pod exports
- owner, actor, instance, source, and operation identifiers
- filesystem paths and hostnames
- API keys, OAuth credentials, cookies, authorization headers, and tokens
- arbitrary error messages and stack traces

Report construction uses an allowlist and then runs a deterministic privacy
scan. If the scan encounters a prohibited key, a common secret pattern, or a
user-home path, report generation fails closed with `diagnostics_failed`.

## Operational boundary

This is a support report, not telemetry collection. There is no automatic
upload, remote collector, crash-reporting service, or consent grant. A future
upload workflow must remain a separate explicit user action and must not reuse
the full `/pod/export` backup because that archive contains user memory.
