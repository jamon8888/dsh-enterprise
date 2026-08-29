import { describe, it, expect, vi } from 'vitest'
import { apply, GuardError } from '../src/guard-runner.ts'

function mockCtx(overrides: Record<string, unknown> = {}) {
  const handlers: Record<string, unknown> = {}
  const emitCalls: { event: string; payload: unknown }[] = []
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
      if (typeof nameOrFn === 'string') {
        if (!(nameOrFn in services)) {
          services[nameOrFn as string] = svc
        } else {
          services[nameOrFn as string] = Object.assign({}, svc, services[nameOrFn as string] as Record<string, unknown>)
        }
      }
      return () => {}
    }),
    on: vi.fn((event: string, handler: unknown) => {
      handlers[event] = handler
      return () => {}
    }),
    get: vi.fn((k: string) => services[k]),
    emit: vi.fn((event: string, payload: unknown) => {
      emitCalls.push({ event, payload })
    }),
    tools,
    ...overrides,
  }
  return { ctx, services, handlers, tools, emitCalls }
}

describe('iit-guard.decision session events', () => {
  it('emits pass event after a guard passes', async () => {
    const { ctx, handlers, emitCalls } = mockCtx({
      services: {
        iitGuards: {
          calculatePhi: async () => ({ phi: 0.5, cesHash: 'abc' }),
          runCusp: async () => ({ ok: true }),
        },
      },
    })
    apply(ctx as never, { minPhi: 0.1, max_exact_size: 15, tpmVars: ['tool_success'] } as never)
    const onHandler = handlers['tools/guard'] as
      | ((ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>)
      | undefined
    expect(onHandler).toBeDefined()
    const next = vi.fn(async (ev) => ({ disposition: 'pass' }))
    await onHandler!({ tpm: { n: 2, data: [] }, state: 0 }, next as never)
    const decisionEvents = emitCalls.filter((c) => c.event === 'iit-guard.decision')
    expect(decisionEvents.length).toBeGreaterThan(0)
    const passEvents = decisionEvents.filter(
      (c) => (c.payload as { disposition: string }).disposition === 'pass',
    )
    expect(passEvents.length).toBeGreaterThan(0)
    for (const e of decisionEvents) {
      const p = e.payload as { guardId: string; disposition: string; timestamp: number; ignorable?: true }
      expect(p.guardId).toBeDefined()
      expect(['pass', 'block', 'warn']).toContain(p.disposition)
      expect(typeof p.timestamp).toBe('number')
      if (p.disposition === 'pass') {
        expect(p.ignorable).toBe(true)
      }
    }
  })

  it('emits block event before throwing GuardError on phi < minPhi', async () => {
    const { ctx, handlers, emitCalls } = mockCtx({
      services: {
        iitGuards: {
          calculatePhi: async () => ({ phi: 0.01, cesHash: 'abc' }),
          runCusp: async () => ({ ok: true }),
        },
      },
    })
    apply(ctx as never, { minPhi: 0.1, max_exact_size: 15, tpmVars: [] } as never)
    const onHandler = handlers['tools/guard'] as
      | ((ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>)
      | undefined
    expect(onHandler).toBeDefined()
    const next = vi.fn(async (ev) => ({ disposition: 'pass' }))
    await expect(onHandler!({ tpm: {}, state: 0 }, next as never)).rejects.toThrow(GuardError)
    const decisionEvents = emitCalls.filter((c) => c.event === 'iit-guard.decision')
    const blockEvents = decisionEvents.filter(
      (c) => (c.payload as { disposition: string }).disposition === 'block',
    )
    expect(blockEvents.length).toBeGreaterThan(0)
    const block = blockEvents[0].payload as { guardId: string; disposition: string; phi?: number; reason?: string }
    expect(block.guardId).toBe('phi-threshold')
    expect(block.disposition).toBe('block')
    expect(block.phi).toBe(0.01)
    expect(block.reason).toContain('phi')
    expect('ignorable' in block).toBe(false)
  })

  it('emits warn event when effect-ethos guard returns warn disposition', async () => {
    const { ctx, handlers, emitCalls } = mockCtx({
      services: {
        iitGuards: {
          calculatePhi: async () => ({ phi: 0.5, cesHash: 'abc' }),
          runCusp: async () => ({ ok: true }),
          teloids_compile_wasm: async () => ({ teloids: [{ id: 'test-norm' }] }),
          teloids_evaluate_wasm: async () => ({
            disposition: 'oblige',
            violated: ['test-norm'],
            reason: 'norm violated',
          }),
        },
      },
    })
    apply(ctx as never, { minPhi: 0.001, max_exact_size: 15, tpmVars: [], effectEthos: { severity: 'error', teloidsYaml: 'test: norms' } } as never)
    const onHandler = handlers['tools/guard'] as
      | ((ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>)
      | undefined
    expect(onHandler).toBeDefined()
    const next = vi.fn(async (ev) => ({ disposition: 'pass' }))
    await onHandler!({ tpm: { n: 2, data: [[1, 0], [0, 1]] }, state: 0 }, next as never)
    const decisionEvents = emitCalls.filter((c) => c.event === 'iit-guard.decision')
    const warnEvents = decisionEvents.filter(
      (c) => (c.payload as { disposition: string }).disposition === 'warn',
    )
    expect(warnEvents.length).toBeGreaterThan(0)
    const warn = warnEvents[0].payload as { guardId: string; disposition: string; reason?: string; ignorable?: true }
    expect(warn.guardId).toBe('effect-ethos')
    expect(warn.disposition).toBe('warn')
    expect(warn.reason).toContain('effect-ethos')
    expect('ignorable' in warn).toBe(false)
  })

  it('emits pass events with ignorable:true for pass dispositions', async () => {
    const { ctx, handlers, emitCalls } = mockCtx({
      services: {
        iitGuards: {
          calculatePhi: async () => ({ phi: 0.5, cesHash: 'h1' }),
          runCusp: async () => ({ ok: true }),
        },
      },
    })
    apply(ctx as never, { minPhi: 0.1, max_exact_size: 15, tpmVars: [] } as never)
    const onHandler = handlers['tools/guard'] as
      | ((ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>)
      | undefined
    const next = vi.fn(async (ev) => ({ disposition: 'pass' }))
    await onHandler!({ tpm: { n: 2, data: [[1, 0], [0, 1]] }, state: 0 }, next as never)
    const decisionEvents = emitCalls.filter((c) => c.event === 'iit-guard.decision')
    for (const e of decisionEvents) {
      const p = e.payload as { disposition: string; ignorable?: true }
      if (p.disposition === 'pass') {
        expect(p.ignorable).toBe(true)
      }
    }
  })
})
