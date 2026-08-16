# Pod Memory Language

Pod uses plain brain language in the product while preserving Smartware's
canonical protocol vocabulary. These terms are product conventions; they do
not change Smartware wire shapes, lifecycle rules, or storage semantics.

## Memory model

Memory is Pod's complete durable system. Its visible contents have four layers:

| Layer | Meaning | Examples |
|---|---|---|
| Knowledge | What Pod currently understands | People, organizations, projects, topics, decisions, claims, and relationships |
| Activity | Synthesized things that happened | Events, meetings, conversations, and other episodes |
| Evidence | Original material supporting that understanding | Emails, calendar entries, files, messages, transcripts, and notes |
| Structure | Containers used to organize evidence | Collections and data spaces |

The following nouns are canonical in Pod product language:

| Term | Meaning |
|---|---|
| Connection | An external service such as Gmail, Google Calendar, Drive, or Slack |
| Collection | A structural grouping of source records |
| Source record | One original captured artifact, such as an email, event, file, message, transcript, or note |
| Evidence | The role source records play when they support knowledge |
| Observation | Smartware's immutable capture of information and provenance |
| Entity | A stable thing recognized across records; normally shown by its human type, such as Person or Project |
| Claim | One time-aware, sourced assertion with confidence and epistemic state |
| Relationship | A meaningful association between knowledge objects |
| Episode | A synthesized, bounded interaction such as a meeting or conversation; not a synonym for every source record |
| Summary | Pod's compiled current understanding of an entity or subject |

Use **Source records** for the map category that contains raw artifacts. Use
**Sources** contextually for provenance, for example “View sources” or “Three
sources support this claim.” Do not use Sources as a synonym for Connections.

## Smartware verbs

Smartware verbs remain the primary user-facing actions. Use title case in the
product and uppercase when referring to the protocol operation.

| Product action | Protocol verb | Plain-language explanation |
|---|---|---|
| Observe | OBSERVE | Capture new information |
| Recall | RECALL | Find relevant memory |
| Reflect | REFLECT | Turn evidence into organized knowledge |
| Revise | REVISE | Correct or update what Pod understands |
| Forget | FORGET | Remove something from active memory |
| Dream | DREAM | Check relationships, conflicts, duplicates, and stale knowledge |

Do not replace these actions with Capture, Search, Update memory, Correct, or
Memory maintenance when the action invokes the corresponding Smartware verb.
Those plain phrases may be used only as supporting explanations.

## Lifecycle

```text
Connection
  -> Source record
  -> OBSERVE creates an Observation
  -> REFLECT extracts Entities, Claims, Relationships, Episodes, and Summaries
  -> RECALL assembles relevant context
```

REVISE changes Pod's current understanding without rewriting original evidence.
FORGET removes information from active memory according to Smartware lifecycle
rules. DREAM inspects and rebuilds derived state without promoting generated
material into user-authored truth.

## Model-assisted reflection

Connections and source-record ingestion work without a language model. Fixed
local rules may still extract deterministic claims. Model-assisted REFLECT is
needed for useful semantic extraction from free-form material such as email,
including people, organizations, projects, events, decisions, and nuanced
claims.

When no model is connected, the product must say so directly. An empty
Knowledge layer must not imply that source records failed to sync.
