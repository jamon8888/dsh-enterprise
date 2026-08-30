import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CostTracker, apply, costUsd, costCents, type TokenUsage } from '../src/plugin.js'

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('costUsd / costCents', () => {
    it('plain number → $0.001 per token', () => {
      expect(costUsd(1000)).toBe(1)
      expect(costUsd(0)).toBe(0)
      expect(costUsd(1)).toBe(0.001)
      expect(costCents(1000)).toBe(100)
      expect(costCents(0)).toBe(0)
    })

    it('totalTokens shape', () => {
      expect(costUsd({ totalTokens: 1000 })).toBe(1)
      expect(costUsd({ totalTokens: 0 })).toBe(0)
      expect(costCents({ totalTokens: 500 })).toBe(50)
    })

    it('promptTokens + completionTokens shape', () => {
      expect(costUsd({ promptTokens: 500, completionTokens: 500 })).toBe(1)
      expect(costUsd({ promptTokens: 100, completionTokens: 0 })).toBe(0.1)
      expect(costCents({ promptTokens: 250, completionTokens: 250 })).toBe(50)
    })

    it('inputTokens + outputTokens shape', () => {
      expect(costUsd({ inputTokens: 300, outputTokens: 700 })).toBe(1)
      expect(costUsd({ inputTokens: 0, outputTokens: 0 })).toBe(0)
      expect(costCents({ inputTokens: 150, outputTokens: 350 })).toBe(50)
    })
  })

  describe('CostTracker constructor', () => {
    it('without pg client', () => {
      const tracker = new CostTracker()
      expect(tracker.rows).toEqual([])
    })

    it('with pg client', () => {
      const pg = { insert: vi.fn(async () => {}) }
      const tracker = new CostTracker(pg as any)
      expect(tracker.rows).toEqual([])
    })
  })

  describe('record()', () => {
    it('plain number creates row with correct cost', async () => {
      const tracker = new CostTracker()
      const row = await tracker.record('org-1', 'deepseek-chat', 1000)
      expect(row.orgId).toBe('org-1')
      expect(row.model).toBe('deepseek-chat')
      expect(row.tokens).toBe(1000)
      expect(row.costUsd).toBe(1)
      expect(row.costCents).toBe(100)
      expect(row.createdAt).toBeDefined()
      expect(tracker.rows).toHaveLength(1)
    })

    it('totalTokens shape', async () => {
      const tracker = new CostTracker()
      const row = await tracker.record('org-1', 'm', { totalTokens: 2000 } as TokenUsage)
      expect(row.tokens).toBe(2000)
      expect(row.costUsd).toBe(2)
      expect(row.costCents).toBe(200)
    })

    it('promptTokens + completionTokens shape', async () => {
      const tracker = new CostTracker()
      const row = await tracker.record('org-1', 'm', { promptTokens: 600, completionTokens: 400 } as TokenUsage)
      expect(row.tokens).toBe(1000)
      expect(row.costUsd).toBe(1)
    })

    it('inputTokens + outputTokens shape', async () => {
      const tracker = new CostTracker()
      const row = await tracker.record('org-1', 'm', { inputTokens: 800, outputTokens: 200 } as TokenUsage)
      expect(row.tokens).toBe(1000)
      expect(row.costUsd).toBe(1)
    })

    it('tokens = 0 still creates a row via direct record()', async () => {
      const pg = { insert: vi.fn(async () => {}) }
      const tracker = new CostTracker(pg as any)
      const row = await tracker.record('org-1', 'm', 0)
      expect(row.tokens).toBe(0)
      expect(row.costUsd).toBe(0)
      expect(row.costCents).toBe(0)
      expect(tracker.rows).toHaveLength(1)
      expect(pg.insert).toHaveBeenCalledTimes(1)
    })
  })

  describe('gateway/request hook', () => {
    it('waterfall records spend per org', async () => {
      const pg = { insert: vi.fn(async () => {}) }
      const { ctx, services } = mockCtx(pg)
      apply(ctx)
      const svc = services['cost-tracker'] as { record: any; rows: any[] }
      await ctx.waterfall(
        'gateway/request',
        { orgId: 'org-42', model: 'deepseek-chat', tokens: 1000 },
        async (e: any) => e,
      )
      expect(pg.insert).toHaveBeenCalledTimes(1)
      const inserted = pg.insert.mock.calls[0]![0]
      expect(inserted.orgId).toBe('org-42')
      expect(inserted.tokens).toBe(1000)
      expect(inserted.costCents).toBe(100)
      expect(svc.rows).toHaveLength(1)
    })

    it('second org is isolated', async () => {
      const pg = { insert: vi.fn(async () => {}) }
      const { ctx, services } = mockCtx(pg)
      apply(ctx)
      await ctx.waterfall(
        'gateway/request',
        { orgId: 'org-42', model: 'deepseek-chat', tokens: 1000 },
        async (e: any) => e,
      )
      await ctx.waterfall(
        'gateway/request',
        { orgId: 'org-99', model: 'deepseek-chat', tokens: 1000 },
        async (e: any) => e,
      )
      expect(pg.insert).toHaveBeenCalledTimes(2)
      expect(pg.insert.mock.calls[0]![0].orgId).toBe('org-42')
      expect(pg.insert.mock.calls[1]![0].orgId).toBe('org-99')
    })

    it('tokens = 0 → skips pg.insert in gateway/request hook', async () => {
      const pg = { insert: vi.fn(async () => {}) }
      const { ctx } = mockCtx(pg)
      apply(ctx)
      await ctx.waterfall(
        'gateway/request',
        { orgId: 'org-1', model: 'm', tokens: 0 },
        async (e: any) => e,
      )
      expect(pg.insert).not.toHaveBeenCalled()
    })

    it('tokens = 0 via totalTokens = 0 → skips pg.insert', async () => {
      const pg = { insert: vi.fn(async () => {}) }
      const { ctx } = mockCtx(pg)
      apply(ctx)
      await ctx.waterfall(
        'gateway/request',
        { orgId: 'org-1', model: 'm', usage: { totalTokens: 0 } },
        async (e: any) => e,
      )
      expect(pg.insert).not.toHaveBeenCalled()
    })

    it('ev.promptTokens + ev.completionTokens path', async () => {
      const pg = { insert: vi.fn(async () => {}) }
      const { ctx } = mockCtx(pg)
      apply(ctx)
      await ctx.waterfall(
        'gateway/request',
        { orgId: 'org-1', model: 'm', promptTokens: 500, completionTokens: 500 },
        async (e: any) => e,
      )
      expect(pg.insert).toHaveBeenCalledTimes(1)
      const inserted = pg.insert.mock.calls[0]![0]
      expect(inserted.tokens).toBe(1000)
    })

    it('result.usage path', async () => {
      const pg = { insert: vi.fn(async () => {}) }
      const { ctx } = mockCtx(pg)
      apply(ctx)
      await ctx.waterfall(
        'gateway/request',
        { orgId: 'org-1', model: 'm' },
        async (e: any) => ({ ...e, usage: { totalTokens: 750 } }),
      )
      expect(pg.insert).toHaveBeenCalledTimes(1)
      const inserted = pg.insert.mock.calls[0]![0]
      expect(inserted.tokens).toBe(750)
      expect(inserted.costCents).toBe(75)
    })

    it('no token fields → falls to else tokens=0, no pg call', async () => {
      const pg = { insert: vi.fn(async () => {}) }
      const { ctx } = mockCtx(pg)
      apply(ctx)
      await ctx.waterfall(
        'gateway/request',
        { orgId: 'org-1', model: 'm' },
        async (e: any) => e,
      )
      expect(pg.insert).not.toHaveBeenCalled()
    })

    it('ev.usage.totalTokens=0 but ev.tokens>0 → else-if path records ev.tokens', async () => {
      const pg = { insert: vi.fn(async () => {}) }
      const { ctx } = mockCtx(pg)
      apply(ctx)
      await ctx.waterfall(
        'gateway/request',
        { orgId: 'org-1', model: 'm', usage: { totalTokens: 0 }, tokens: 500 },
        async (e: any) => e,
      )
      expect(pg.insert).toHaveBeenCalledTimes(1)
      const inserted = pg.insert.mock.calls[0]![0]
      expect(inserted.tokens).toBe(500)
    })

    it('direct record via service', async () => {
      const { ctx, services } = mockCtx()
      apply(ctx)
      const svc = services['cost-tracker'] as { record: (org: string, model: string, tokens: number) => Promise<any> }
      const row = await svc.record('org-x', 'm1', 500)
      expect(row.costUsd).toBe(0.5)
    })
  })
})
