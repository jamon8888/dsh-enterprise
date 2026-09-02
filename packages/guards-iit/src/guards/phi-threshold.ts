/**
 * phi-threshold guard — blocks when Φ < minPhi via ctx.get('iitGuards').calculatePhi
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guards/phi-threshold
 */

import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type { GuardResult } from '../types.js'

export const phiThresholdGuard = {
  id: 'phi-threshold' as const,
  Config: z.object({ minPhi: z.number() }),
  /**
   * Run guard against current event.
   * @param ctx - Cordis context providing iitGuards
   * @param config - guard config
   * @param ev - event with tpm + state
   * @returns GuardResult pass/block
   */
  async run(
    ctx: Context,
    config: { minPhi: number },
    ev: { tpm: unknown; state: number },
  ): Promise<GuardResult> {
    const iitGuards = (ctx as unknown as { get: (k: string) => { calculatePhi?: (tpm: unknown, state: number) => Promise<{ phi: number; cesHash?: string }> } }).get('iitGuards')
    if (!iitGuards?.calculatePhi) return { disposition: 'pass' }
    const res = await iitGuards.calculatePhi(ev.tpm, ev.state)
    const phi = (res as { phi: number }).phi
    if (typeof phi === 'number' && phi < config.minPhi) {
      return { disposition: 'block', phi, reason: `phi ${phi} < minPhi ${config.minPhi}` }
    }
    return { disposition: 'pass', phi, cesHash: (res as { cesHash?: string }).cesHash }
  },
}
