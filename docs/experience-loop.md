# Pod Experience Loop

**Status:** Pod protocol extension on Smartware v0.4.2
**Canonical authority:** Smartware observations remain the source of truth;
experience lessons are disposable derived projections.

The experience loop lets one agent record a failed attempt and either a
self-reflection or corrective feedback, then lets another authorized agent
receive the resulting lesson in a later context pack. Successful later runs
act as application receipts. It does not add a memory verb and it does not let
agents rewrite user-owned facts.

## Contract

Clients write both event forms through `OBSERVE` (`POST /pod/observe`) with an
`application/json` body whose `kind` is `experience_event`.

### Completed attempt

```json
{
  "actor_id": "agent:hermes-coder",
  "operation_id": "op_00000000000000000000000001",
  "scope_alias": "workspace",
  "type": "agent_run_completed",
  "content_format": "application/json",
  "content": {
    "kind": "experience_event",
    "event": "attempt_finished",
    "task": {
      "key": "publish-coffee-desktop",
      "goal": "Publish the signed desktop application",
      "environment": "macos-release",
      "tags": ["desktop", "release"]
    },
    "attempt": {
      "id": "attempt-release-1",
      "status": "failure",
      "summary": "The upload started before the UI bundle existed.",
      "error_signature": "missing-dist-ui",
      "reflection": "The release check only verified the server bundle.",
      "recommended_action": "Run the complete build and verify dist-ui before upload.",
      "applies_when": "Publishing a Coffee desktop release from macOS."
    }
  }
}
```

When a failed attempt carries a reflected better action, Pod creates a
lower-confidence `agent_reflection` candidate without inventing advice. A
human correction can create or strengthen a `user_feedback` candidate.
Successful attempts use the same event and may include `applied_lesson_ids`;
that evidence upgrades the referenced lesson from `candidate` to `validated`
and records a visible `learning_applied` receipt.

### Corrective feedback

```json
{
  "actor_id": "person-local",
  "operation_id": "op_00000000000000000000000002",
  "scope_alias": "workspace",
  "type": "feedback",
  "content_format": "application/json",
  "content": {
    "kind": "experience_event",
    "event": "feedback_received",
    "task": { "key": "publish-coffee-desktop" },
    "attempt_id": "attempt-release-1",
    "feedback": "Prove both production bundles exist before uploading.",
    "recommended_action": "Run the complete production build and verify dist-ui before upload.",
    "applies_when": "Publishing the Coffee desktop application."
  }
}
```

The task key and attempt ID must match a prior failed attempt in the same
scope. Pod deterministically derives a lesson with references to both source
observations. Repeated equivalent feedback shares a stable lesson ID.

## Context transfer

`POST /pod/context` and the `pod_context` MCP tool accept an optional structured
task descriptor:

```json
{
  "scope": "workspace",
  "query": "How should I publish the desktop release?",
  "task": {
    "key": "publish-coffee-desktop",
    "goal": "Publish the signed desktop app",
    "environment": "macos-release",
    "tags": ["release"]
  }
}
```

Applicable lessons are packed before ordinary recalled claims, within the same
agent context budget. Each result includes its instruction, prior failure,
scope, validation state, contributing actors, and evidence observation IDs.

The MCP server also exposes `pod_record_experience`, a typed convenience tool
that maps directly onto the same `OBSERVE` envelope.

## Session lifecycle adapter

`pod_session_start` accepts the same optional task descriptor and returns
applicable lessons with its initial context. `pod_session_end` accepts an
optional `experience` envelope containing `status`, a reflected better action,
an error signature, or applied lesson IDs. Pod stores start and end as distinct
source events, so Smartware idempotency retains the complete trajectory.

This gives Hermes, Codex, and other MCP clients one ordinary lifecycle path:
start with relevant lessons, finish with an outcome, and let the next
authorized client benefit without installing a harness-specific memory store.

## Early harness adapters

Pod binds identity to an isolated harness configuration boundary, not to a
chat thread. Every bound profile receives its own Pod actor and revocable
token while contributing authorized observations and outcomes to the same
user-owned Pod.

| Harness | Pod profile boundary | Setup |
| --- | --- | --- |
| Claude Code | Local installation | Automatic HTTP MCP entry |
| Codex | Local installation | Automatic TOML MCP entry |
| Hermes Agent | Native Hermes profile | Profile-specific YAML MCP entry |
| OpenClaw | `--profile` state directory | Automatic `openclaw mcp set` entry |
| Kimi Code | Local installation or `KIMI_CODE_HOME` | Automatic user-level JSON MCP entry |
| DeerFlow | Deployment / `extensions_config.json` | Automatic when `DEER_FLOW_EXTENSIONS_CONFIG_PATH` or `DEER_FLOW_PROJECT_ROOT` is set |

Hermes profiles and OpenClaw state profiles are hard identity boundaries and
can each use a different Pod token. OpenClaw agents routed inside one state
profile share that profile's Pod identity. DeerFlow custom agents currently
share the deployment-level MCP registry; use separate extensions configs when
independent provenance or revocation is required. Native per-agent middleware
can narrow those two boundaries in a later adapter without changing the Pod
lifecycle protocol.

## Dream and usefulness

Pod's shared Dream cycle runs daily by default and can also be invoked
with `POST /pod/dream`. Each cycle runs Smartware's six derived-only integrity
phases and rebuilds experience projections in every current data space.

Lessons carry separate confidence and utility scores. Source strength,
repeated evidence, successful applications, failures, and age influence their
ordering. A model- or agent-proposed lesson remains visibly tentative until a
later successful attempt cites it. The owner can inspect this ledger through
`GET /pod/experience/lessons` or the **Learnings** view.

## Safety boundary

- Lessons never become user-authored claims or profile facts.
- Only accepted, non-sensitive, non-private observations can produce a
  transferable lesson.
- A receiving agent can only retrieve lessons from scopes it is already
  allowed to read.
- Tombstoned or redacted source observations stop contributing when the
  projection is rebuilt.
- Derived files under `derived/experience` may be deleted and reconstructed
  from canonical evidence.

Pod does not generate a lesson from an unstructured failure alone. Automatic
capture still requires a source-backed better action from the session's agent
reflection or a human correction; this avoids turning plausible model advice
into durable user truth.
