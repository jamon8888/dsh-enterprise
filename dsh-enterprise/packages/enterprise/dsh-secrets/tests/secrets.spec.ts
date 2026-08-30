import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SecretsService, InMemoryProvider, apply, type SecretsProvider } from '../src/plugin.js'
import { name, inject, SecretsService as SvcFromIndex, InMemoryProvider as InMemFromIndex } from '../src/index.js'

function mockCtx() {
  const handlers: Record<string, any[]> = {}
  const services: Record<string, any> = {}
  const ctx: any = {
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

describe('dsh-secrets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('index.ts re-exports', () => {
    it('re-exports name, inject, apply, SecretsService, InMemoryProvider', () => {
      expect(name).toBe('dsh-enterprise:dsh-secrets')
      expect(inject).toEqual([])
      expect(typeof apply).toBe('function')
      expect(typeof SvcFromIndex).toBe('function')
      expect(typeof InMemFromIndex).toBe('function')
    })

    it('SecretsService from index works', () => {
      const svc = new SvcFromIndex()
      svc.set('k', 'v')
      expect(svc.get('k')).toBe('v')
    })

    it('InMemoryProvider from index works', () => {
      const provider = new InMemFromIndex()
      provider.set('KEY', 'val')
      expect(provider.get('KEY')).toBe('val')
    })
  })

  describe('InMemoryProvider', () => {
    it('get/set/list basic operations', () => {
      const provider = new InMemoryProvider()
      provider.set('API_KEY', 'secret-123')
      expect(provider.get('API_KEY')).toBe('secret-123')
      expect(provider.list()).toEqual(['API_KEY'])
    })

    it('get returns undefined for unknown key', () => {
      const provider = new InMemoryProvider()
      expect(provider.get('UNKNOWN')).toBeUndefined()
    })

    it('delete removes key', () => {
      const provider = new InMemoryProvider()
      provider.set('KEY', 'value')
      expect(provider.delete('KEY')).toBe(true)
      expect(provider.get('KEY')).toBeUndefined()
      expect(provider.list()).toEqual([])
    })

    it('delete returns false for unknown key', () => {
      const provider = new InMemoryProvider()
      expect(provider.delete('NOTFOUND')).toBe(false)
    })

    it('clear removes all keys', () => {
      const provider = new InMemoryProvider()
      provider.set('KEY1', 'v1')
      provider.set('KEY2', 'v2')
      provider.clear()
      expect(provider.list()).toEqual([])
    })

    it('get falls back to process.env', () => {
      const provider = new InMemoryProvider()
      process.env.TEST_ENV_SECRET = 'env-value'
      try {
        expect(provider.get('TEST_ENV_SECRET')).toBe('env-value')
      } finally {
        delete process.env.TEST_ENV_SECRET
      }
    })
  })

  describe('SecretsService constructor', () => {
    it('default creates InMemoryProvider', () => {
      const svc = new SecretsService()
      svc.set('k', 'v')
      expect(svc.get('k')).toBe('v')
    })

    it('accepts custom providers', () => {
      const customProvider: SecretsProvider = {
        get: (k) => (k === 'custom' ? 'custom-value' : undefined),
        set: () => {},
        list: () => ['custom'],
      }
      const svc = new SecretsService([customProvider])
      expect(svc.get('custom')).toBe('custom-value')
    })
  })

  describe('SecretsService CRUD', () => {
    it('set and get', () => {
      const svc = new SecretsService()
      svc.set('KEY', 'value')
      expect(svc.get('KEY')).toBe('value')
    })

    it('get returns undefined for unknown key', () => {
      const svc = new SecretsService()
      expect(svc.get('NOTFOUND')).toBeUndefined()
    })

    it('delete returns true for existing key', () => {
      const svc = new SecretsService()
      svc.set('KEY', 'value')
      expect(svc.delete('KEY')).toBe(true)
      expect(svc.get('KEY')).toBeUndefined()
    })

    it('delete returns false for unknown key', () => {
      const svc = new SecretsService()
      expect(svc.delete('NOTFOUND')).toBe(false)
    })

    it('list returns all keys', () => {
      const svc = new SecretsService()
      svc.set('A', '1')
      svc.set('B', '2')
      const keys = svc.list()
      expect(keys).toEqual(['A', 'B'])
    })

    it('clear removes all secrets and cleans process.env via gateway/request injection', async () => {
      const { ctx, services } = mockCtx()
      apply(ctx)
      const svc = services['secrets'] as SecretsService
      svc.set('A', '1')
      svc.set('B', '2')
      let envDuringRequest: Record<string, string | undefined> = {}
      await ctx.waterfall('gateway/request', {}, async (ev: any) => {
        envDuringRequest = { A: process.env['A'], B: process.env['B'] }
        return ev
      })
      expect(envDuringRequest['A']).toBe('1')
      expect(envDuringRequest['B']).toBe('2')
      svc.clear()
      expect(svc.list()).toEqual([])
      expect(svc.get('A')).toBeUndefined()
      expect(process.env['A']).toBeUndefined()
      expect(process.env['B']).toBeUndefined()
    })
  })

  describe('SecretsService provider fallback', () => {
    it('empty providers array returns undefined/false/empty', () => {
      const svc = new SecretsService([])
      expect(svc.get('KEY')).toBeUndefined()
      expect(svc.delete('KEY')).toBe(false)
      expect(svc.list()).toEqual([])
    })

    it('tries providers in order', () => {
      const provider1: SecretsProvider = {
        get: () => undefined,
        set: () => {},
        list: () => [],
      }
      const provider2: SecretsProvider = {
        get: (k) => (k === 'KEY' ? 'from-provider2' : undefined),
        set: () => {},
        list: () => ['KEY'],
      }
      const svc = new SecretsService([provider1, provider2])
      expect(svc.get('KEY')).toBe('from-provider2')
    })

    it('returns first non-undefined value', () => {
      const provider1: SecretsProvider = {
        get: (k) => (k === 'KEY' ? 'first' : undefined),
        set: () => {},
        list: () => ['KEY'],
      }
      const provider2: SecretsProvider = {
        get: (k) => (k === 'KEY' ? 'second' : undefined),
        set: () => {},
        list: () => [],
      }
      const svc = new SecretsService([provider1, provider2])
      expect(svc.get('KEY')).toBe('first')
    })

    it('falls through all providers when no value found', () => {
      const provider1: SecretsProvider = {
        get: () => undefined,
        set: () => {},
        list: () => [],
      }
      const provider2: SecretsProvider = {
        get: () => undefined,
        set: () => {},
        list: () => [],
      }
      const svc = new SecretsService([provider1, provider2])
      expect(svc.get('NOTFOUND')).toBeUndefined()
    })
  })

  describe('apply', () => {
    it('registers secrets effect', () => {
      const { ctx, services } = mockCtx()
      apply(ctx)
      expect(services['secrets']).toBeDefined()
    })

    it('registers secrets effect', () => {
      const { ctx, services } = mockCtx()
      apply(ctx)
      expect(services['secrets']).toBeDefined()
    })
  })

  describe('gateway/request hook', () => {
    it('injects secrets into process.env before next()', async () => {
      const { ctx, services } = mockCtx()
      apply(ctx)
      const svc = services['secrets'] as SecretsService
      svc.set('MY_SECRET', 'super-secret')

      let envAtNext: Record<string, string | undefined> = {}
      await ctx.waterfall(
        'gateway/request',
        { model: 'test-model' },
        async (ev: any) => {
          envAtNext = { ...process.env }
          return ev
        },
      )
      expect(envAtNext['MY_SECRET']).toBe('super-secret')
    })

    it('restores original env after next() completes', async () => {
      const { ctx, services } = mockCtx()
      apply(ctx)
      const svc = services['secrets'] as SecretsService
      svc.set('RESTORE_KEY', 'secret-value')

      await ctx.waterfall(
        'gateway/request',
        { model: 'test' },
        async (ev: any) => ev,
      )
      expect(process.env['RESTORE_KEY']).toBeUndefined()
    })

    it('restores pre-existing env vars after next()', async () => {
      const { ctx, services } = mockCtx()
      apply(ctx)
      const svc = services['secrets'] as SecretsService
      svc.set('PREEXIST', 'from-secrets')

      process.env['PREEXIST'] = 'original-value'
      try {
        await ctx.waterfall(
          'gateway/request',
          { model: 'test' },
          async (ev: any) => ev,
        )
        expect(process.env['PREEXIST']).toBe('original-value')
      } finally {
        delete process.env['PREEXIST']
      }
    })

    it('injects multiple secrets', async () => {
      const { ctx, services } = mockCtx()
      apply(ctx)
      const svc = services['secrets'] as SecretsService
      svc.set('SECRET_A', 'value-a')
      svc.set('SECRET_B', 'value-b')

      const captured: Record<string, string | undefined> = {}
      await ctx.waterfall(
        'gateway/request',
        { model: 'test' },
        async (ev: any) => {
          captured.SECRET_A = process.env['SECRET_A']
          captured.SECRET_B = process.env['SECRET_B']
          return ev
        },
      )
      expect(captured.SECRET_A).toBe('value-a')
      expect(captured.SECRET_B).toBe('value-b')
    })

    it('next() exception still restores env', async () => {
      const { ctx, services } = mockCtx()
      apply(ctx)
      const svc = services['secrets'] as SecretsService
      svc.set('EXCEPTION_KEY', 'secret')

      await expect(
        ctx.waterfall(
          'gateway/request',
          { model: 'test' },
          async (_ev: any) => {
            throw new Error('test error')
          },
        ),
      ).rejects.toThrow('test error')

      expect(process.env['EXCEPTION_KEY']).toBeUndefined()
    })
  })
})
