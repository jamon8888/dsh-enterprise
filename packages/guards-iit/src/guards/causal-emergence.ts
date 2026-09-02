/**
 * causal-emergence guard — warns when causal emergence effectiveness is low.
 *
 * MIT OR Apache-2.0
 *
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guards/causal-emergence
 */

import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type { GuardResult } from '../types.js'

export const causalEmergenceGuard = {
  id: 'causal-emergence' as const,
  Config: z.object({
    minEffectiveness: z.number().default(0.1),
    maxDegeneracy: z.number().default(0.9),
    severity: z.enum(['error', 'warn']).default('error'),
  }),
  async run(
    ctx: Context,
    config: { minEffectiveness: number; maxDegeneracy: number; severity: 'error' | 'warn' },
    ev: { tpm?: number[][] },
  ): Promise<GuardResult> {
    const tpm = ev.tpm
    if (!Array.isArray(tpm) || tpm.length < 2) return { disposition: 'pass' }
    const n = tpm.length
    if (tpm.some(row => !Array.isArray(row) || row.length !== n)) return { disposition: 'pass' }
    const sums = tpm.map(row => row.reduce((a, b) => a + b, 0))
    if (!sums.every(s => Math.abs(s - 1.0) < 1e-6)) return { disposition: 'pass' }

    const entropy = (p: number[]): number => {
      const nz = p.filter(x => x > 0)
      if (nz.length === 0) return 0
      return -nz.reduce((s, x) => s + x * Math.log2(x), 0)
    }

    const rowEntropies = tpm.map(row => entropy(row))
    const meanRowEntropy = rowEntropies.reduce((a, b) => a + b, 0) / n
    const determinism = 1.0 - meanRowEntropy / Math.log2(n)

    const marginal = tpm[0]!.map((_, j) => tpm.reduce((s, row) => s + (row[j] ?? 0), 0) / n)
    const marginalEntropy = entropy(marginal)
    const degeneracy = 1.0 - marginalEntropy / Math.log2(n)

    const effectiveness = Math.max(0, Math.min(1, determinism - degeneracy))

    const violated: string[] = []
    if (effectiveness < config.minEffectiveness) violated.push('minEffectiveness')
    if (degeneracy > config.maxDegeneracy) violated.push('maxDegeneracy')

    if (violated.length > 0) {
      return {
        disposition: config.severity === 'error' ? 'block' : 'warn',
        reason: `causal-emergence: eff=${effectiveness.toFixed(3)} (min=${config.minEffectiveness}), deg=${degeneracy.toFixed(3)} (max=${config.maxDegeneracy})`,
        phi: effectiveness,
      }
    }
    return { disposition: 'pass', phi: effectiveness }
  },
}
