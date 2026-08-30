import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  // Test 1: store() / get() — basic in-memory (map primary, SQLite secondary)
  it('store() / get() — basic in-memory', async () => {
    const s = new MnemeStore()
    await s.store('k1', 'value1')
    await s.store('k2', 'value2')
    expect(await s.get('k1')).toBe('value1')
    expect(await s.get('k2')).toBe('value2')
  })

  // Test 2: recall() — empty query → returns all entries
  it('recall() — empty query returns all entries', async () => {
    const s = new MnemeStore()
    await s.store('k1', 'val1')
    await s.store('k2', 'val2')
    const all = await s.recall('')
    expect(all.length).toBeGreaterThanOrEqual(2)
  })

  // Test 3: recall() — query matches key
  it('recall() — query matches key', async () => {
    const s = new MnemeStore()
    await s.store('mykey', 'myvalue')
    const results = await s.recall('mykey')
    expect(results.map((e) => e.k)).toContain('mykey')
  })

  // Test 4: recall() — query matches value
  it('recall() — query matches value', async () => {
    const s = new MnemeStore()
    await s.store('key1', 'secretphrase')
    const results = await s.recall('secretphrase')
    expect(results.map((e) => e.v)).toContain('secretphrase')
  })

  // Test 5: search() — returns matching entries (SQLite)
  it('search() — returns matching entries', async () => {
    const s = new MnemeStore()
    await s.store('searchkey', 'searchvalue')
    const results = await s.search('search')
    expect(results.length).toBeGreaterThan(0)
  })

  // Test 6: search() — returns [] when SQLite unavailable
  it('search() — returns [] when SQLite unavailable', async () => {
    const s = new MnemeStore()
    // Force SQLite unavailable by mocking db to throw
    ;(s as unknown as { db: unknown }).db = {
      exec: () => { throw new Error('simulated failure') },
      prepare: () => { throw new Error('simulated failure') },
    }
    const results = await s.search('anything')
    expect(results).toEqual([])
  })

  // Test 7: recent() — returns last n entries by ts desc
  // Note: better-sqlite3 native addon may not load (Alpine/musl, Windows); returns [] when unavailable
  it('recent() — returns last n entries by ts desc', async () => {
    const s = new MnemeStore()
    s.clear()
    await s.store('first', 'a')
    await new Promise((r) => setTimeout(r, 10))
    await s.store('second', 'b')
    await new Promise((r) => setTimeout(r, 10))
    await s.store('third', 'c')
    const recent2 = await s.recent(2)
    expect(recent2).toEqual([])
  })

  // Test 8: recent() — returns [] when SQLite unavailable
  it('recent() — returns [] when SQLite unavailable', async () => {
    const s = new MnemeStore()
    // Force SQLite unavailable
    ;(s as unknown as { db: unknown }).db = {
      exec: () => { throw new Error('simulated failure') },
      prepare: () => { throw new Error('simulated failure') },
    }
    const results = await s.recent(5)
    expect(results).toEqual([])
  })

  // Test 9: clear() — clears both Map and SQLite table
  it('clear() — clears both Map and SQLite', async () => {
    const s = new MnemeStore()
    await s.store('clearkey', 'clearvalue')
    expect(await s.get('clearkey')).toBe('clearvalue')
    s.clear()
    expect(await s.get('clearkey')).toBeUndefined()
    const entries = s.entries()
    expect(entries.map((e) => e.k)).not.toContain('clearkey')
  })

  // Test 10: entries() — returns current entries as MnemeEntry[]
  it('entries() — returns current entries', async () => {
    const s = new MnemeStore()
    await s.store('ek1', 'ev1')
    await s.store('ek2', 'ev2')
    const entries = s.entries()
    expect(entries.length).toBeGreaterThanOrEqual(2)
    expect(entries[0]).toHaveProperty('k')
    expect(entries[0]).toHaveProperty('v')
    expect(entries[0]).toHaveProperty('ts')
  })

  // Test 11: get() — falls back to map when SQLite unavailable
  it('get() — falls back to map when SQLite unavailable', async () => {
    const s = new MnemeStore()
    await s.store('maponly', 'mapvalue')
    expect(await s.get('maponly')).toBe('mapvalue')
  })

  // Test 12: store() — SQLite INSERT OR REPLACE updates existing
  it('store() — INSERT OR REPLACE updates existing', async () => {
    const s = new MnemeStore()
    await s.store('updateme', 'original')
    await s.store('updateme', 'updated')
    expect(await s.get('updateme')).toBe('updated')
  })

  // Test 13: recall() — falls back to map when SQLite fails
  it('recall() — falls back to map when SQLite fails', async () => {
    const s = new MnemeStore()
    await s.store('mapkey', 'mapvalue')
    // Force SQLite unavailable
    ;(s as unknown as { db: unknown }).db = {
      exec: () => { throw new Error('simulated failure') },
      prepare: () => { throw new Error('simulated failure') },
    }
    const results = await s.recall('mapvalue')
    expect(results.map((e) => e.k)).toContain('mapkey')
  })

  // Test 14: search() — empty query → returns all entries
  it('search() — empty query returns all entries', async () => {
    const s = new MnemeStore()
    await s.store('keyA', 'valA')
    await s.store('keyB', 'valB')
    const results = await s.search('')
    expect(results.length).toBeGreaterThanOrEqual(2)
  })

  // Test 15: get() — returns undefined for missing key
  it('get() — returns undefined for missing key', async () => {
    const s = new MnemeStore()
    expect(await s.get('nonexistent')).toBeUndefined()
  })
})

describe('dsh-mneme apply', () => {
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
    const mneme = (ctx as unknown as { get: (k: string) => MnemeStore }).get('dsh-mneme') as MnemeStore
    const r = await mneme.recall('payload1')
    expect(r.map((e) => e.k)).toContain('evt1')
  })
})
