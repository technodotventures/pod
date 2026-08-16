# Pod Domain Context

## Capabilities

| Term | Meaning |
|---|---|
| Capability | Anything an agent can be authorized to use or have materialized into its runtime. The Capabilities Module presents Skills and Plugins without erasing their different lifecycles. |
| Skill | One stable, personal capability identity that can accumulate revisions and be used by multiple agents. A Skill is not a Doc even when its package is Markdown. |
| Skill package | The bounded set of files that implements a Skill, normally rooted at `SKILL.md`. |
| Plugin | One stable Agent Plugin package identity. A Plugin is an aggregate whose immutable revision may contain Skill components, MCP server components, and client-extension components. |
| Plugin component | One item discovered inside a Plugin revision. Invalid or unsupported components are isolated without changing valid siblings into standalone capabilities. |
| Credential binding | A reference from a Plugin deployment to a Pod Connection. Credentials are never Plugin package files and never participate in package identity. |
| Package digest | The SHA-256 identity of normalized package paths and contents. Origin, location, popularity, and other mutable metadata are not part of this identity. |
| Revision | One immutable snapshot of a Skill or Plugin package. Revisions move through draft, approved, superseded, or rejected review states. |
| Inbox | Draft revisions detected from agents or added from external sources that still require review. |
| Library | The canonical approved revisions retained by Pod. Approval does not itself grant an agent access or write files into an agent runtime. |
| Assignment | The association between a Skill and a connected agent. Assignments and their Smartware grants govern authorization; they are not proof that package files were deployed. |
| Deployment | Materialization of one approved revision into an agent's native Skill directory, followed by digest verification. |
| Partial deployment | A Plugin deployment where some components synchronize but another component is invalid, unsupported, or missing a credential binding. Partial is never presented as fully synchronized. |
| Compatibility | The per-agent result of mapping a Plugin revision's components through an agent Adapter. Compatibility is derived and may differ between agents. |
| Drift | A target agent package whose observed digest differs from the approved revision Pod intends to deploy. Pod must not silently overwrite drift. |
| Discover | Federated search across external capability registries. Discover is an input to the Inbox, not the canonical Library. |

Use **approved** for a revision accepted into the Library, **enabled** for active agent authorization, and **synchronized** only after a deployment is re-read and its digest matches. Do not use **installed** as a synonym for all three states.
