### AI queryability (facility module)

Every new durable feature is queryable and actionable by AI by default. Data
trapped behind a human-only UI is invisible to your product's search, chat
agent, and MCP surface — and to every workflow your users will automate next
year. If exposing it is unsafe or not product-sensible, **document that
waiver in the PR**; an undocumented omission is a gap.

When a feature creates new user-relevant data, check each surface:

- **Search**: the data is indexed and discoverable under the same access
  control the UI enforces.
- **Agent tools**: the product's chat/search agent can read, explain, or act
  on the feature when users would expect it to.
- **MCP**: safe read/list/get tools exist, plus necessary action tools.
  Mutating tools are explicit about side effects, confirmation, idempotency,
  and permission boundaries.
- **Triggers/jobs**: if the feature changes data that affects search indexes,
  summaries, derived state, or notifications, a reliable trigger/job path
  exists with explicit retries and idempotency.
- **Empty results are permission-safe**: an AI surface must not imply hidden
  data exists when access control returns nothing.
