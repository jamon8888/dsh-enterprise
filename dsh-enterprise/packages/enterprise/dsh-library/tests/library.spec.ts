import { describe, it, expect, vi } from 'vitest'
import { LibraryService, apply } from '../src/plugin.js'

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
  }
  return { ctx, services }
}

describe('dsh-library', () => {
  it('search reads .dsh/library stub (substring)', async () => {
    const svc = new LibraryService([
      { id: 'a', title: 'Charter', content: 'S→D→T→V chain', path: '.dsh/library/a.md' },
      { id: 'b', title: 'Guide', content: 'DORA template', path: '.dsh/library/b.md' },
    ])
    expect((await svc.search('charter')).map((e) => e.id)).toEqual(['a'])
    expect((await svc.search('DORA')).map((e) => e.id)).toEqual(['b'])
  })

  it('cite returns citation string with path and id', async () => {
    const svc = new LibraryService([
      { id: 'lib-001', title: 'Charter', content: 'x', path: '.dsh/library/charter.md', cite: 'Charter — .dsh/library/charter.md [lib-001]' },
    ])
    expect(svc.cite('lib-001')).toBe('Charter — .dsh/library/charter.md [lib-001]')
    // auto-generated cite when not provided
    const svc2 = new LibraryService([{ id: 'x', title: 'Doc', content: 'y', path: '.dsh/library/doc.md' }])
    expect(svc2.cite('x')).toBe('Doc — .dsh/library/doc.md [x]')
  })

  it('ctx.effect dsh-library search and cite via apply', async () => {
    const { ctx, services } = mockCtx()
    apply(ctx)
    const lib = services['dsh-library'] as LibraryService
    const r = await lib.search('session protocol')
    expect(r.length).toBeGreaterThan(0)
    expect(r[0]!.path).toBe('.dsh/library/charter.md')
    expect(lib.cite(r[0]!.id)).toContain('.dsh/library/')
  })

  it('throws on unknown cite', () => {
    const svc = new LibraryService([])
    expect(() => svc.cite('missing')).toThrow(/not found/)
  })
})
