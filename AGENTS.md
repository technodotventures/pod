## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a single-context layout. See `docs/agents/domain.md`.

## Smartware authority gate

Before changing memory semantics, canonical artifact shapes, authorization,
lifecycle, retrieval, provenance, or cross-host interoperability, read
`docs/smartware-authority.md` and classify the change:

- Cross-host invariant or canonical wire/storage behavior: implement and verify
  it in the public Smartware repository first, publish a named release, then
  consume that release through Pod's pinned npm lockfile. Never patch the
  installed Smartware package in place.
- Reusable substrate implementation with no wire change: implement and release
  it in Smartware first, then update Pod to the reviewed package release.
- Pod product behavior, orchestration, UI, or harness-specific materialization:
  keep it in Pod and adapt it to the current Smartware contract.

When Pod consumes a new Smartware release, update
`smartware-vendor.lock.json` and `docs/smartware-authority.md` with the vendor
snapshot, and run the vendor verification and complete beta gate. “Latest”
means the latest reviewed stable Smartware release, never an unreviewed
floating branch.

## Design lint

After making changes, run `npm run lint` and fix all errors — it runs the
typecheck plus the design lint (`@shadcn/lint` via oxlint; scoped rules and
allowlist in `.oxlintrc.json`). Design rules and approved exceptions: `DESIGN.md`.
`npm run lint:design` runs the design lint alone.
