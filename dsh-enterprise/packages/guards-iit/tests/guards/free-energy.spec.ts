import { describe, it, expect, vi } from 'vitest'
import { freeEnergyGuard } from '../../src/guards/free-energy.js'

function mockCtx() {
  const auditEmit = vi.fn()
  const ctx = {
    audit: { emit: auditEmit },
    get: vi.fn((k: string) => (k === 'audit' ? { emit: auditEmit } : undefined)),
    emit: auditEmit,
  }
  return { ctx, auditEmit }
}

describe('free-energy', () => {
  it('returns warn when mean surprise exceeds threshold', async () => {
    const { ctx } = mockCtx()
    // obs=[5, 5, 5], pred=[5, 5, 0] -> errors=[0, 0, 5]
    // With alpha=0.05: variance=8.333, EMA sigma2≈6.528
    // mean surprise ≈ 2.49 > 2.0 threshold -> warn
    await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 2.0, alpha: 0.05, minPhi: 0.1 }, { sessionId: 'warn1', phi: 5 })
    await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 2.0, alpha: 0.05, minPhi: 0.1 }, { sessionId: 'warn1', phi: 5 })
    const res = await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 2.0, alpha: 0.05, minPhi: 0.1 }, { sessionId: 'warn1', phi: 5, phi_predicted: 0 })
    expect(res.disposition).toBe('warn')
    expect(res.phi).toBe(5)
    expect(res.reason).toContain('free-energy')
  })

  it('returns pass when mean surprise is below threshold', async () => {
    const { ctx } = mockCtx()
    // Near-perfect predictions keep surprise low
    await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 2.0, alpha: 0.3, minPhi: 0.1 }, { sessionId: 'pass1', phi: 0.5 })
    await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 2.0, alpha: 0.3, minPhi: 0.1 }, { sessionId: 'pass1', phi: 0.51 })
    const res = await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 2.0, alpha: 0.3, minPhi: 0.1 }, { sessionId: 'pass1', phi: 0.49 })
    expect(res.disposition).toBe('pass')
  })

  it('returns pass when phi is not a number', async () => {
    const { ctx } = mockCtx()
    const res = await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 2.0, alpha: 0.3, minPhi: 0.1 }, { sessionId: 'nan', phi: undefined })
    expect(res.disposition).toBe('pass')
  })

  it('returns pass until at least 3 observations are available', async () => {
    const { ctx } = mockCtx()
    const r1 = await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 0.01, alpha: 0.05, minPhi: 0.1 }, { sessionId: 'min3', phi: 5 })
    expect(r1.disposition).toBe('pass')
    const r2 = await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 0.01, alpha: 0.05, minPhi: 0.1 }, { sessionId: 'min3', phi: 5 })
    expect(r2.disposition).toBe('pass')
    // Third obs: obs=5, pred=0, error=5 -> mean surprise 2.49 > 0.01 -> warn
    const r3 = await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 0.01, alpha: 0.05, minPhi: 0.1 }, { sessionId: 'min3', phi: 5, phi_predicted: 0 })
    expect(r3.disposition).toBe('warn')
  })

  it('defaults phi_predicted to last observed value (naive prediction)', async () => {
    const { ctx } = mockCtx()
    // obs=[0.5, 0.5, 0.5], naive pred=[0.5, 0.5, 0.5] -> errors=[0, 0, 0]
    // surprise = 0.5 * ln(2*pi*sigma2) per step (log term only)
    await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 2.0, alpha: 0.3, minPhi: 0.1 }, { sessionId: 'naive', phi: 0.5 })
    await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 2.0, alpha: 0.3, minPhi: 0.1 }, { sessionId: 'naive', phi: 0.5 })
    const res = await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 2.0, alpha: 0.3, minPhi: 0.1 }, { sessionId: 'naive', phi: 0.5 })
    expect(res.disposition).toBe('pass')
  })

  it('warns using warn disposition (not block)', async () => {
    const { ctx } = mockCtx()
    await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 2.0, alpha: 0.05, minPhi: 0.1 }, { sessionId: 'warn2', phi: 5 })
    await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 2.0, alpha: 0.05, minPhi: 0.1 }, { sessionId: 'warn2', phi: 5 })
    const res = await freeEnergyGuard.run(ctx as never, { window: 10, threshold: 2.0, alpha: 0.05, minPhi: 0.1 }, { sessionId: 'warn2', phi: 5, phi_predicted: 0 })
    expect(res.disposition).toBe('warn')
    expect(res.disposition).not.toBe('block')
  })
})
