# Findings

This file is the living audit index for Pod.

## Current audit: 2026-08-24

Source note: [docs/audits/2026-08-24-pod-audit.md](audits/2026-08-24-pod-audit.md)

| ID | Severity | Status | Summary |
|---|---|---|---|
| POD-AUDIT-001 | High | fixed | Packaging / CI drift: vendored Smartware references remained after the repo switched to npm consumption. Updated Dockerfile, workflow, docs, and release-check scripts; verified with `npm ci`, `npm run verify:smartware-release`, `npm run check:smartware-upstream`, `npm run lint`, `npm run build`, and `npm audit --omit=dev`. |
| POD-AUDIT-002 | Medium | open | Agent bearer tokens are stored plaintext in SQLite. |
| POD-AUDIT-003 | Medium | open | `/pod/watch` trusts the caller-supplied `actor_id` after auth. |

Update statuses here when a finding is fixed or explicitly rejected.
