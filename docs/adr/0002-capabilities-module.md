# ADR-0002: Capabilities presents Skills and Plugins without flattening them

- Status: Accepted
- Date: 2026-08-07

## Context

ADR-0001 established a Pod-owned revisioned Skill estate. Agent Plugins adds a portable aggregate package containing Skills, MCP server declarations, and client-specific extensions. Renaming Skill storage or treating every nested Plugin Skill as an independent Skill would erase aggregate review, compatibility, credential, and deployment semantics.

Pod already exposes `/pod/capabilities` as a protocol discovery interface. Changing that interface into the product Library would break an unrelated contract.

## Decision

1. Capabilities is the user-facing product Module containing separate Skill and Plugin aggregates.
2. Existing `/pod/skills/*` interfaces and Skill tables remain intact.
3. Agent Plugin lifecycle uses `/pod/plugins/*` interfaces and separate Plugin persistence.
4. A Plugin revision retains its complete immutable package, manifest, validation report, and derived component index.
5. Nested Plugin Skills remain owned by the Plugin revision. They are not silently flattened into standalone Skill identities.
6. Invalid or unsupported Plugin components are isolated according to the narrowest relevant failure scope.
7. Package files never contain Pod credentials. Future Plugin credential bindings reference Pod Connections separately.
8. Existing `coffee-pod-agent-profile/v1` remains Skill-only. Plugin deployment uses a separate Adapter until a deliberate profile v2 exists.
9. The existing `/pod/capabilities` protocol discovery interface is unchanged.

This is Pod product workflow and harness-specific materialization under `docs/smartware-authority.md`. The external Agent Plugins schema is validated as an input format; Pod does not redefine it as a Smartware artifact.

## Consequences

- The navigation and lifecycle UI can say Capabilities while preserving precise Skill and Plugin semantics.
- Plugin approval can precede agent compatibility, credential binding, or deployment.
- Tests can exercise Plugin validation and lifecycle through one deep package Module and one persistence interface.
- Plugin deployment needs its own aggregate Adapter and may report partial compatibility; it must not reuse Skill synchronization as if every Plugin were one Skill.
