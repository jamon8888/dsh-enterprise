# @deepseek-ai/dsh-enterprise-gateway

Reimplementation of `facility/services/gateway` as a Cordis plugin — **not** a package import.

`facility/services/gateway` is not a publishable package (`services/*` + `runner` are services, not `packages/*`). Until `theam/facility` publishes `@facility/gateway-core`, this package reimplements the gateway pattern as a new service, tracking upstream `facility/services/gateway/src/budgets.ts@b150d96` (9941 B) as reference.

Divergence from upstream:
- **DB → in-memory**: `budgetDefCache` (10k LRU, 30s TTL) + `spendCounters: Map<string, number>` keyed by `budgetId:windowStart`. No Postgres; `session-persistence-postgres` migration `002_enterprise_budgets.sql` will add real `spend_counters` table when watchtower lands.
- **Periods**: upstream `daily|weekly|monthly` → here `hour|day|month` (enterprise Billing period). `windowStart()` computes UTC window.
- **Envelope**: dual-write stub `console.log + memory://envelope/<ts>` for P0; R2 WORM is Phase 2.5.
- **Plugin seam**: decorates `ctx.llm.generate` via `ctx.effect('gateway', ...)` — never edits `llm/` source (P0/P1 zero-upstream-mutation).

Ponytail: `in-memory spendCounters, Postgres when watchtower lands`. R2 WORM is Phase 2.5.
