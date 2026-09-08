# ADR-0003: Honcho-first memory can mirror into Pod as an evidence substrate

- Status: Accepted
- Date: 2026-08-24

## Context

Stevie wants Pod to work **behind** another memory system instead of replacing
it. The practical case is Honcho-first memory: the user may prefer Honcho as the
primary conversational memory layer, while Pod still needs to hold the durable
cross-application substrate that Hermes and other tools can query.

If Pod simply mirrors Honcho without structure, the two systems will drift. If
Pod tries to replace Honcho, it loses the user's chosen primary memory layer.
The bridge needs explicit authority and identity boundaries.

## Decision

Pod will treat Honcho as a **peer memory source** and mirror its outputs into a
separate, clearly marked Pod lane.

The bridge contract is:

1. **Identity mapping is explicit.**
   - Keep a server-side map between `honcho_peer_id`, `pod_actor_id`, and the
     Hermes profile or agent that owns the connection.
   - The map is the only place where those IDs are joined.
   - If the mapping is missing or ambiguous, the bridge does not guess.

2. **Honcho writes into Pod as inferred evidence, not canonical truth.**
   - Mirrored records are stored as third-party observations or conclusions.
   - Each mirrored item must carry:
     - `source_system: "honcho"`
     - `source_kind: "inference" | "summary" | "decision"`
     - `bridge_event_id`
     - `honcho_peer_id`
     - `pod_actor_id`
     - `authority: "derived"`
   - Mirrored items must never be silently promoted to user-authored canonical
     facts.

3. **Pod remains the evidence substrate.**
   - The bridge may write to Pod with authenticated `observe` calls.
   - Hermes and other clients may read from Pod with `query`, `context`, and
     related retrieval surfaces.
   - The bridge never writes canonical facts by bypassing Pod's own memory
     pipeline.

4. **Conflict is preserved, not overwritten.**
   - If Honcho and Pod disagree, both records stay visible with provenance.
   - The bridge may create a conflict marker or attention item, but it does not
     auto-resolve the disagreement.
   - User or owner review is required before canonical promotion.

5. **Deletion and retraction are reversible.**
   - If Honcho retracts a mirrored item, the bridge records a tombstone or
     superseding event in Pod rather than deleting history silently.
   - The bridge keeps the audit trail intact.

6. **Security stays server-side.**
   - Honcho credentials, Pod tokens, and any Hermes bridge secrets live behind a
     restricted adapter contract.
   - Browser code never sees bridge credentials.
   - The bridge uses the narrowest token scope available.

## Operational shape

The bridge is intentionally simple:

- **Inbound path**: Honcho event or summary -> normalize -> authenticated Pod
  `observe`
- **Outbound path**: Hermes or another client -> Pod `query` / `context` /
  `expertise`
- **Conflict path**: divergent facts -> retain both -> surface an explicit
  review item

This makes Pod the durable substrate while keeping Honcho as the preferred
front-end memory layer for the user.

## Consequences

- Stevie can keep Honcho as the primary memory system without giving up Pod's
  provenance, retrieval, and cross-app substrate.
- Hermes can reach into Pod for durable evidence instead of replacing the
  user's chosen memory layer.
- The bridge is reviewable and auditable because every mirrored event has a
  source system, a mapped identity, and an event id.
- Any later auto-merge logic will need to live behind this contract, not in the
  raw ingestion path.

## Next step

Wire Hermes to use the bridge contract: add the Pod connection, feed Pod's
retrieval surfaces into the Hermes memory path, and keep Honcho as the optional
primary layer.
