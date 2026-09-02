/**
 * mip-shift guard tests.
 *
 * MIT OR Apache-2.0
 *
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guards/mip-shift
 */

import { describe, it, expect, vi } from 'vitest'
import { mipShiftGuard } from '../../src/guards/mip-shift.js'

function mockCtx(calculatePhi?: (tpm: unknown, state: number) => Promise<{ phi: number; mip?: number }>) {
  const auditEmit = vi.fn()
  const ctx = {
    audit: { emit: auditEmit },
    get: vi.fn((k: string) => {
      if (k === 'audit') return { emit: auditEmit }
      if (k === 'iitGuards' && calculatePhi) return { calculatePhi }
      return undefined
    }),
    emit: auditEmit,
  }
  return { ctx, auditEmit }
}

describe('mip-shift', () => {
  // Each test uses a unique sessionId for isolation — module-level mipHistory is per-session

  it('returns pass when mip is not provided and no tpm', async () => {
    const { ctx } = mockCtx()
    const res = await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'warn' }, { sessionId: 'test-pass-no-mip' })
    expect(res.disposition).toBe('pass')
  })

  it('returns pass when mip is undefined and calculatePhi is unavailable', async () => {
    const { ctx } = mockCtx()
    const res = await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'warn' }, { sessionId: 'test-no-calc', tpm: [[0.5, 0.5], [0.5, 0.5]], state: 0 })
    expect(res.disposition).toBe('pass')
  })

  it('returns pass when history length < 3 even with mip values', async () => {
    const { ctx } = mockCtx()
    const sessionId = 'test-short-history'
    await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'warn' }, { sessionId, mip: 1.0 })
    await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'warn' }, { sessionId, mip: 1.1 })
    const res = await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'warn' }, { sessionId, mip: 0.9 })
    expect(res.disposition).toBe('pass')
  })

  it('returns warn when MIP shifts beyond maxShift sigma from rolling mean', async () => {
    const { ctx } = mockCtx()
    const sessionId = 'test-mip-shift-warn'
    // Seed history with stable deterministic MIP values
    for (let i = 0; i < 5; i++) {
      await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'warn' }, { sessionId, mip: 1.0 })
    }
    // Now inject a spike far outside the stable distribution
    const res = await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'warn' }, { sessionId, mip: 100.0 })
    expect(res.disposition).toBe('warn')
    expect(res.reason).toContain('mip-shift')
  })

  it('returns block when severity is error and MIP shifts beyond maxShift sigma', async () => {
    const { ctx } = mockCtx()
    const sessionId = 'test-mip-shift-block'
    for (let i = 0; i < 5; i++) {
      await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'error' }, { sessionId, mip: 1.0 })
    }
    const res = await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'error' }, { sessionId, mip: 100.0 })
    expect(res.disposition).toBe('block')
  })

  it('returns pass when MIP is within maxShift sigma', async () => {
    const { ctx } = mockCtx()
    const sessionId = 'test-mip-stable-4'
    // Seed with 15 identical values so std stays 0 (zero variance case)
    for (let i = 0; i < 15; i++) {
      await mipShiftGuard.run(ctx as never, { window: 20, maxShift: 2.0, severity: 'warn' }, { sessionId, mip: 1.0 })
    }
    // When all history values are identical (std=0), deviation=0 -> pass
    const res = await mipShiftGuard.run(ctx as never, { window: 20, maxShift: 2.0, severity: 'warn' }, { sessionId, mip: 1.0 })
    expect(res.disposition).toBe('pass')
  })

  it('respects window config and evicts old values', async () => {
    const { ctx } = mockCtx()
    const sessionId = 'test-window-evict'
    // Add many values with high MIP
    for (let i = 0; i < 20; i++) {
      await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'warn' }, { sessionId, mip: 100.0 + i })
    }
    // History is now only last 10 values (all high). Mean is ~105-114.
    // A value of 1.0 should be a huge deviation
    const res = await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'warn' }, { sessionId, mip: 1.0 })
    expect(res.disposition).toBe('warn')
  })

  it('uses default sessionId when not provided', async () => {
    const { ctx } = mockCtx()
    // Multiple calls without sessionId should share history under 'default'
    await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'warn' }, { mip: 1.0 })
    await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'warn' }, { mip: 1.0 })
    const res = await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'warn' }, { mip: 1.0 })
    expect(res.disposition).toBe('pass') // history length still < 3
  })

  it('calls calculatePhi when mip is missing but tpm is provided', async () => {
    const calculatePhi = vi.fn().mockResolvedValue({ phi: 0.5, mip: 42.0 })
    const { ctx } = mockCtx(calculatePhi)
    const res = await mipShiftGuard.run(ctx as never, { window: 10, maxShift: 2.0, severity: 'warn' }, { sessionId: 'test-calc', tpm: [[0.5, 0.5], [0.5, 0.5]], state: 0 })
    expect(calculatePhi).toHaveBeenCalledWith([[0.5, 0.5], [0.5, 0.5]], 0)
    expect(res.disposition).toBe('pass') // first value, history < 3
  })
})
