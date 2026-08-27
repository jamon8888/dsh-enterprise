### Database (facility module)

Migrations are the durable state of the database. They are **append-only**:
a change is a NEW migration, never an edit to one that may have been applied
anywhere. The `migrations-immutable` guard and the `.claude/hooks` rules
enforce this mechanically.

- New tables and collections start closed: enable row/document-level access
  control where the platform supports it, deny by default, grant only the
  minimum required operations.
- Authorization checks route through one shared helper layer — never inline
  token/claim parsing inside individual policies or queries.
- Privileged credentials (service role, admin connections) stay out of
  user-facing and agent-facing read paths. Any privileged action lives in a
  reviewed application service with explicit permission checks and tests.
- Update seed data whenever a feature needs realistic data to test locally.
  Seeds follow the domain: realistic names, states, relationships, and edge
  cases — not toy rows that only satisfy a test selector.
- Empty results must be permission-safe: do not imply hidden data exists when
  access control returns nothing.
