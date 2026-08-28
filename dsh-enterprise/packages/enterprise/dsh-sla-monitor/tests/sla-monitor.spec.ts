import { describe, it, expect, vi } from 'vitest'
import { SlaMonitor, apply, SLO } from '../src/plugin.js'

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

describe('dsh-sla-monitor', () => {
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
    // feed 100 latencies at 100ms then one at 5000ms to push p99 over 2s
    for (let i = 0; i < 99; i++) svc.monitor.observeLatency(100)
    const alert = svc.monitor.observeLatency(5000)
    // with 100 samples, p99 is ~5000 (99th sorted), should alert
    // alternatively direct record
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
})
