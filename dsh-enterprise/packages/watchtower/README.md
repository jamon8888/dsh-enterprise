# @deepseek-ai/dsh-enterprise-watchtower

Hash-chained receipts + hourly outcome joining (GitHub PR/CI → `accepted`|`rejected`|`needs-human`).

## Receipt chain

- `logHash = sha256(canonicalJson(run.log))`
- `hash = sha256(canonicalJson({...without hash}))`
- `prevHash = prev.hash` (genesis `H("genesis"+orgId)`), verified by `verifyChain`.

Deterministic `canonicalJson` sorts keys at every level.

## Job

`runWatchtowerJob(ctx, db, github)` — for each run without `outcome`: `github.getPR(prNumber)` → `pr.merged`, `github.getChecks(commitSha)` → `ci.green` → `outcome = pr.merged&&ci.green ? 'accepted' : pr.closed ? 'rejected' : 'needs-human'`; `generateReceipt`; `db.insertReceipt(receipt)`. Aggregates `acceptance_rate, one_shot_rate, avg_cost` stub-computed (persisted to `run_events` when gateway lands).

`ponytail: in-memory store, Postgres run_events when gateway lands`

## Persistence

Postgres migration `002_enterprise_receipts.sql` lives at `test/packages/session/session-persistence-postgres/src/migrations/002_enterprise_receipts.sql` (standalone, not `dsh/`). `dsh-enterprise` reuses that persistence package via sibling import; watchtower itself is in-memory until `listReceipts`/`insertReceipt` is wired to Postgres.

If running without Postgres, receipts are held in-memory via `DbClient` passed to `runWatchtowerJob`.

## Plugin

```ts
import { watchtowerPlugin } from '@deepseek-ai/dsh-enterprise-watchtower'
ctx.use(watchtowerPlugin)
// injects ['sessions','audit','scheduler?']; scheduler.every('1h', job)
```

## Verify

```bash
npx tsc --noEmit --skipLibCheck --project packages/watchtower/tsconfig.json
npx vitest run --project watchtower  # or: pnpm --filter @deepseek-ai/dsh-enterprise-watchtower test
```
