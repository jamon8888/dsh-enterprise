import { describe, it, expect, vi } from 'vitest'
import { GuardError } from '../src/guard-runner.js'
import { cesFingerprintGuard } from '../src/guards/ces-fingerprint.js'
import { boundaryFrontierGuard } from '../src/guards/boundary-frontier.js'
import { attractorEwsGuard } from '../src/guards/attractor-ews.js'
import { catastropheCuspGuard } from '../src/guards/catastrophe-cusp.js'

function mockCtx(overrides: Record<string, unknown> = {}) {
  const auditEmit = vi.fn()
  const services: Record<string, unknown> = {
    audit: { emit: auditEmit },
    ...(overrides.services as Record<string, unknown> ?? {}),
  }
  const ctx: Record<string, unknown> = {
    audit: { emit: auditEmit },
    get: vi.fn((k: string) => services[k]),
    emit: auditEmit,
    ...overrides,
  }
  return { ctx, auditEmit, services }
}

describe('ces-fingerprint', () => {
  it('passes when hash matches', async () => {
    const { ctx } = mockCtx({
      services: {
        iitGuards: { calculatePhi: async () => ({ phi: 0.5, cesHash: 'abc123' }) },
        audit: { emit: vi.fn() },
      },
    })
    const res = await cesFingerprintGuard.run(ctx as never, { expectedHash: 'abc123' }, { tpm: {}, state: 0 })
    expect(res.disposition).toBe('pass')
    expect(res.cesHash).toBe('abc123')
  })

  it('blocks on hash mismatch', async () => {
    const { ctx } = mockCtx({
      services: {
        iitGuards: { calculatePhi: async () => ({ phi: 0.5, cesHash: 'abc123' }) },
      },
    })
    await expect(cesFingerprintGuard.run(ctx as never, { expectedHash: 'different' }, { tpm: {}, state: 0 })).rejects.toThrow(GuardError)
    await expect(cesFingerprintGuard.run(ctx as never, { expectedHash: 'different' }, { tpm: {}, state: 0 })).rejects.toThrow(/ces mismatch/)
  })

  it('uses phi string fallback when cesHash absent', async () => {
    const { ctx } = mockCtx({
      services: {
        iitGuards: { calculatePhi: async () => ({ phi: 0.42 }) },
      },
    })
    const res = await cesFingerprintGuard.run(ctx as never, { expectedHash: '0.42' }, { tpm: {}, state: 1 })
    expect(res.disposition).toBe('pass')
  })
})

describe('boundary-frontier', () => {
  it('passes when minBoundaryPhi low', async () => {
    const { ctx } = mockCtx({
      services: {
        iitGuards: { calculatePhi: async () => ({ phi: 0.5 }) },
      },
    })
    const res = await boundaryFrontierGuard.run(ctx as never, { minBoundaryPhi: 0.0 }, { tpm: {}, state: 0 })
    expect(res.disposition).toBe('pass')
  })

  it('passes with very low threshold even when phi is tiny', async () => {
    const { ctx } = mockCtx({
      services: {
        iitGuards: { calculatePhi: async () => ({ phi: 0.01 }) },
      },
    })
    const res = await boundaryFrontierGuard.run(ctx as never, { minBoundaryPhi: 0.001 }, { tpm: { n: 2, data: [] }, state: 0 })
    expect(res.disposition).toBe('pass')
  })

  it('blocks when phi < minBoundaryPhi', async () => {
    const { ctx } = mockCtx({
      services: {
        iitGuards: { calculatePhi: async () => ({ phi: 0.01 }) },
      },
    })
    await expect(boundaryFrontierGuard.run(ctx as never, { minBoundaryPhi: 0.1 }, { tpm: {}, state: 0 })).rejects.toThrow(GuardError)
  })
})

