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
  vendor that release into Pod. Never patch `vendor/smartware` directly.
- Reusable substrate implementation with no wire change: implement and release
  it in Smartware first, then vendor it into Pod.
- Pod product behavior, orchestration, UI, or harness-specific materialization:
  keep it in Pod and adapt it to the current Smartware contract.

When Pod consumes a new Smartware release, update
`smartware-vendor.lock.json` and `docs/smartware-authority.md` with the vendor
snapshot, and run the vendor verification and complete beta gate. “Latest”
means the latest reviewed stable Smartware release, never an unreviewed
floating branch.
