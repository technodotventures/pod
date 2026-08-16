# ADR-0001: Skills are a Pod-owned revisioned estate

- Status: Accepted
- Date: 2026-08-06

## Context

Skills previously combined mutable registry metadata, review state, Smartware grants, and guessed local files in one record. Generic Docs objects sometimes held Skill content, while agent bindings were presented as if they represented native file installation. This made capabilities isolated between agents and made it impossible to distinguish approval, authorization, deployment, and drift.

## Decision

Pod owns a first-class Skill estate with these invariants:

1. A Skill is a stable identity with immutable revisions.
2. Package identity hashes normalized file paths and contents only, allowing identical packages from different agents to converge.
3. Draft revisions enter the Inbox; one approved revision is canonical in the Library.
4. Smartware authorization assignments remain separate from native agent deployments.
5. A deployment records desired and observed revisions, writes through a target adapter, verifies the result, and refuses silent overwrite when drift is present.
6. Codex and Claude Code are the first two native package adapters. External registries remain Discover adapters.
7. Generic Docs objects may remain searchable or exportable projections, but they are not the canonical Skill package store.

This is Pod product workflow and harness-specific materialization under `docs/smartware-authority.md`. It does not change Smartware's canonical artifact model. A future host-neutral Skill interchange contract must graduate through Smartware before independent hosts rely on it.

## Consequences

- Users can approve a Skill before assigning or deploying it.
- Agent authorization can be disabled without deleting canonical revisions.
- Identical packages discovered in separate agents deduplicate, while changed packages become new drafts.
- Deployment state can honestly report ready, synchronized, blocked, or drifted.
- Applying over divergent target content requires a future explicit reconciliation workflow; the initial implementation blocks the write.
- Existing registry and grant behavior remains compatible while the older mutable `skills.version` and `skills.status` fields become projections of the revisioned lifecycle.
