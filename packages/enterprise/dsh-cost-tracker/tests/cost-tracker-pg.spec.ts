import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CostTracker, type SpendRow } from '../src/plugin.js'

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
  return { ctx, services }
}

describe('cost-tracker pg insert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pg.insert called with SpendRow shape', async () => {
    const insert = vi.fn(async () => {})
    const pg = { insert }
    const tracker = new CostTracker(pg as any)
    const row = await tracker.record('org-test', 'deepseek-chat', 1000)
    expect(insert).toHaveBeenCalledTimes(1)
    const calledWith = insert.mock.calls[0]![0] as SpendRow
    expect(calledWith.orgId).toBe('org-test')
    expect(calledWith.model).toBe('deepseek-chat')
    expect(calledWith.tokens).toBe(1000)
    expect(calledWith.costUsd).toBe(1)
    expect(calledWith.costCents).toBe(100)
    expect(calledWith.createdAt).toBe(row.createdAt)
    expect(typeof calledWith.createdAt).toBe('string')
  })

  it('gateway/request hook: pg.insert NOT called when tokens = 0', async () => {
    const insert = vi.fn(async () => {})
    const pg = { insert }
    const { ctx } = mockCtx(pg)
    const { apply } = await import('../src/plugin.js')
    apply(ctx, { pg })
    await ctx.waterfall(
      'gateway/request',
      { orgId: 'org-1', model: 'm', tokens: 0 },
      async (e: any) => e,
    )
    expect(insert).not.toHaveBeenCalled()
  })

  it('gateway/request hook: pg.insert called for positive tokens', async () => {
    const insert = vi.fn(async () => {})
    const pg = { insert }
    const { ctx } = mockCtx(pg)
    const { apply } = await import('../src/plugin.js')
    apply(ctx, { pg })
    await ctx.waterfall(
      'gateway/request',
      { orgId: 'org-1', model: 'm', tokens: 100 },
      async (e: any) => e,
    )
    expect(insert).toHaveBeenCalledTimes(1)
    const calledWith = insert.mock.calls[0]![0] as SpendRow
    expect(calledWith.tokens).toBe(100)
    expect(calledWith.costCents).toBe(10)
  })

  it('pg.insert called for various token shapes', async () => {
    const insert = vi.fn(async () => {})
    const pg = { insert }
    const tracker = new CostTracker(pg as any)
    await tracker.record('o', 'm', { totalTokens: 500 } as any)
    expect(insert.mock.calls[0]![0].tokens).toBe(500)
    await tracker.record('o', 'm', { promptTokens: 100, completionTokens: 200 } as any)
    expect(insert.mock.calls[1]![0].tokens).toBe(300)
    await tracker.record('o', 'm', { inputTokens: 50, outputTokens: 150 } as any)
    expect(insert.mock.calls[2]![0].tokens).toBe(200)
  })

  it('multiple records each call pg.insert once', async () => {
    const insert = vi.fn(async () => {})
    const pg = { insert }
    const tracker = new CostTracker(pg as any)
    await tracker.record('o1', 'm', 100)
    await tracker.record('o2', 'm', 200)
    await tracker.record('o3', 'm', 300)
    expect(insert).toHaveBeenCalledTimes(3)
    expect(insert.mock.calls[0]![0].tokens).toBe(100)
    expect(insert.mock.calls[1]![0].tokens).toBe(200)
    expect(insert.mock.calls[2]![0].tokens).toBe(300)
  })
})
