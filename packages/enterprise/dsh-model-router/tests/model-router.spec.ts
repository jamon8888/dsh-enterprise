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

describe('dsh-model-router', () => {
  it('selects local vs gateway', async () => {
    const { ctx, services } = mockCtx()
    apply(ctx)
    const router = services['model-router'] as { select: (req: any) => Promise<string> }
    expect(await router.select({ preferLocal: true })).toBe('local-llm')
    expect(await router.select({ preferLocal: false })).toBe('gateway')
    expect(await router.select({})).toBe('gateway')
  })

  it('gateway/request → model-router.select → local-llm or gateway', async () => {
    const { ctx } = mockCtx()
    // seed local-llm so router can delegate generate when local
    ctx.effect = vi.fn((n: string, f: () => unknown) => {
      const v = f()
      ;(ctx as any)._services ??= {}
      ;(ctx as any)._services[n] = v
      return () => {}
    })
    // Re-mock with services shared
    const services: Record<string, unknown> = {
      'local-llm': { generate: async (p: string) => `Local response to ${p}`, models: ['llama3.1:70b'] },
    }
    const handlers: Record<string, unknown[]> = {}
    const ctx2: any = {
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
    apply(ctx2)
    const localRes: any = await ctx2.waterfall('gateway/request', { prompt: 'hello', preferLocal: true }, async (ev: any) => ev)
    expect(localRes.route).toBe('local-llm')
    expect(localRes.handledBy).toBe('local-llm')
    expect(localRes.response).toBe('Local response to hello')

    const gwRes: any = await ctx2.waterfall('gateway/request', { prompt: 'hello', preferLocal: false }, async (ev: any) => ev)
    expect(gwRes.route).toBe('gateway')
    expect(gwRes.handledBy).toBe('gateway')
    expect(gwRes.response).toBeUndefined()
  })
})