describe('attractor-ews', () => {
  it('emits audit event not throw when variance exceeds limit', async () => {
    const { ctx, auditEmit } = mockCtx()
    // high variance trajectory
    const trajectory = [0, 10, 0, 10, 0, 10, 0, 10]
    const res = await attractorEwsGuard.run(ctx as never, { varianceLimit: 2.0, acLimit: 0.9 }, { trajectory })
    expect(res.disposition).toBe('warn')
    expect(auditEmit).toHaveBeenCalledWith('iit/ews', expect.objectContaining({ variance: expect.any(Number), ac1: expect.any(Number) }))
  })

  it('emits audit when ac1 exceeds limit', async () => {
    const { ctx, auditEmit } = mockCtx()
    // monotonic increasing -> ac1 ~1.0
    const trajectory = [1, 2, 3, 4, 5, 6, 7, 8]
    const res = await attractorEwsGuard.run(ctx as never, { varianceLimit: 100, acLimit: 0.7 }, { trajectory })
    // monotonic has high ac1 >0.7 so should warn
    expect(res.ac1).toBeGreaterThan(0.7)
    expect(res.disposition).toBe('warn')
    expect(auditEmit).toHaveBeenCalled()
  })

  it('does not throw — warn, not block', async () => {
    const { ctx } = mockCtx()
    await expect(attractorEwsGuard.run(ctx as never, { varianceLimit: 2.0, acLimit: 0.7 }, { trajectory: [0, 10, 0, 10] })).resolves.toBeDefined()
  })

  it('passes when below limits', async () => {
    const { ctx, auditEmit } = mockCtx()
    const trajectory = [1, 1, 1, 1]
    const res = await attractorEwsGuard.run(ctx as never, { varianceLimit: 2.0, acLimit: 0.7 }, { trajectory })
    expect(res.disposition).toBe('pass')
    expect(auditEmit).not.toHaveBeenCalled()
  })
})

describe('catastrophe-cusp', () => {
  it('warns at 0.2 — emits iit/cusp and returns warn', async () => {
    const { ctx, auditEmit } = mockCtx()
    // trajectory [0,0,0] => distance 0 < 0.2 but >=0 => warn
    const trajectory = [0, 0, 0]
    const res = await catastropheCuspGuard.run(ctx as never, { bifurcationMargin: 0.2 }, { trajectory })
    expect(res.disposition).toBe('warn')
    expect(res.distanceToBifurcation).toBeDefined()
    expect(res.distanceToBifurcation!).toBeGreaterThanOrEqual(0)
    expect(res.distanceToBifurcation!).toBeLessThan(0.2)
    expect(auditEmit).toHaveBeenCalledWith('iit/cusp', expect.objectContaining({ distanceToBifurcation: expect.any(Number) }))
  })

  it('blocks when distance < 0 (inside cusp)', async () => {
    const { ctx } = mockCtx()
    // [1,-1,1,-1] => a≈-1,b≈0 => distance -4 <0
    const trajectory = [1, -1, 1, -1]
    await expect(catastropheCuspGuard.run(ctx as never, { bifurcationMargin: 0.2 }, { trajectory })).rejects.toThrow(GuardError)
  })

  it('passes when distance well above margin', async () => {
    const { ctx, auditEmit } = mockCtx()
    // single value large? Let's pick trajectory that yields large positive distance
    // [10,10,10] => heuristic: a≈-100,b≈-1000 => distance large positive
    const trajectory = [10, 10, 10]
    const res = await catastropheCuspGuard.run(ctx as never, { bifurcationMargin: 0.2 }, { trajectory })
    expect(res.disposition).toBe('pass')
    expect(auditEmit).not.toHaveBeenCalled()
  })

  it('does not throw on empty trajectory — warns (distance 0 < 0.2)', async () => {
    const { ctx } = mockCtx()
    const res = await catastropheCuspGuard.run(ctx as never, { bifurcationMargin: 0.2 }, { trajectory: [] })
    expect(res.disposition).toBe('warn') // distance 0 <0.2 => warn, not block
  })
})
