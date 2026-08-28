import { describe, it, expect, vi } from 'vitest'
import { apply } from '../src/plugin.js'

function mockCtx(services: Record<string, unknown> = {}) {
  const handlers: Record<string, unknown[]> = {}
  const ctx: any = {
    effect: vi.fn((n: string, f: () => unknown) => {
      services[n] = f()
      return () => {}
    }),
    on: vi.fn((e: string, h: unknown) => {
      ;(handlers[e] ??= []).push(h as never)
      return () => {}
    }),
    get: vi.fn((k: string) => services[k]),
    waterfall: async (event: string, ev: unknown, next: (ev: unknown) => Promise<unknown>) => {
      const list = (handlers[event] ?? []) as ((ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>)[]
      let i = -1
      const dispatch = async (cur: unknown): Promise<unknown> => {
        i++
        if (i < list.length) return (list[i] as any)(cur, dispatch)
        return next(cur)
      }
      return dispatch(ev)
    },
  }
  return { ctx, services, handlers }
}

describe('dsh-local-llm', () => {
  it('returns local response', async () => {
    const { ctx, services } = mockCtx()
    apply(ctx)
    const svc = services['local-llm'] as { generate: (p: string) => Promise<string>; models: string[] }
    expect(svc.models).toEqual(['llama3.1:70b'])
    expect(await svc.generate('hello')).toBe('Local response to hello')
  })

  it('gateway/request intercept when sovereignty region EU-airgapped', async () => {
    const { ctx } = mockCtx()
    apply(ctx)
    const res: any = await ctx.waterfall('gateway/request', { prompt: 'hi', region: 'EU-airgapped' }, async (ev: any) => ev)
    expect(res.response).toBe('Local response to hi')
    expect(res.handledBy).toBe('local-llm')
    // non-airgapped passes through
    const res2: any = await ctx.waterfall('gateway/request', { prompt: 'hi', region: 'US' }, async (ev: any) => ev)
    expect(res2.response).toBeUndefined()
    expect(res2.prompt).toBe('hi')
  })

  it('handles sovereignty.region shape', async () => {
    const { ctx } = mockCtx()
    apply(ctx)
    const res: any = await ctx.waterfall('gateway/request', { prompt: 'x', sovereignty: { region: 'EU-airgapped' } }, async (ev: any) => ev)
    expect(res.handledBy).toBe('local-llm')
  })
})
