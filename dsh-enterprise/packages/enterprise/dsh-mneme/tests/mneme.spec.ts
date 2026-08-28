import { describe, it, expect, vi } from 'vitest'
import { MnemeStore, apply } from '../src/plugin.js'

function mockCtx() {
  const services: Record<string, unknown> = {}
  const handlers: Record<string, unknown[]> = {}
  const ctx: unknown = {
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
        if (i < list.length) return list[i]!(cur, dispatch)
        return next(cur)
      }
      return dispatch(ev)
    },
  }
  return { ctx, services, handlers }
}

describe('dsh-mneme', () => {
  it('recall/store via MnemeStore', async () => {
    const s = new MnemeStore()
    await s.store('k1', 'hello world')
    await s.store('k2', 'DORA compliance note')
    expect((await s.recall('hello')).map((e) => e.k)).toEqual(['k1'])
    expect((await s.recall('DORA')).map((e) => e.k)).toEqual(['k2'])
    expect(await s.get('k1')).toBe('hello world')
  })

  it('ctx.effect dsh-mneme recall/store', async () => {
    const { ctx, services } = mockCtx()
    apply(ctx)
    const mneme = services['dsh-mneme'] as MnemeStore
    await mneme.store('a', 'alpha')
    expect((await mneme.recall('alpha')).length).toBe(1)
  })

  it('session/event auto-store via ctx.on', async () => {
    const { ctx, handlers } = mockCtx()
    apply(ctx)
    const list = (handlers['session/event'] ?? []) as ((ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>)[]
    expect(list.length).toBe(1)
    const handler = list[0]!
    await handler({ type: 'session/event', key: 'evt1', value: 'payload1' }, async (e) => e)
    await handler({ type: 'chain/signal', payload: { title: 's1' } }, async (e) => e)
    // verify via waterfall that store was populated
    const mneme = (ctx as unknown as { get: (k: string) => MnemeStore }).get('dsh-mneme') as MnemeStore
    // at least evt1 should be recallable
    const r = await mneme.recall('payload1')
    expect(r.map((e) => e.k)).toContain('evt1')
  })
})
