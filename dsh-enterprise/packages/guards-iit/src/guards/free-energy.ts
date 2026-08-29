/**
 * free-energy guard — warns when predictive surprise (free-energy) exceeds threshold.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guards/free-energy
 */

import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type { GuardResult } from '../types.js'

const PHI2_FLOOR = 1e-6
const TWO_PI = 2 * Math.PI

const freeEnergyHistory = new Map<string, { observed: number[]; predicted: number[]; sigma2: number[] }>()

export const freeEnergyGuard = {
  id: 'free-energy' as const,
  Config: z.object({
    window: z.number().default(10),
    threshold: z.number().default(2.0),
    alpha: z.number().default(0.3),
    minPhi: z.number().default(0.1),
  }),
  async run(
    ctx: Context,
    config: { window: number; threshold: number; alpha: number; minPhi: number },
    ev: { sessionId?: string; phi?: number; phi_predicted?: number },
  ): Promise<GuardResult> {
    const sessionId = ev.sessionId ?? 'default'
    const phi = ev.phi
    if (typeof phi !== 'number') return { disposition: 'pass' }
    if (phi < config.minPhi) return { disposition: 'pass', phi }

    let hist = freeEnergyHistory.get(sessionId)
    if (!hist) {
      hist = { observed: [], predicted: [], sigma2: [] }
      freeEnergyHistory.set(sessionId, hist)
    }

    const predicted: number = ev.phi_predicted ?? (hist.observed.length > 0 ? hist.observed[hist.observed.length - 1]! : phi!)
    hist.observed.push(phi!)
    hist.predicted.push(predicted)

    if (hist.observed.length < 3) return { disposition: 'pass', phi }

    if (hist.observed.length > config.window) {
      hist.observed.shift()
      hist.predicted.shift()
      hist.sigma2.shift()
    }

    const errors = hist.observed.map((o, i) => o - (hist!.predicted[i] ?? 0))
    let sigma2: number = hist.sigma2.length > 0 ? (hist.sigma2[hist.sigma2.length - 1] ?? variance(errors)) : variance(errors)
    for (const err of errors.slice(-1)) {
      sigma2 = config.alpha * err * err + (1 - config.alpha) * sigma2
    }
    sigma2 = Math.max(sigma2, PHI2_FLOOR)
    hist.sigma2.push(sigma2)

    const surprise = errors.map((e) => 0.5 * (e * e / sigma2 + Math.log(TWO_PI * sigma2)))
    const meanSurprise = surprise.reduce((a, b) => a + b, 0) / surprise.length

    if (meanSurprise > config.threshold) {
      return {
        disposition: 'warn',
        phi,
        reason: `free-energy ${meanSurprise.toFixed(3)} > threshold ${config.threshold}`,
      }
    }
    return { disposition: 'pass', phi }
  },
}

function variance(arr: number[]): number {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length
  return arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length
}
