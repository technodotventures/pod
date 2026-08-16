# Portable agent profiles

**Status:** version 1 manifest, reviewed OpenClaw import, reversible receipts,
and non-destructive native materialization previews.

Pod owns the user memory, agent identity, context policy, capability bindings,
and connection authority. Agent harnesses remain the places where work is
executed. A portable agent profile is therefore a secret-free description of
one Pod agent, not a backup of a harness home directory.

## Manifest

`GET /pod/registry/agents/:agent_id/profile-manifest` returns:

- identity, persona, description, status, and preferred model;
- semantic instruction slots for soul, operating rules, and source identity;
- effective read and write data-space names plus the context token budget;
- assigned skill identities, versions, sources, permissions, trust, and
  binding status;
- the complete text package for skills imported through a reviewed migration;
- active or expired integration tool grants without credentials;
- the Pod MCP endpoint and a logical bearer-token secret reference;
- supported materialization targets;
- Pod provenance and a SHA-256 integrity digest.

The manifest never contains the agent bearer token, integration credentials,
OAuth state, private keys, cookies, caches, embeddings, or runtime session
databases. Registry-backed skills remain requirements at their declared
portable source. A secret-scanned skill package imported into Pod carries its
text files and digests in the manifest, remains blocked in Pod, and is only
projected as a reviewed file operation. Import never executes package code.

## OpenClaw to Pod to Hermes

The Agents screen exposes a bounded migration flow for an existing Pod agent.
The HTTP equivalents are:

- `POST /pod/registry/agents/:agent_id/migrations/openclaw/preview`;
- `POST /pod/registry/agents/:agent_id/migrations/openclaw/apply`;
- `GET /pod/registry/agents/:agent_id/migration-receipts`; and
- `POST /pod/registry/agents/:agent_id/migration-receipts/:receipt_id/rollback`.

Preview discovers one OpenClaw workspace and returns paths, byte counts,
digests, conflicts, exclusions, and a content-addressed `plan_digest`. It does
not return instruction or memory content. Apply rescans the source and rejects
the operation if the source or target profile changed after preview.

Version 1 imports:

- `SOUL.md`, `AGENTS.md`, and `IDENTITY.md` into semantic instruction slots;
- `USER.md`, `MEMORY.md`, and Markdown files below `memory/` as Pod objects
  backed by ordinary Smartware observations in an agent-writable scope;
- text-based skill packages rooted at `SKILL.md`, including supporting scripts,
  references, configuration, and SVG assets;
- the allowlisted preferred model from `openclaw.json`; and
- source paths, digests, target agent, memory scope, conflicts, resolutions,
  changed profile-field names, created object IDs, skill IDs, and observation
  IDs in a content-free migration receipt. Prior profile values are retained
  only in the Pod-local rollback state and are not returned by receipt APIs.

High-confidence secrets cause the containing memory, instruction, or skill
package to be skipped. Configuration is parsed only to extract allowlisted
non-secret preferences. `.env` files, credentials, auth profiles, cookies,
sessions, logs, caches, agent state databases, native plugins, extensions,
hooks, and cron state are never copied. `TOOLS.md`, `HEARTBEAT.md`,
`BOOTSTRAP.md`, and `DREAMS.md` are reported as unsupported rather than being
silently reinterpreted.

Apply is idempotent for the same plan and conflict resolutions. Imported skills
are `blocked` and assigned with a `pending` binding. The response includes the
Hermes materialization preview but does not write to `$HERMES_HOME`.

Rollback retires the Smartware observations, soft-deletes the created Pod
objects, removes the created skill records, and restores profile fields only
when they still equal the values set by the migration. Later unrelated edits
are preserved and reported as warnings rather than overwritten.

## Native previews

`GET /pod/registry/agents/:agent_id/profile-materializations/:target_id`
projects the current manifest into one native target. The response has
`writes_state: false`; it returns structured file operations and command
arguments for review but does not touch the harness.

| Target | Identity projection | Pod connection projection |
| --- | --- | --- |
| Hermes | `$HERMES_HOME/SOUL.md`, `AGENTS.md`, and portable skills | merge model and Pod MCP into `$HERMES_HOME/config.yaml` |
| Codex | `$CODEX_HOME/AGENTS.md` and portable skills | merge into `$CODEX_HOME/config.toml` |
| Claude Code | `~/.claude/CLAUDE.md` and portable skills | `claude mcp add` at user scope |
| OpenClaw | workspace `SOUL.md`, `AGENTS.md`, and portable skills | `openclaw mcp set` for the bound profile |
| Kimi Code | agent Markdown and portable skills | merge into `$KIMI_CODE_HOME/mcp.json` |

Every preview references `COFFEE_POD_AGENT_TOKEN` rather than embedding its
value. An eventual apply operation must resolve that reference locally, ask
for any required approval, preserve unrelated native configuration, and verify
the resulting MCP connection.

## Portability boundary

The manifest is an interoperability contract. A full Pod backup is a recovery
snapshot and may contain private memory and connector credentials; it must not
be used as a hotswap format.

Version 1 is deliberately a Pod host contract, not a Smartware Protocol
extension. Identity projection, MCP endpoint composition, and native
materializations for Hermes, Codex, Claude Code, OpenClaw, and Kimi Code are
product and adapter concerns.

The Capabilities Module may retain Agent Plugin packages, but
`coffee-pod-agent-profile/v1` remains Skill-only. Plugin Skills are not
flattened into `capabilities.skills`, and Plugin manifests, MCP entries, and
client extensions are not added to the v1 profile. A Plugin deployment Adapter
must own aggregate compatibility and materialization until a deliberate
profile v2 is specified.

If independent memory hosts need to exchange the same profile directly, the
host-neutral artifact envelope must be proposed upstream. Its type identity,
versioning, digest, provenance, compatibility, permission, lifecycle, and
secret-reference semantics then belong in the Smartware spec and schemas,
backed by implementation and conformance tests before Pod consumes a named
Smartware release. The native target projections remain outside the protocol.

Version 1 covers state Pod already owns plus a reviewed OpenClaw source
adapter. Later versions can add first-class capability packages for native
plugins, workflow and automation definitions, resumable task checkpoints,
deliverable lineage, agent topology, channel bindings, and evaluation packs.
Executable packages should carry a source, version, digest, compatibility
declaration, configuration schema, and requested permissions; importing one
must never execute it automatically.
