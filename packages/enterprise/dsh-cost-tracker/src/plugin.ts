/**
 * dsh-cost-tracker Cordis plugin — per-org/model token spend → PG.
 * Mirrors gateway metering.ts costUsd/costCents and Postgres run_events insert.
 * @module @deepseek-ai/dsh-enterprise-cost-tracker/plugin
 */

export const name = 'dsh-enterprise:dsh-cost-tracker'
export const inject = [] as const

export type TokenUsage = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  inputTokens?: number
  outputTokens?: number
}

export type SpendRow = {
  orgId: string
  model: string
  tokens: number
  costUsd: number
  costCents: number
  createdAt: string
}

export function costUsd(tokens: TokenUsage | number): number {
  const total = typeof tokens === 'number' ? tokens : ((tokens.totalTokens ??
    ((tokens.promptTokens ?? 0) + (tokens.completionTokens ?? 0))) || ((tokens.inputTokens ?? 0) + (tokens.outputTokens ?? 0)))
  return 0.001 * (total ?? 0)
}

export function costCents(tokens: TokenUsage | number): number {
  return Math.round(costUsd(tokens as any) * 100)
}

export type PgClient = {
  insert: (row: SpendRow) => Promise<void> | void
}

export class CostTracker {
  rows: SpendRow[] = []
  constructor(private pg?: PgClient) {}
  async record(orgId: string, model: string, tokens: TokenUsage | number): Promise<SpendRow> {
    const total = typeof tokens === 'number' ? tokens : (((tokens.totalTokens ??
      ((tokens.promptTokens ?? 0) + (tokens.completionTokens ?? 0))) || ((tokens.inputTokens ?? 0) + (tokens.outputTokens ?? 0))) || 0)
    const usd = costUsd(total)
    const cents = Math.round(usd * 100)
    const row: SpendRow = {
      orgId,
      model,
      tokens: total,
      costUsd: usd,
      costCents: cents,
      createdAt: new Date().toISOString(),
    }
    this.rows.push(row)
    if (this.pg?.insert) await this.pg.insert(row) // ponytail: pg insert when watchtower PG migration 002 lands
    return row
  }
}

export function apply(ctx: any, opts?: { pg?: PgClient }): void {
  const pg = opts?.pg ?? ctx.pg ?? ctx.db
  const tracker = new CostTracker(pg as PgClient | undefined)
  const svc = {
    record: tracker.record.bind(tracker),
    rows: tracker.rows,
    store: tracker,
  }
  ctx.effect('cost-tracker', () => svc)
  ctx.effect('costTracker', () => svc)
  // also expose dash form
  ctx.effect('cost_tracker', () => svc)

  ctx.on('gateway/request', async (ev: any, next: any) => {
    const result = await next(ev)
    // after metering.ts costUsd — record spend per org
    const orgId: string = ev?.orgId ?? ev?.auth?.orgId ?? result?.orgId ?? 'anonymous'
    const model: string = ev?.model ?? ev?.requestedModel ?? result?.model ?? 'unknown'
    let tokens: number | TokenUsage = 0
    if (typeof ev?.tokens === 'number') tokens = ev.tokens
    else if (ev?.usage) tokens = ev.usage as TokenUsage
    else if (ev?.totalTokens) tokens = ev.totalTokens as number
    else if (typeof ev?.promptTokens === 'number') tokens = ev.promptTokens + (ev.completionTokens ?? 0)
    else if (result?.usage) tokens = result.usage as TokenUsage
    else tokens = 0
    // only record if we have tokens >0; still allow explicit 0 to be recorded via direct record()
    if (tokens !== 0 && (typeof tokens === 'number' ? tokens > 0 : (tokens as TokenUsage).totalTokens !== 0)) {
      await tracker.record(orgId, model, tokens as any).catch(() => {})
    }
    return result
  })
}
