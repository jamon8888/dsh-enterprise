import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apply } from '../src/plugin.js'

function mockCtx() {
  const handlers: Record<string, unknown> = {}
  const ctx: Record<string, unknown> = {
    effect: vi.fn((nameOrFn: unknown, fn?: unknown) => {
      const svc = typeof nameOrFn === 'string' ? (fn as () => unknown)() : (nameOrFn as () => unknown)()
      return () => {}
    }),
    on: vi.fn((event: string, handler: unknown) => {
      handlers[event] = handler
      return () => {}
    }),
    emit: vi.fn(),
  }
  return { ctx, handlers }
}

describe('AAR Bridge plugin', () => {
  let ctx: ReturnType<typeof mockCtx>['ctx']
  let handlers: ReturnType<typeof mockCtx>['handlers']

  beforeEach(() => {
    const m = mockCtx()
    ctx = m.ctx
    handlers = m.handlers
  })

  it('registers aarBridge effect with scoreSession, scoreSessionSync, bufferSize', () => {
    apply(ctx as never, { aarSidecarUrl: 'http://localhost:8787', timeoutMs: 5000, failOpen: true })
    const effectCall = (ctx.effect as ReturnType<typeof vi.fn>).mock.calls[0]
    const effectFn = effectCall[1] as () => unknown
    const effect = effectFn()
    expect(typeof effect.scoreSession).toBe('function')
    expect(typeof effect.scoreSessionSync).toBe('function')
    expect(typeof effect.bufferSize).toBe('function')
  })

  it('subscribes to iit-guard.decision event', () => {
    apply(ctx as never, { aarSidecarUrl: 'http://localhost:8787', timeoutMs: 5000, failOpen: true })
    expect(ctx.on).toHaveBeenCalledWith('iit-guard.decision', expect.any(Function))
  })

  it('scoreSessionSync returns null when session not found', () => {
    apply(ctx as never, { aarSidecarUrl: 'http://localhost:8787', timeoutMs: 5000, failOpen: true })
    const effectFn = ((ctx.effect as ReturnType<typeof vi.fn>).mock.calls[0][1] as () => unknown)
    const effect = effectFn()
    expect(effect.scoreSessionSync('nonexistent')).toBeNull()
  })

  it('iit-guard.decision events accumulate in session buffer', () => {
    apply(ctx as never, { aarSidecarUrl: 'http://localhost:8787', timeoutMs: 5000, failOpen: true })
    const onHandler = handlers['iit-guard.decision'] as (ev: unknown) => void

    onHandler({ guardId: 'phi-threshold', disposition: 'pass', timestamp: 1000, sessionId: 's1' })
    onHandler({ guardId: 'causal-emergence', disposition: 'warn', phi: 0.3, timestamp: 2000, sessionId: 's1' })
    onHandler({ guardId: 'phi-threshold', disposition: 'block', phi: 0.05, timestamp: 3000, sessionId: 's1' })

    const effectFn = ((ctx.effect as ReturnType<typeof vi.fn>).mock.calls[0][1] as () => unknown)
    const effect = effectFn()
    expect(effect.bufferSize()).toBe(1)

    const score = effect.scoreSessionSync('s1')
    expect(score).not.toBeNull()
    expect(score!.sessionId).toBe('s1')
    expect(score!.behavioralFlags).toContain('high_block_rate')
    expect(effect.bufferSize()).toBe(0) // cleared after scoring
    // aar/score event emitted
    expect(ctx.emit).toHaveBeenCalledWith('aar/score', expect.objectContaining({ sessionId: 's1' }))
  })

  it('scoreSessionSync returns full score with behavioral flags', () => {
    apply(ctx as never, { aarSidecarUrl: 'http://localhost:8787', timeoutMs: 5000, failOpen: true })
    const onHandler = handlers['iit-guard.decision'] as (ev: unknown) => void

    // Session with phi instability
    onHandler({ guardId: 'phi-threshold', disposition: 'pass', phi: 0.8, timestamp: 1000, sessionId: 's2' })
    onHandler({ guardId: 'causal-emergence', disposition: 'warn', phi: 0.1, timestamp: 2000, sessionId: 's2' })
    onHandler({ guardId: 'phi-trajectory', disposition: 'pass', phi: 0.6, timestamp: 3000, sessionId: 's2' })

    const effectFn = ((ctx.effect as ReturnType<typeof vi.fn>).mock.calls[0][1] as () => unknown)
    const effect = effectFn()
    const score = effect.scoreSessionSync('s2')

    expect(score!.behavioralFlags).toContain('phi_instability')
    expect(score!.headlinePct).toBeLessThan(100)
  })

  it('scoreSessionSync returns perfect score for empty session', () => {
    apply(ctx as never, { aarSidecarUrl: 'http://localhost:8787', timeoutMs: 5000, failOpen: true })
    const onHandler = handlers['iit-guard.decision'] as (ev: unknown) => void
    onHandler({ guardId: 'phi-threshold', disposition: 'pass', timestamp: 1000, sessionId: 's3' })

    const effectFn = ((ctx.effect as ReturnType<typeof vi.fn>).mock.calls[0][1] as () => unknown)
    const effect = effectFn()
    const score = effect.scoreSessionSync('s3')

    expect(score!.headlinePct).toBe(100)
    expect(score!.passesFilter).toBe(true)
    expect(score!.trajectoryScore).toBe(1.0)
    expect(score!.behavioralFlags).toEqual([])
  })

  it('uses default sessionId when event has no sessionId', () => {
    apply(ctx as never, { aarSidecarUrl: 'http://localhost:8787', timeoutMs: 5000, failOpen: true })
    const onHandler = handlers['iit-guard.decision'] as (ev: unknown) => void
    onHandler({ guardId: 'phi-threshold', disposition: 'pass', timestamp: 1000 })

    const effectFn = ((ctx.effect as ReturnType<typeof vi.fn>).mock.calls[0][1] as () => unknown)
    const effect = effectFn()
    expect(effect.bufferSize()).toBe(1)
    const score = effect.scoreSessionSync('default')
    expect(score).not.toBeNull()
  })
})
