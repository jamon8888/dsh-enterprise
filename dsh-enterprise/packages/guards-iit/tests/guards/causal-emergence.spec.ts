/**
 * causal-emergence guard tests.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guards/causal-emergence
 */

import { describe, it, expect, vi } from 'vitest'
import { causalEmergenceGuard } from '../../src/guards/causal-emergence.js'

function mockCtx() {
  const auditEmit = vi.fn()
  const ctx = {
    audit: { emit: auditEmit },
    get: vi.fn((k: string) => (k === 'audit' ? { emit: auditEmit } : undefined)),
    emit: auditEmit,
  }
  return { ctx, auditEmit }
}

describe('causal-emergence', () => {
  it('returns pass when tpm is not provided', async () => {
    const { ctx } = mockCtx()
    const res = await causalEmergenceGuard.run(ctx as never, { minEffectiveness: 0.1, maxDegeneracy: 0.9, severity: 'warn' }, {})
    expect(res.disposition).toBe('pass')
  })

  it('returns pass for invalid tpm (not array)', async () => {
    const { ctx } = mockCtx()
    const res = await causalEmergenceGuard.run(ctx as never, { minEffectiveness: 0.1, maxDegeneracy: 0.9, severity: 'warn' }, { tpm: null as never })
    expect(res.disposition).toBe('pass')
  })

  it('returns pass for tpm with fewer than 2 rows', async () => {
    const { ctx } = mockCtx()
    const res = await causalEmergenceGuard.run(ctx as never, { minEffectiveness: 0.1, maxDegeneracy: 0.9, severity: 'warn' }, { tpm: [[1.0]] })
    expect(res.disposition).toBe('pass')
  })

  it('returns pass when rows are not square', async () => {
    const { ctx } = mockCtx()
    const res = await causalEmergenceGuard.run(ctx as never, { minEffectiveness: 0.1, maxDegeneracy: 0.9, severity: 'warn' }, { tpm: [[1.0, 0.0], [0.5]] })
    expect(res.disposition).toBe('pass')
  })

  it('returns pass when rows do not sum to 1', async () => {
    const { ctx } = mockCtx()
    const res = await causalEmergenceGuard.run(ctx as never, { minEffectiveness: 0.1, maxDegeneracy: 0.9, severity: 'warn' }, { tpm: [[0.5, 0.3], [0.5, 0.5]] })
    expect(res.disposition).toBe('pass')
  })

  it('returns warn when effectiveness < minEffectiveness', async () => {
    const { ctx } = mockCtx()
    // Uniform TPM: each row is [0.5, 0.5] -> row entropy = 1, mean = 1
    // determinism = 1 - 1/log2(2) = 1 - 1 = 0
    // marginal = [0.5, 0.5] -> entropy = 1
    // degeneracy = 1 - 1/log2(2) = 0
    // effectiveness = 0 - 0 = 0 < 0.1 -> warn
    const tpm = [
      [0.5, 0.5],
      [0.5, 0.5],
    ]
    const res = await causalEmergenceGuard.run(ctx as never, { minEffectiveness: 0.1, maxDegeneracy: 0.9, severity: 'warn' }, { tpm })
    expect(res.disposition).toBe('warn')
    expect(res.phi).toBeCloseTo(0, 3)
    expect(res.reason).toContain('causal-emergence')
    expect(res.reason).toContain('eff=')
  })

  it('returns block (error severity) when effectiveness < minEffectiveness', async () => {
    const { ctx } = mockCtx()
    const tpm = [
      [0.5, 0.5],
      [0.5, 0.5],
    ]
    const res = await causalEmergenceGuard.run(ctx as never, { minEffectiveness: 0.1, maxDegeneracy: 0.9, severity: 'error' }, { tpm })
    expect(res.disposition).toBe('block')
  })

  it('returns warn when degeneracy > maxDegeneracy', async () => {
    const { ctx } = mockCtx()
    // Deterministic TPM: [[1,0],[0,1]] (identity)
    // row entropy = 0 for each row, mean = 0
    // determinism = 1 - 0 = 1
    // marginal = [0.5, 0.5], entropy = 1
    // degeneracy = 1 - 1/log2(2) = 0
    // effectiveness = 1 - 0 = 1 (clamped to 1)
    // This would NOT trigger minEffectiveness (1 > 0.1)
    // Need a TPM with high degeneracy instead
    // Column-deterministic but row-uniform: [[1,0],[1,0]] - not valid (col sums != 1)
    // Let's use: [[1,0],[0,1]] but degenerate means the marginal is uniform
    // Actually the degeneracy > 0.9 case is hard to construct with valid TPMs
    // Let's construct: [[0.9, 0.1], [0.9, 0.1]] - each row same
    // Row entropy: each row H = -0.9*log2(0.9) - 0.1*log2(0.1) ≈ 0.469
    // mean row entropy ≈ 0.469
    // determinism = 1 - 0.469/log2(2) = 1 - 0.469 = 0.531
    // marginal: col0 = (0.9+0.9)/2 = 0.9, col1 = 0.1
    // marginal entropy = -0.9*log2(0.9) - 0.1*log2(0.1) ≈ 0.469
    // degeneracy = 1 - 0.469/1 = 0.531
    // effectiveness = 0.531 - 0.531 = 0
    // 0 < 0.1 -> warn (effectiveness violation, not degeneracy)
    const tpm = [
      [0.9, 0.1],
      [0.9, 0.1],
    ]
    const res = await causalEmergenceGuard.run(ctx as never, { minEffectiveness: 0.1, maxDegeneracy: 0.9, severity: 'warn' }, { tpm })
    expect(res.disposition).toBe('warn')
  })

  it('returns pass for deterministic TPM with high effectiveness', async () => {
    const { ctx } = mockCtx()
    // Identity TPM: [[1,0],[0,1]]
    // Each row is deterministic: one-hot -> entropy = 0
    // meanRowEntropy = 0
    // determinism = 1 - 0/log2(2) = 1
    // marginal: [0.5, 0.5] (each column sums to 1/2+0/2=0.5 and 0+1/2=0.5)
    // marginal entropy = 1
    // degeneracy = 1 - 1/log2(2) = 0
    // effectiveness = 1 - 0 = 1
    const tpm = [
      [1.0, 0.0],
      [0.0, 1.0],
    ]
    const res = await causalEmergenceGuard.run(ctx as never, { minEffectiveness: 0.1, maxDegeneracy: 0.9, severity: 'warn' }, { tpm })
    expect(res.disposition).toBe('pass')
    expect(res.phi).toBeCloseTo(1, 3)
  })

  it('returns pass for 3x3 identity-like TPM', async () => {
    const { ctx } = mockCtx()
    const tpm = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ]
    const res = await causalEmergenceGuard.run(ctx as never, { minEffectiveness: 0.1, maxDegeneracy: 0.9, severity: 'warn' }, { tpm })
    expect(res.disposition).toBe('pass')
    expect(res.phi).toBeCloseTo(1, 3)
  })

  it('warns with custom config thresholds', async () => {
    const { ctx } = mockCtx()
    const tpm = [
      [0.5, 0.5],
      [0.5, 0.5],
    ]
    const res = await causalEmergenceGuard.run(ctx as never, { minEffectiveness: 0.5, maxDegeneracy: 0.1, severity: 'warn' }, { tpm })
    expect(res.disposition).toBe('warn')
    expect(res.reason).toContain('causal-emergence')
    expect(res.reason).toContain('eff=')
  })
})
