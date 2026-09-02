# Benchmarking — Nightly terminal-bench / browsecomp

Phase 4 nightly bench: budget-capped runner → `BenchmarkEnvelope` → dual-write `run_events` → Grafana.

## Nightly matrix

| Suite | Schedule (UTC) | Runner stub | Budget cap |
|-------|---------------|-------------|------------|
| `terminal-bench` | `0 2 * * *` (02:00) | `runNightlyBenchmarkJob({suite:'terminal-bench', runner, estimatedTokens: 4000})` | `Gateway hardBudgetBlock` (`estimatedCents` from `packages/gateway/src/metering.ts`) + `MAX_COST_USD` env (default 5) |
| `browsecomp` | `0 3 * * *` (03:00) | `runNightlyBenchmarkJob({suite:'browsecomp', runner, estimatedTokens: 8000})` | same |

Workflow: `.github/workflows/nightly-bench.yml` — `on: schedule: cron: '0 2 * * *'` + `workflow_dispatch`. Each job sets `MAX_COST_USD` (default `5`) and calls `runNightlyBenchmarkJob`; on `blocked:true` it exits 0 with annotation (no bench spend beyond budget).

## BenchmarkEnvelope schema

```ts
type BenchmarkEnvelope = {
  runId: string            // bench-terminal-bench-<ms> | bench-browsecomp-<ms>
  suite: 'terminal-bench' | 'browsecomp'
  orgId: string            // from BudgetKey.orgId or runner override
  projectId: string        // BudgetKey.projectId
  cost: { usd: number; cents: number } // metering.costUsd / *100
  phiSnapshot: { phi: number; method: string; cesHash: string } // iit-core phi
  ews?: { variance: number; ac1: number } // iit/ews — attractor.rs ews_variance/ews_ac1
  createdAt: string        // ISO
  receiptHash?: string     // hash-chained receipt (watchtower) attached after emit
}
```

Persisted columns (Postgres `run_events`):

```sql
CREATE TABLE IF NOT EXISTS run_events (
  run_id TEXT PRIMARY KEY,
  suite TEXT NOT NULL,
  org_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  cost JSONB NOT NULL,         -- {usd, cents}
  phi_snapshot JSONB NOT NULL, -- {phi, method, cesHash}
  ews JSONB,                   -- {variance, ac1} nullable
  created_at TIMESTAMPTZ NOT NULL,
  receipt_hash TEXT
);
```

In-memory fallback: `packages/watchtower/src/job.ts:benchmarkRunEvents: Map<string,BenchmarkEnvelope>` (`ponytail: in-memory, Postgres when gateway lands`).

## Dual-write diagram

```
          nightly cron (02:00 terminal-bench, 03:00 browsecomp)
                         │
               runNightlyBenchmarkJob(suite, runner)
                         │
           ┌─────────────┼─────────────────┐
           │             │                 │
     estimatedCents   hardBudgetBlock   MAX_COST_USD env
     (metering.ts)    (budgets.ts)      (5 default)
           │             │                 │
           └─────────────┼─────────────────┘
                         │  blocked? → {blocked:true} (no spend)
                         │  pass ↓
                    runner(suite) → {phi, variance, ac1, costUsd}
                         │
                    BenchmarkEnvelope
                         │
              emitBenchmarkEnvelope(envelope, db)
                         │
            ┌────────────┴────────────┐
            │                         │
     Postgres run_events      benchmarkRunEvents Map
     (db.insertRunEvent)      (in-memory ponytail)
            │                         │
            └────────────┬────────────┘
                         │
                  Grafana Postgres datasource
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   phi trajectory   cost per org/proj  ews variance/ac1
   (phiSnapshot.phi) (cost.usd)        (iit/ews)
```

Grafana: `grafana/dashboards/enterprise.json` (3 panels, datasource `Postgres` `run_events`); alerts in `grafana/alerts.yaml` (`cost>budget` via `spendCounters`, `phi<minPhi` via `iit-config.yaml`, `ews>threshold` variance/ac1).

## Verification

```bash
pnpm --filter @deepseek-ai/dsh-enterprise-watchtower exec vitest run  # 16+ tests incl. watchtower.bench.spec.ts
cargo test --manifest-path packages/iit-core/Cargo.toml               # 13 tests
```
