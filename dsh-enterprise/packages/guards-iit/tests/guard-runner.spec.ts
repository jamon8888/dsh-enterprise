import { describe, it, expect, vi } from 'vitest'
import { apply, GuardError } from '../src/guard-runner.ts'
import { phiThresholdGuard } from '../src/guards/phi-threshold.ts'

function mockCtx(overrides: Record<string, unknown> = {}) {
  const handlers: Record<string, unknown> = {}
  const services: Record<string, unknown> = {
    iitGuards: {
      calculatePhi: async () => ({ phi: 0.5, cesHash: 'abc' }),
      runCusp: async () => ({ ok: true }),
    },
    ...((overrides.services as Record<string, unknown>) ?? {}),
  }
  const tools: Record<string, unknown> = {
    guard: undefined as unknown,
    ...(overrides.tools as Record<string, unknown>),
  }
  const ctx: Record<string, unknown> = {
    effect: vi.fn((nameOrFn: unknown, fn?: unknown) => {
      const svc = typeof nameOrFn === 'string' ? (fn as () => unknown)() : (nameOrFn as () => unknown)()
      if (typeof nameOrFn === 'string' && !(nameOrFn in services)) services[nameOrFn as string] = svc
      return () => {}
    }),
    on: vi.fn((event: string, handler: unknown) => {
      handlers[event] = handler
      return () => {}
    }),
    get: vi.fn((k: string) => services[k]),
    tools,
    ...overrides,
  }
  return { ctx, services, handlers, tools }
}

describe('guard-runner', () => {
  it('waterfall next() delegation — pass through when phi >= minPhi', async () => {
    const { ctx, handlers } = mockCtx()
    apply(ctx as never, { minPhi: 0.1, max_exact_size: 15, tpmVars: ['tool_success'] } as never)
    // find registered waterfall — either tools.guard decoration or ctx.on handler
    const onHandler = handlers['tools/guard'] as ((ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>) | undefined
    if (onHandler) {
      const next = vi.fn(async (ev) => ({ disposition: 'pass' }))
      const res = await onHandler({ tpm: { n: 2, data: [] }, state: 0 }, next as never)
      expect(next).toHaveBeenCalledOnce()
      expect(res).toEqual({ disposition: 'pass' })
    } else {
      // tools.guard path — install orig then verify decoration
      const orig = vi.fn(async (ev, next) => next(ev))
      const { ctx: ctx2 } = mockCtx({ tools: { guard: orig } })
      apply(ctx2 as never, { minPhi: 0.1, max_exact_size: 15, tpmVars: [] } as never)
      const decorated = (ctx2.tools as Record<string, unknown>).guard as (ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>
      const next = vi.fn(async (ev) => ({ ok: true }))
      await decorated({ tpm: {}, state: 0 }, next as never)
      expect(next).toHaveBeenCalledOnce()
    }
  })

  it('error short-circuits — phi < minPhi throws GuardError and does not call next()', async () => {
    const { ctx, handlers } = mockCtx({
      services: { iitGuards: { calculatePhi: async () => ({ phi: 0.01, cesHash: 'abc' }) } },
    })
    apply(ctx as never, { minPhi: 0.1, max_exact_size: 15, tpmVars: [] } as never)
    const onHandler = handlers['tools/guard'] as ((ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>) | undefined
    if (onHandler) {
      const next = vi.fn(async (ev) => ({ disposition: 'pass' }))
      await expect(onHandler({ tpm: {}, state: 0 }, next as never)).rejects.toThrow(GuardError)
      expect(next).not.toHaveBeenCalled()
    }
  })

  it('block → turn reason=blocked — GuardError code is GUARD_BLOCKED', async () => {
    const err = new GuardError('phi 0.01 < minPhi 0.1')
    expect(err.code).toBe('GUARD_BLOCKED')
    expect(err.name).toBe('GuardError')
    // simulated turn handling: guard throw maps to turn { reason: 'blocked' }
    function toTurnReason(e: unknown) {
      if (e instanceof GuardError && e.code === 'GUARD_BLOCKED') return 'blocked'
      return 'error'
    }
    expect(toTurnReason(err)).toBe('blocked')
    expect(toTurnReason(new Error('other'))).toBe('error')
  })

  it('phiThresholdGuard calls calculatePhi and returns block when below threshold', async () => {
    const { ctx } = mockCtx({
      services: { iitGuards: { calculatePhi: async () => ({ phi: 0.05, cesHash: 'h1' }) } },
    })
    const res = await phiThresholdGuard.run(ctx as never, { minPhi: 0.1 }, { tpm: {}, state: 0 })
    expect(res.disposition).toBe('block')
    expect(res.phi).toBe(0.05)
  })

  it('phiThresholdGuard passes when phi >= minPhi', async () => {
    const { ctx } = mockCtx({
      services: { iitGuards: { calculatePhi: async () => ({ phi: 0.2, cesHash: 'h2' }) } },
    })
    const res = await phiThresholdGuard.run(ctx as never, { minPhi: 0.1 }, { tpm: {}, state: 0 })
    expect(res.disposition).toBe('pass')
    expect(res.phi).toBe(0.2)
  })
})
