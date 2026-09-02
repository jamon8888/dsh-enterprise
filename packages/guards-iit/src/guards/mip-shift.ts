/**
 * mip-shift guard — warns when MIP deviates from its rolling mean by > maxShift sigma.
 *
 * MIT OR Apache-2.0
 *
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guards/mip-shift
 */

import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type { GuardResult } from '../types.js'

const mipHistory = new Map<string, number[]>()

export const mipShiftGuard = {
  id: 'mip-shift' as const,
  Config: z.object({
    window: z.number().default(10),
    maxShift: z.number().default(2.0),
    severity: z.enum(['error', 'warn']).default('error'),
  }),
  async run(
    ctx: Context,
    config: { window: number; maxShift: number; severity: 'error' | 'warn' },
    ev: { sessionId?: string; tpm?: unknown; state?: number; mip?: number },
  ): Promise<GuardResult> {
    const iitGuards = (ctx as unknown as {
      get: (k: string) => {
        calculatePhi?: (tpm: unknown, state: number) => Promise<{ phi: number; mip?: number }>
      }
    }).get('iitGuards')

    let mip = ev.mip
    if (mip === undefined && iitGuards?.calculatePhi && ev.tpm !== undefined) {
      const res = await iitGuards.calculatePhi(ev.tpm, ev.state ?? 0)
      mip = (res as { mip?: number }).mip
    }
    if (typeof mip !== 'number') return { disposition: 'pass' }

    const sessionId = ev.sessionId ?? 'default'
    const history = mipHistory.get(sessionId) ?? []
    history.push(mip)
    if (history.length > config.window) history.shift()
    mipHistory.set(sessionId, history)

    if (history.length < 3) return { disposition: 'pass', phi: mip }

    const mean = history.reduce((a, b) => a + b, 0) / history.length
    const variance = history.reduce((s, x) => s + (x - mean) ** 2, 0) / history.length
    const std = Math.sqrt(variance)

    const deviation = std > 0 ? Math.abs(mip - mean) / std : 0

    if (deviation > config.maxShift) {
      return {
        disposition: config.severity === 'error' ? 'block' : 'warn',
        phi: mip,
        reason: `mip-shift: ${deviation.toFixed(2)}σ from rolling mean (window=${history.length})`,
      }
    }
    return { disposition: 'pass', phi: mip }
  },
}
