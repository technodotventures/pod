# Smartware Authority and Vendoring

This document defines the Smartware contract that Pod ships against.

## Authority

- The public [Smartware repository](https://github.com/technodotventures/Smartware)
  is the source of truth for substrate behavior.
- Pod consumes a named Smartware release through the committed
  `vendor/smartware` snapshot. Runtime builds never substitute an arbitrary
  sibling checkout.
- Smartware remains app-neutral. Pod owns its Meetings, Documents, Tasks,
  Coffee, and other product-specific data spaces and presentation.
- The specification, wire protocol, schemas, implementation, and conformance
  status are versioned separately and must not be treated as interchangeable.

## Current baseline

| Artifact | Version / identity |
|---|---|
| Package | `smartware` v0.6.1 |
| Release tag | `v0.6.1` |
| Release commit | `d8a2126a3c30d5be5e6b3a4c0f64cd22544ee172` |
| Specification | v1.6.16; SHA-256 `43cc5f8b5f9c9f7d8fefb9285198162b609c8f8a4ec3963404de4132e4e77adf` |
| Protocol | v0.4.2 |
| Schemas | v0.4.2; checksums in `schemas/v0.4.2/SHA256SUMS` |
| Vendored source | Exact release source, docs, schemas, tests, and package metadata |
| Vendored distribution | Rebuilt from the exact release source |

The same identities are recorded in `smartware-vendor.lock.json`. That file is
the machine-readable vendor provenance record; this table is the
human-readable release claim.

The current implementation status is documented in
`vendor/smartware/docs/conformance-status.md`. Passing the behavioral suite
establishes the tested v0.6.1 boundary; it does not claim complete
implementation of every design in Spec v1.6.16.

## Runtime contract

Pod relies on these Smartware guarantees:

- authorization and lifecycle eligibility are applied before ranking and
  result limits;
- canonical lexical retrieval remains available without a model provider;
- optional semantic and hybrid retrieval preserve policy, evidence identity,
  temporal constraints, and deterministic tie-breaking;
- valid time and transaction time can be constrained independently;
- observations, claims, operation records, semantic materialization, and
  effective-current state recover deterministically within the documented
  single-process crash-consistent boundary;
- Dream is an owner-only, derived inspection primitive and does not silently
  promote generated material into user-authored truth; and
- production dependency audits are enforced at the lowest severity threshold.

The exact storage boundary is described in
`vendor/smartware/docs/atomicity.md`, retrieval in
`vendor/smartware/docs/retrieval.md`, and Dream in
`vendor/smartware/docs/dream-status.md`.

Pod supplies the host layer above that substrate:

- registration and naming of product-specific data spaces;
- consent and client connection flows;
- retrieval orchestration, answer generation, and visible evidence markers;
- scheduling and presentation of derived experiences; and
- backup, restore, diagnostics, and product release policy.

### Session lifecycle adapter

Smartware v0.6.1 deliberately reports session-end durability as not configured
when no persistence callback is wired; it does not emit a fictional
`claims_persisted` count. Pod's `/pod/session/checkpoint` adapter is therefore
the load-bearing resumable-state path for beta sessions. Agents must write a
checkpoint before a durability boundary such as pre-compaction or shutdown;
`/pod/session/end` records the completion outcome but is not a substitute for
the bounded checkpoint envelope.

The adapter requires a previously started session in the same actor and scope,
a stable Smartware `operation_id`, the deterministic `checkpoint_id`, trigger
and generation, the resolved scope, and a source digest. It stores the v1
envelope through normal `OBSERVE`, so exact retries replay the original result
and changed retries conflict. The payload should contain only minimum resumable
state: a short summary, decisions, and open loops—not transcript copies,
secrets, duplicates, or unsupported speculation.

Session start now calls the same lane-aware context planner as `/pod/context`.
Compared with the previous path, turn-one context can include conversation
memory in addition to claims, lessons, and the scoped self profile. This is an
intentional behavior change so beta testing exercises the real retrieval path.

### Stored-context trust boundary

The primary untrusted-memory surface is Pod's integration ingestion—not its
own reviewer or Dream output. Slack messages, GitHub issue and review text,
email, Drive, Calendar, Notion, and Linear content are third-party-authored text
that may later become agent context. Their ingestion adapters scan for prompt
override, prompt disclosure, credential-exfiltration, role-reassignment, and
invisible-control patterns. Flagged source text remains in Pod's source object
store but is replaced by a reference-only record before automatic Smartware
projection. Clear text is marked as third-party reference material with no
instruction authority.

On read, every normalized RECALL evidence item carries
`instruction_authority: none` plus source actors, trust basis, and provenance.
Uniform scanning of internally generated reviewer and Dream candidates remains
a second-order hardening step rather than a beta prerequisite.

Smartware semantic retrieval remains advisory. Pod's canonical result stays
authoritative in `off` and `shadow` modes. `fallback` may use the Smartware
hybrid result only when the canonical result is weak, and the mode is not
exposed as an end-user toggle.

## Change classification gate

Every Pod change that touches memory or portability must be classified before
implementation:

| Change kind | Authority | Required sequence |
|---|---|---|
| Canonical artifact, wire shape, identifier, lifecycle, authorization, provenance, or retrieval invariant used by independent hosts | Smartware | Spec/protocol/schema as applicable, implementation, conformance tests, named release, vendor into Pod, then Pod adapter |
| Reusable substrate behavior without a wire change | Smartware | Implementation and behavioral tests, named release, vendor into Pod, then consume |
| Pod workflow, UI, product data space, orchestration, or harness-specific projection | Pod | Implement against the pinned Smartware contract and test the adapter |

Do not promote a Pod response shape into the Smartware protocol merely because
it is useful to Pod. A shape becomes a Smartware concern when independent
hosts need the same canonical meaning or need to exchange it without a
Pod-specific adapter. Conversely, target-specific files and commands for
Hermes, Codex, Claude Code, OpenClaw, or Kimi Code remain Pod adapter behavior.

The portable agent-profile manifest is currently a versioned Pod host
contract. If it becomes a cross-host interchange contract, its generic
artifact envelope, integrity, provenance, compatibility, and permission
semantics must graduate through Smartware's spec, schemas, implementation, and
conformance process. Native harness materializations must stay outside the
Smartware protocol.

The OpenClaw migration planner, conflict choices, receipts, bounded rollback,
and Hermes/Claude/Codex/OpenClaw/Kimi projections are therefore Pod adapter
behavior. Imported long-term memory does not create a second canonical
lifecycle: it becomes an ordinary Smartware observation with source
provenance, scope authorization, artifact lineage, and tombstone rollback.
This classification must be revisited before another host is expected to
exchange migration plans, instruction sets, skill packages, or receipts
directly. At that point the host-neutral envelope and lifecycle graduate
upstream first; source and target adapters remain in Pod.

## Verification baseline

The release snapshot is accepted only when all of the following pass:

- the machine-readable vendor provenance and snapshot digest;
- Smartware build and behavioral suite;
- all versioned schema checksum and compilation checks;
- the deterministic retrieval-kernel contract;
- the retrieval arena's hybrid gate;
- the activation contract, including its expected hold on development-only
  evidence;
- a production dependency audit with zero findings;
- installation and import of the packed `smartware` and `smartware/mcp`
  entry points; and
- Pod's type checks, behavioral tests, retrieval fixtures, production build,
  and beta acceptance journey against the rebuilt vendor snapshot.

## Update rule

For every Smartware update:

1. Start from a named public Smartware commit or tag.
2. Run the standalone Smartware verification baseline.
3. Copy the reviewed source, docs, schemas, tests, and package metadata into
   `vendor/smartware`, then rebuild `vendor/smartware/dist`.
4. Keep the vendor source free of Pod-only patches. Product-specific behavior
   belongs in Pod.
5. Update `smartware-vendor.lock.json`, including its exact snapshot digest,
   and update the baseline table in this document.
6. Run `npm run verify:smartware-vendor`, the vendored Smartware verification
   suite, and Pod's complete beta gate.
7. Confirm `npm run check:smartware-upstream` resolves the named tag to the
   recorded commit and no newer stable release exists.
8. Commit the vendor snapshot, provenance lock, and authority record together.

Docker and packaged builds consume only the committed vendor tree. A dirty
vendor working tree is not a release input.

## Freshness policy

Pod pins the latest **reviewed stable release**, not a floating branch. A
scheduled check compares the pinned release with upstream stable tags and
fails visibly when a newer release is available. A changed upstream `main`
without a new tag is reported as unreleased work and does not silently alter
Pod.

This makes drift visible without bypassing review, migrations, compatibility
analysis, or conformance. At the time this baseline was checked on 2026-08-06,
`v0.6.1` was the latest stable tag. Its peeled tag resolves to release commit
`d8a2126a3c30d5be5e6b3a4c0f64cd22544ee172`, recorded inline so the claim
remains auditable even when repository access is unavailable.
