import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recordPhi, recordEws, recordLatency } from '../src/telemetry.js'

const mockRecord = vi.hoisted(() => vi.fn())

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: () => ({
      createHistogram: () => ({
        record: mockRecord,
      }),
    }),
  },
}))

describe('telemetry', () => {
  beforeEach(() => {
    mockRecord.mockClear()
  })

  describe('recordPhi', () => {
    it('records phi value to histogram', () => {
      recordPhi(0.85)
      expect(mockRecord).toHaveBeenCalledWith(0.85)
    })

    it('is fail-open when histogram record throws', () => {
      mockRecord.mockImplementationOnce(() => { throw new Error('OTel error') })
      expect(() => recordPhi(0.85)).not.toThrow()
    })
  })

  describe('recordEws', () => {
    it('records variance and ac1 to histogram', () => {
      recordEws(1.5, 0.65)
      expect(mockRecord).toHaveBeenCalledWith(1.5, { ac1: '0.65' })
    })

    it('is fail-open when histogram record throws', () => {
      mockRecord.mockImplementationOnce(() => { throw new Error('OTel error') })
      expect(() => recordEws(1.5, 0.65)).not.toThrow()
    })
  })

  describe('recordLatency', () => {
    it('records latency with guardId attribute', () => {
      recordLatency(42, 'phi-threshold')
      expect(mockRecord).toHaveBeenCalledWith(42, { guardId: 'phi-threshold' })
    })

    it('is fail-open when histogram record throws', () => {
      mockRecord.mockImplementationOnce(() => { throw new Error('OTel error') })
      expect(() => recordLatency(42, 'phi-threshold')).not.toThrow()
    })
  })

  describe('guard-runner integration', () => {
    it('records per-guard latency via guard-runner', async () => {
      mockRecord.mockClear()
      const { apply } = await import('../src/guard-runner.js')
      const handlers: Record<string, unknown> = {}
      const ctx = {
        effect: () => () => {},
        on: (e: string, h: unknown) => { handlers[e] = h; return () => {} },
        get: () => ({ calculatePhi: async () => ({ phi: 0.5, cesHash: 'abc' }), runCusp: async () => ({ ok: true }) }),
        tools: {},
        waterfall: async (_: string, ev: unknown, next: (x: unknown) => unknown) => next(ev),
        sessions: {},
        audit: {},
        chains: {},
      } as any
      apply(ctx, { minPhi: 0.1, max_exact_size: 15, tpmVars: [] })
      const guardHandler = handlers['tools/guard'] as ((ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>) | undefined
      if (guardHandler) {
        await guardHandler({ tpm: { n: 2, data: [] }, state: 0 }, async () => ({}))
      }
      expect(mockRecord).toHaveBeenCalled()
      const latencyCalls = mockRecord.mock.calls.filter((c) => typeof c[1] === 'object' && 'guardId' in (c[1] as object))
      expect(latencyCalls.length).toBeGreaterThan(0)
    })
  })
})
