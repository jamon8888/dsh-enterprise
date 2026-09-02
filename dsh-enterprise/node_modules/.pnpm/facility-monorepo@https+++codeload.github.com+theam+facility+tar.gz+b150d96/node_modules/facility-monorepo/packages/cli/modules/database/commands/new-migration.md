---
description: Scaffold a new migration with safety defaults — never edit an existing one
---

Create a new database migration following STANDARD.md's Database section.

1. Locate the migrations directory (`migrations/`, `supabase/migrations/`,
   `db/migrations/`, `prisma/migrations/` — whichever this repo uses) and
   follow its existing naming convention (timestamp prefix, snake_case
   description).
2. Create a NEW file. Never modify or delete an existing migration — they are
   append-only; the `migrations-immutable` guard and the file hooks enforce
   it.
3. Safety defaults in the scaffold, adapted to this repo's stack:
   - New tables start closed: enable row/document-level access control where
     supported, deny by default, grant only the minimum operations.
   - Authorization routes through the repo's shared helper layer — no inline
     token/claim parsing in policies.
   - Destructive operations (drop, irreversible data rewrites) get a written
     justification comment and, where the stack supports it, a down path.
4. If the feature needs realistic data to test, update the seeds in the same
   change.
5. Verify: run the repo's migration apply/reset command if one exists, then
   `node guards/run.mjs --only=migrations-immutable`.
