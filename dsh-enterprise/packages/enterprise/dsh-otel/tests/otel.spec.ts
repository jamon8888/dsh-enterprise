import { describe, it, expect, vi } from 'vitest'
import * as api from '@opentelemetry/api'
import { apply } from '../src/plugin.js'

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

describe('dsh-otel', () => {
  it('span created via otel.trace', () => {
    const { ctx, services } = mockCtx()
    apply(ctx)
    const svc = services['otel'] as { trace: (n: string, fn: (s: any) => unknown) => unknown }
    const mockSpan: any = { spanContext: () => ({ traceId: 'abc' }), end: vi.fn() }
    const mockTracer: any = { startActiveSpan: vi.fn((name: string, fn: any) => fn(mockSpan)) }
    const spy = vi.spyOn(api.trace, 'getTracer').mockReturnValue(mockTracer as any)
    svc.trace('test-span', (span: any) => {
      expect(span).toBe(mockSpan)
      return 'ok'
    })
    expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('test-span', expect.any(Function))
    spy.mockRestore()
  })

  it('traceId propagated on gateway/request', async () => {
    const { ctx } = mockCtx()
    apply(ctx)
    const mockSpan: any = {
      spanContext: () => ({ traceId: 'trace-123' }),
      end: vi.fn(),
      setAttribute: vi.fn(),
    }
    const mockTracer: any = {
      startActiveSpan: vi.fn((name: string, fn: any) => fn(mockSpan)),
    }
    const spy = vi.spyOn(api.trace, 'getTracer').mockReturnValue(mockTracer as any)
    const ev: any = { orgId: 'o1' }
    const res = await ctx.waterfall('gateway/request', ev, async (e: any) => e)
    expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('gateway/request', expect.any(Function))
    expect(res.traceId).toBe('trace-123')
    // also watchtower and guard paths create spans
    await ctx.waterfall('watchtower/receipt', { id: 'r1' }, async (e: any) => e)
    expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('watchtower/receipt', expect.any(Function))
    await ctx.waterfall('guard/block', { phi: 0.1 }, async (e: any) => e)
    expect(mockTracer.startActiveSpan).toHaveBeenCalled()
    spy.mockRestore()
  })
})
