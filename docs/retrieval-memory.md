# Federated retrieval and conversation memory

Pod is the memory layer; agent harnesses and apps remain the places
where work happens. A Hermes profile, Codex session, Claude Code installation,
OpenClaw profile, Kimi Code installation, DeerFlow deployment, Coffee client,
or another MCP client can use the same Pod without adopting the same model or
native memory implementation.

## What crosses clients

`POST /pod/context` assembles one bounded context pack from:

- authorized Self-profile facts;
- lessons proven or proposed by prior agent outcomes;
- source-backed conversation question/resolution artifacts;
- ordinary Smartware claims.

Every row uses the same derived evidence shape: identity, type, text, scope,
source hints, canonical observation IDs, ranking signals, surrounding context,
and an optional resolver. A context pack can cross task and harness boundaries,
but it cannot cross the receiving client's data-space grants.

`POST /pod/query` accepts `scope: "all"` to search every data space the caller
may read. For a named agent, “all” means all of that agent's grants, not all of
the owner's Pod. This is the mode used by Ask Pod's **All memories** control.

## Retrieval behavior

Exact lexical retrieval remains the default. Candidate views from independent
retrievers are fused with reciprocal rank fusion, collapsed by canonical
source, and capped by source app and evidence type before answer synthesis.
Document excerpts add only the winning paragraph and one neighbor on each
side.

Temporal intent is part of retrieval eligibility rather than a post-ranking
display filter. Natural-language or explicit Pod date ranges are applied to
Smartware claim valid time before lexical ranking and semantic fusion, to
observation `observed_at`, and to an artifact's source-domain timestamps (for
example calendar start/end, message occurrence, or journal date). Artifact
`updated_at` is never treated as “when this happened.” Every normalized
evidence row keeps valid, observed, and recorded time separate. Smartware's
embedded API also supports transaction-time history for “what did the system
know then?” queries; the frozen public RECALL `as_of` wire field remains
post-beta and is still rejected by the versioned schema gateway.

Ask Pod answer synthesis is best-effort rather than a single point of failure.
When the selected model is unavailable, the owner-facing query path produces a
small, cited, extractive answer from a matching Self-profile fact or retrieved
evidence. If nothing actually answers the question, it says so plainly and
offers a concrete next step based on the active scope or timeframe. Callers
that set `use_llm: false` continue to receive retrieval results without an
answer.

Conflict-status questions use a separate deterministic lane. Pod reads only
Smartware claims already marked as contested through an authorization-aware
boundary, groups their explicit contestation links, and cites each competing
value. It does not infer a conflict from similar documents, duplicate source
views, or corroborating observations. Generic document, conversation,
connector, and expertise searches are skipped for this intent.

Self-profile questions use the same deterministic routing rule. Preferred-name,
identity, timezone, standing-preference, and “what do you know about me”
questions read only the authorized Self-profile lane unless the caller also
selects context, a timeframe, or an external connector. Registered agents see
profile facts only from data spaces in their read view. This path does not call
an answer model and reports `strategy: "profile_fast_path"` in retrieval
telemetry.

Email sync keeps an individual message as a Library object and also derives a
thread-level conversation view. A one-message thread and its object share the
same canonical observation identity during retrieval, so Ask Pod presents them
as one email source with merged retriever provenance. Multi-message threads
remain distinct from their individual messages because they carry additional
conversation context.

The owner UI may send up to eight recent user/assistant turns with a query.
These turns help resolve follow-ups and contribute the latest user topic to
retrieval, but they are prompt context rather than evidence: citations must
still resolve to sources retrieved for the current query.

`POST /pod/context` also accepts `retrieval_mode: "always" | "auto" | "never"`.
`always` is the backwards-compatible default. `auto` is a conservative,
deterministic admission gate: it skips only clearly self-contained greetings
and arithmetic, while structured tasks, empty recent-context requests, project
queries, and uncertain cases still retrieve. `never` lets a caller explicitly
assemble only its configured persona without loading persistent memory. The
response and the context-read audit receipt include the gate decision, reason,
retrieval duration, candidate counts, packed counts, and per-lane token use.
Callers may provide `source_types` to constrain candidate generation before
packing. A profile-only request therefore cannot spend its budget on a
conversation that will later be filtered out. `scope` accepts an alias, a
resolved scope ID, or `all`; every form remains intersected with the caller's
authorized view.

Context packing protects separate shares for profile facts, experience lessons,
conversation evidence, and ordinary claims before redistributing unused space.
This prevents a large early lane from starving later task evidence while still
allowing a single populated lane to use the full remaining token budget.
The admission decision and generic packing algorithm come from Smartware Layer
4; Pod defines only these product-specific lanes, weights, and telemetry
envelope.

