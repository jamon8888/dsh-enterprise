import { describe, it, expect, vi } from 'vitest'
import { CostTracker, apply, costUsd } from '../src/plugin.js'

function mockCtx(pg?: any) {
  const handlers: Record<string, any[]> = {}
  const services: Record<string, any> = {}
  const ctx: any = {
    pg,
    db: pg,
    effect: vi.fn((n: string, f: () => any) => {
      services[n] = f()
      return () => {}
    }),
    on: vi.fn((e: string, h: any) => {
      ;(handlers[e] ??= []).push(h)
      return () => {}
    }),
    get: vi.fn((k: string) => services[k]),
    waterfall: async (event: string, ev: any, next: any) => {
      const list = handlers[event] ?? []
      let i = -1
      const dispatch = async (cur: any): Promise<any> => {
        i++
        if (i < list.length) return list[i](cur, dispatch)
        return next(cur)
      }
      return dispatch(ev)
    },
  }
  return { ctx, services, handlers }
}

describe('dsh-cost-tracker', () => {
  it('costUsd 1k tokens → $1', () => {
    expect(costUsd(1000)).toBe(1)
    expect(costUsd({ totalTokens: 1000 })).toBe(1)
  })

  it('1k tokens → PG row per org', async () => {
    const pg = { insert: vi.fn(async () => {}) }
    const tracker = new CostTracker(pg as any)
    const row = await tracker.record('org-1', 'deepseek-chat', 1000)
    expect(row.orgId).toBe('org-1')
    expect(row.tokens).toBe(1000)
    expect(row.costUsd).toBe(1)
    expect(row.costCents).toBe(100)
    expect(pg.insert).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1', tokens: 1000 }))
    expect(tracker.rows.length).toBe(1)
  })

  it('gateway/request → PG row per org (1000 tokens)', async () => {
    const pg = { insert: vi.fn(async () => {}) }
    const { ctx, services } = mockCtx(pg)
    apply(ctx)
    const svc = services['cost-tracker'] as { record: any; rows: any[] }
    await ctx.waterfall('gateway/request', { orgId: 'org-42', model: 'deepseek-chat', tokens: 1000 }, async (e: any) => e)
    expect(pg.insert).toHaveBeenCalledTimes(1)
    const inserted = pg.insert.mock.calls[0]![0]
    expect(inserted.orgId).toBe('org-42')
    expect(inserted.tokens).toBe(1000)
    expect(inserted.costCents).toBe(100)
    expect(svc.rows.length).toBe(1)
    // second org isolated
    await ctx.waterfall('gateway/request', { orgId: 'org-99', model: 'deepseek-chat', tokens: 1000 }, async (e: any) => e)
    expect(pg.insert).toHaveBeenCalledTimes(2)
    expect(pg.insert.mock.calls[1]![0].orgId).toBe('org-99')
  })

  it('direct record via service', async () => {
    const { ctx, services } = mockCtx()
    apply(ctx)
    const svc = services['cost-tracker'] as { record: (org: string, model: string, tokens: number) => Promise<any> }
    const row = await svc.record('org-x', 'm1', 500)
    expect(row.costUsd).toBe(0.5)
  })
})
