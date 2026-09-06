/**
 * phi-trajectory viability index (VI) — RiskGate predictive early warning.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guards/phi-trajectory-viability
 */
import { describe, it, expect } from 'vitest'
import { phiTrajectoryGuard, viabilityDisposition } from '../../src/guards/phi-trajectory.ts'

const cfg = { window: 10, maxDrop: 0.15, maxSlope: -0.02, severity: 'error' } as const

async function feed(sessionId: string, phis: number[]) {
  let res: Awaited<ReturnType<typeof phiTrajectoryGuard.run>> | undefined
  for (const phi of phis) {
    res = await phiTrajectoryGuard.run({} as never, { ...cfg }, { sessionId, phi })
  }
  return res!
}

describe('phi-trajectory viability index', () => {
  it('emits viabilityIndex in [-1, +1] from a declining window', async () => {
    const res = await feed('vi-collect', [0.5, 0.45, 0.4, 0.3])
    expect(res.viabilityIndex).toBeDefined()
    expect(res.viabilityIndex!).toBeGreaterThanOrEqual(-1)
    expect(res.viabilityIndex!).toBeLessThanOrEqual(1)
    // declining trajectory → viability below perfect
    expect(res.viabilityIndex!).toBeLessThan(1)
    expect(res.trajectoryStable).toBeDefined()
  })

  it('warns in the viability warn zone (collapsing, not collapsed)', async () => {
    const res = await feed('vi-warn', [0.5, 0.48, 0.46, 0.44, 0.42])
    expect(res.viabilityIndex!).toBeLessThan(-0.5)
    expect(res.viabilityIndex!).toBeGreaterThanOrEqual(-0.8)
    expect(res.disposition).toBe('warn')
    expect(res.trajectoryStable).toBe(false)
  })

  it('blocks when viability collapses below -0.8', async () => {
    const res = await feed('vi-block', [0.5, 0.3, 0.1, 0.0])
    expect(res.viabilityIndex!).toBeLessThan(-0.8)
    expect(res.disposition).toBe('block')
    expect(res.trajectoryStable).toBe(false)
  })

  it('stays pass with healthy viability', async () => {
    const res = await feed('vi-healthy', [0.5, 0.51, 0.5, 0.52])
    expect(res.viabilityIndex!).toBeGreaterThan(-0.5)
    expect(res.disposition).toBe('pass')
    expect(res.trajectoryStable).toBe(true)
  })

  it('maps viability thresholds per spec (-0.5 warn, -0.8 block)', () => {
    expect(viabilityDisposition(1)).toBe('pass')
    expect(viabilityDisposition(0)).toBe('pass')
    expect(viabilityDisposition(-0.49)).toBe('pass')
    expect(viabilityDisposition(-0.51)).toBe('warn')
    expect(viabilityDisposition(-0.7)).toBe('warn')
    expect(viabilityDisposition(-0.8)).toBe('warn')
    expect(viabilityDisposition(-0.81)).toBe('block')
    expect(viabilityDisposition(-1)).toBe('block')
  })
})
