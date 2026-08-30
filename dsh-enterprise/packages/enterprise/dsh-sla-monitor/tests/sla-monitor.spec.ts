import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SlaMonitor, apply, SLO } from '../src/plugin.js'

function globMatch(pattern: string, str: string): boolean {
  const ps = pattern.split('*')
  if (ps.length === 1) return str === pattern
  let pos = 0
  for (const p of ps) {
    if (p === '') continue
    const idx = str.indexOf(p, pos)
    if (idx === -1) return false
    pos = idx + p.length
  }
  return true
}

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
      const matching = Object.keys(handlers).filter((k) => globMatch(k, event))
      const list = matching.flatMap((k) => handlers[k])
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

describe('dsh-sla-monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('SLO thresholds: gateway-p99 2s, guard-block-rate 1%', () => {
    expect(SLO.gatewayP99Ms).toBe(2000)
    expect(SLO.guardBlockRate).toBe(0.01)
  })

  it('p99 >2s → alert', () => {
    const m = new SlaMonitor()
    const alert = m.record('gateway.p99', 2500)
    expect(alert).not.toBeNull()
    expect(alert!.metric).toBe('gateway.p99')
    expect(m.alerts.length).toBe(1)
    expect(m.record('gateway.p99', 1500)).toBeNull()
    expect(m.alerts.length).toBe(1)
  })

  it('guard block rate >1% → alert', () => {
    const m = new SlaMonitor()
    expect(m.record('guard.block_rate', 0.02)).not.toBeNull()
    expect(m.record('guard.block_rate', 0.005)).toBeNull()
  })

  it('observeLatency p99 >2s triggers alert via gateway/request path', async () => {
    const { ctx, services } = mockCtx()
    apply(ctx)
    const svc = services['sla-monitor'] as { alerts: any[]; monitor: SlaMonitor }
    for (let i = 0; i < 99; i++) svc.monitor.observeLatency(3000)
    const alert = svc.monitor.observeLatency(5000)
    expect(alert).not.toBeNull()
    const direct = svc.monitor.record('gateway.p99', 2500)
    expect(direct).not.toBeNull()
    expect(svc.alerts.length).toBeGreaterThan(0)
  })

  it('ctx.on sla/metric → alert', async () => {
    const { ctx, services } = mockCtx()
    apply(ctx)
    const svc = services['sla-monitor'] as { alerts: any[] }
    await ctx.waterfall('sla/metric', { metric: 'gateway.p99', value: 3000 }, async (e: any) => e)
    expect(svc.alerts.length).toBe(1)
    expect(svc.alerts[0].value).toBe(3000)
  })

  it('clear() resets all state', () => {
    const m = new SlaMonitor()
    m.record('gateway.p99', 3000)
    m.observeLatency(5000)
    m.observeGuard(true)
    m.observeGuard(true)
    expect(m.alerts.length).toBeGreaterThan(0)
    expect(m['latencies'].length).toBeGreaterThan(0)
    expect(m['guardTotal']).toBeGreaterThan(0)
    m.clear()
    expect(m.alerts.length).toBe(0)
    expect(m['latencies'].length).toBe(0)
    expect(m['guardTotal']).toBe(0)
    expect(m['guardBlocked']).toBe(0)
  })

  it('observeGuard() calculates block rate and alerts when > 1%', () => {
    const m = new SlaMonitor()
    // 0 blocked out of 10 = 0% → no alert
    for (let i = 0; i < 10; i++) m.observeGuard(false)
    expect(m['guardBlocked']).toBe(0)
    expect(m['guardTotal']).toBe(10)
    // 2 blocked out of 12 = 16.7% → alert
    m.observeGuard(true)
    m.observeGuard(true)
    const alert = m.observeGuard(false)
    expect(alert).not.toBeNull()
    expect(alert!.metric).toBe('guard.block_rate')
  })

  it('gateway/request hook calls observeLatency on success', async () => {
    const { ctx, services } = mockCtx()
    apply(ctx)
    const svc = services['sla-monitor'] as { monitor: SlaMonitor }
    await ctx.waterfall(
      'gateway/request',
      { latencyMs: 500 },
      async (e: any) => e
    )
    expect(svc.monitor['latencies'].length).toBe(1)
    expect(svc.monitor['latencies'][0]).toBe(500)
  })

  it('gateway/request hook calls observeLatency on throw (catch path)', async () => {
    const { ctx, services } = mockCtx()
    apply(ctx)
    const svc = services['sla-monitor'] as { monitor: SlaMonitor }
    await expect(
      ctx.waterfall(
        'gateway/request',
        {},
        async (_e: any) => { throw new Error('boom') }
      )
    ).rejects.toThrow('boom')
    expect(svc.monitor['latencies'].length).toBe(1)
  })

  it('guard/block hook calls observeGuard(false) on success', async () => {
    const { ctx, services } = mockCtx()
    apply(ctx)
    const svc = services['sla-monitor'] as { monitor: SlaMonitor }
    await ctx.waterfall('guard/block', {}, async (e: any) => e)
    expect(svc.monitor['guardTotal']).toBe(1)
    expect(svc.monitor['guardBlocked']).toBe(0)
  })

  it('guard/block hook calls observeGuard(true) on throw', async () => {
    const { ctx, services } = mockCtx()
    apply(ctx)
    const svc = services['sla-monitor'] as { monitor: SlaMonitor }
    await expect(
      ctx.waterfall('guard/block', {}, async (_e: any) => { throw new Error('blocked') })
    ).rejects.toThrow('blocked')
    expect(svc.monitor['guardTotal']).toBe(1)
    expect(svc.monitor['guardBlocked']).toBe(1)
  })

  it('guard/* wildcard fires for non-guard/block events and counts GuardError as blocked', async () => {
    const { ctx, services } = mockCtx()
    apply(ctx)
    const svc = services['sla-monitor'] as { monitor: SlaMonitor }
    // fire guard/allow which is not guard/block, so it hits the wildcard
    await expect(
      ctx.waterfall(
        'guard/allow',
        {},
        async (_e: any) => {
          const err = new Error('denied')
          ;(err as any).code = 'GUARD_BLOCKED'
          throw err
        }
      )
    ).rejects.toThrow('denied')
    expect(svc.monitor['guardTotal']).toBe(1)
    expect(svc.monitor['guardBlocked']).toBe(1)
  })

  it('check() accepts gateway-p99 and gateway/p99 aliases', () => {
    const m = new SlaMonitor()
    expect(m.check('gateway-p99', 2500)).not.toBeNull()
    expect(m.check('gateway/p99', 2500)).not.toBeNull()
    expect(m.check('guard-block-rate', 0.02)).not.toBeNull()
    expect(m.check('guard/block_rate', 0.02)).not.toBeNull()
    expect(m.check('unknown', 999)).toBeNull()
  })
})