Meaning-based claim retrieval is an opt-in Smartware channel configured through
the `pod.retrieval` settings namespace. It is off by default and has two staged
modes:

- `shadow` evaluates hybrid candidates and records comparison telemetry without
  changing delivered context;
- `fallback` may add Smartware-selected hybrid candidates only when canonical
  lexical retrieval is weak.

Pod is a thin consumer here. It selects the configured OpenAI-compatible
embedding route and exposes product telemetry; Smartware applies authorization,
lifecycle, temporal, and sensitive-content boundaries, refreshes the derived
index explicitly, and owns semantic ranking and reciprocal-rank fusion.
Sensitive claims are always excluded from external embedding.

Because shadow mode cannot change delivered evidence, its background health is
kept out of Ask Pod's user-facing search steps. A fallback-mode failure remains
visible because it can affect the evidence delivered for that query.

The rebuildable record index lives at `indices/semantic.db`. It contains no
canonical memory and can be deleted and rebuilt. Provider, runtime, or index
failure selects canonical retrieval and never breaks a context read.

Pod objects and Smartware memory are joined through durable observation
lineage. Creating or revising an artifact records its versioned observation;
the replacement is admitted before the prior observation is retired. Deleting
an artifact retires its semantic evidence by default. The Map and retrieval
surfaces therefore resolve `artifact → observation → claim → entity` without
promoting title similarity into canonical truth.

The Memory settings control opts the owner into `shadow`, not `fallback`.
Changing delivered results requires a held-out comparative activation gate with
zero forbidden, obsolete, or missing results and no accepted quality
regression.

## Conversation memory

Slack and Email use a structured `conversation_message` observation while
remaining canonical L0 evidence. Thread identity, message identity,
authorship, source context, and timestamp are preserved. Slack polling fetches
a bounded set of complete thread replies rather than treating each message as
an isolated document; the webhook path refreshes the same projection after
each accepted event.

Email has one product-facing connection with provider adapters underneath it.
Google uses Gmail's thread API. iCloud uses read-only IMAP while the user keeps
working in Apple Mail; its app-specific password lives in macOS Keychain and
is never written to Pod configuration. Inbox and Sent messages are normalized
through the same ingestion pipeline. Sent messages are explicitly marked as
owner-authored, threads with an owner reply are prioritized, and the latest
owner reply becomes the deterministic resolution when no stronger explicit
resolution phrase exists. Google and iCloud keep separate provider-owned data
spaces, so an agent sees email only after the owner grants that space.

The disposable per-scope projection under
`derived/retrieval/conversations/` groups messages into threads and keeps:

- the first source question;
- a bounded exact-source gist;
- the latest message with an explicit resolution signal;
- code, error, path, and URL references;
- participants and authorship;
- substantive, endorsed, or lexically distinctive same-author bursts;
- every contributing canonical observation ID.

These are retrieval artifacts, not promoted claims. The deterministic
projection does not invent a summary or resolution. Private, sensitive,
tombstoned, and redacted messages do not contribute. A forget operation
refreshes the projection immediately, and Dream rebuilds it for every data
space alongside experience lessons.

Older plain-text Slack observations remain searchable as standalone legacy
conversations. They cannot recover thread or human-author metadata that was
never captured.

## Demonstrated expertise

`POST /pod/expertise` and the MCP tool `pod_who_knows` rank people or agents
only from authorized evidence of work:

- authoring a cited conversation resolution;
- writing a substantive or socially endorsed conversation burst;
- contributing to a lesson that a later successful run validated.

Self-declared profile text and mere thread participation are not enough.
Results explain the evidence counts and include normalized evidence rows that
point back to the canonical observations. Removing the source evidence removes
the expertise signal.

## Agent-facing tools

The MCP server exposes three LLM-free retrieval building blocks:

- `pod_search_evidence` — normalized evidence from the caller's context view;
- `pod_search_conversations` — question, resolution, participants, and source
  citations;
- `pod_who_knows` — demonstrated expertise with proof.

Clients decide which tools to call and how to synthesize an answer. The Coffee
UI runs the complete path: search progress, a concise answer, an optional
“Who knows” proof line, and expandable source chips for conversation and lesson
evidence.

`pod_search_evidence` returns compact rows by default: evidence ID, kind, text,
scope, confidence, and canonical observation IDs. `detail: "full"` opts into
the complete provenance, ranking, temporal, and resolver envelope. Its
`source_types` filter is pushed into `/pod/context` before retrieval and token
packing. Retrieval telemetry records the selected strategy, searched scopes,
stage execution and candidate counts, estimated delivered tokens, and whether
an answer model was invoked.
