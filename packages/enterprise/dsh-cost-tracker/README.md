# @deepseek-ai/dsh-enterprise-cost-tracker

Per-org and per-model token spend tracking backed by PostgreSQL.

## Status

Production. Logs token usage per model, org, and session to a `cost_events` table for billing and anomaly detection.

## What it does

Intercepts LLM call events from the agent loop, aggregates token counts (prompt + completion), and writes a row per call to PostgreSQL. A materialized view provides per-org monthly rollups.

## Configuration

```yaml
plugins:
  - id: dsh-cost-tracker
    name: '@deepseek-ai/dsh-enterprise-cost-tracker'
    config:
      connectionString: '${DATABASE_URL}'
      schema: 'dsh_cost'
```

Requires PostgreSQL 15+. Schema migrations run automatically on first boot.

## ponytail

In-memory aggregation only. Production use requires PostgreSQL with a connection pooler (e.g. PgBouncer) in front of the billing DB.
