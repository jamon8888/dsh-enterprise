import { describe, it, expect, vi } from 'vitest'
import { KbRagService, apply, knowledgeSearch } from '../src/plugin.js'

function mockCtx(services: Record<string, unknown> = {}) {
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

describe('kb-rag', () => {
  it('search returns matching entries (pgvector substring stub)', async () => {
    const svc = new KbRagService([
      { id: '1', content: 'DORA incident reporting' },
      { id: '2', content: 'GDPR erasure rights' },
    ])
    expect((await svc.search('DORA')).map((e) => e.id)).toEqual(['1'])
    expect((await svc.search('gdpr')).map((e) => e.id)).toEqual(['2'])
    expect(await svc.search('AI Act')).toEqual([])
  })

  it('ctx.effect kb-rag search works via apply', async () => {
    const { ctx, services } = mockCtx()
    apply(ctx)
    const kb = services['kb-rag'] as KbRagService
    expect(await kb.search('DORA')).toHaveLength(1)
    expect((await kb.search('DORA'))[0]!.source).toBe('DORA Art.5')
  })

  it('knowledge_search routes to best backend: kb-rag -> dsh-library fallback', async () => {
    // kb-rag hit takes precedence
    const kbSvc = new KbRagService([{ id: 'kb', content: 'DORA knowledge' }])
    const libSvc = { search: vi.fn(async () => [{ id: 'lib', content: 'library fallback' }]) }
    const { ctx } = mockCtx({ 'kb-rag': kbSvc, 'dsh-library': libSvc })
    const r1 = await knowledgeSearch(ctx, 'DORA')
    expect(r1[0]!.id).toBe('kb')
    expect(libSvc.search).not.toHaveBeenCalled()

    // kb-rag miss falls back to library
    const kbEmpty = new KbRagService([])
    const libHit = { search: vi.fn(async () => [{ id: 'lib2', content: 'fallback doc' }]) }
    const { ctx: ctx2 } = mockCtx({ 'kb-rag': kbEmpty, 'dsh-library': libHit })
    const r2 = await knowledgeSearch(ctx2, 'GDPR')
    expect(libHit.search).toHaveBeenCalledWith('GDPR')
    expect(r2[0]!.id).toBe('lib2')
  })

  it('knowledge_search empty when no backends', async () => {
    const { ctx } = mockCtx({})
    expect(await knowledgeSearch(ctx, 'anything')).toEqual([])
  })
})
