# Smartware Authority

Pod consumes Smartware as a reviewed npm release, not as a vendored source tree.
The source of truth for cross-host wire and storage behavior is still the public
Smartware repository, but Pod pins a specific release through `package.json` and
`package-lock.json`.

## Authority gate

Before changing memory semantics, canonical artifact shapes, authorization,
lifecycle, retrieval, provenance, or cross-host interoperability, classify the
change:

- **Cross-host invariant or canonical wire/storage behavior**: implement and
  verify it in the public Smartware repository first, publish a named release,
  then update Pod to that reviewed package release.
- **Reusable substrate implementation with no wire change**: implement and
  release it in Smartware first, then update Pod to the reviewed package
  release.
- **Pod product behavior, orchestration, UI, or harness-specific
  materialization**: keep it in Pod and adapt it to the current Smartware
  contract.

Pod must not patch the installed Smartware package in place. If Pod needs a
change, the change belongs upstream first.

## Release baseline

The current Pod baseline consumes the reviewed Smartware npm packages recorded in
this repository's lockfile. The important invariant is not the build host or a
local checkout; it is that the locked release, the installed release, and the
published release all match.

At the time this policy was rewritten, the pinned packages were:

- `smartware` `0.6.3`
- `@technodotventures/smartware-connectors` `0.1.0`

## Runtime contract

Pod runtime builds and Docker images must restore dependencies from
`package-lock.json` with `npm ci`. They should never depend on a sibling
checkout, a local vendor tree, or a floating branch.

Any Smartware-derived data that crosses a Pod boundary must carry its own
provenance and scope metadata. Imported conclusions, lessons, or observations do
not become canonical Pod truth unless Pod explicitly records them through its
own memory pipeline.

## Verification baseline

A Pod Smartware release is accepted only when all of the following pass:

- `npm ci` restores the locked Smartware release without drift;
- `npm run verify:smartware-release` confirms the installed packages match the
  lockfile;
- `npm run check:smartware-upstream` confirms the pinned release is still the
  latest reviewed stable release;
- the Smartware build and behavioral checks pass upstream;
- the deterministic retrieval, context packing, and provenance contracts pass;
- Pod's type checks, behavioral tests, production build, and beta acceptance
  journey pass;
- `npm audit --omit=dev` reports no production vulnerabilities.

## Update rule

For every Smartware update:

1. Change the upstream Smartware repository first.
2. Publish a named stable release.
3. Update Pod's dependency range and lockfile to that reviewed release.
4. Run `npm ci`.
5. Run `npm run verify:smartware-release`.
6. Run `npm run check:smartware-upstream`.
7. Run the full Pod beta gate.
8. Commit the dependency update and any Pod-only adaptation together.

## Freshness policy

Pod pins the latest **reviewed stable release**, not a floating branch. A
scheduled check compares the locked release with the npm registry and fails
visibly when a newer stable release is available. A changed upstream `main`
without a new release tag is treated as unreleased work and does not silently
change Pod.

This keeps drift visible without bypassing review, migrations, compatibility
analysis, or conformance.
