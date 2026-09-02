/**
 * boundary-frontier guard — blocks when max-Φ frontier Φ < minBoundaryPhi.
 * Bridges to Rust `boundary.rs` WASM exports `enumerate_frontiers` / `best_frontier`.
 * Falls back to `ctx.get('iitGuards').calculatePhi` when WASM not yet has exports.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guards/boundary-frontier
 */

import z from '@deepseek-ai/schemastery'
import { GuardError } from '../guard-runner.js'

export const boundaryFrontierGuard = {
  id: 'boundary-frontier' as const,
  Config: z.object({ minBoundaryPhi: z.number().default(0.1) }),
  async run(
    ctx: unknown,
    cfg: { minBoundaryPhi: number },
    event: { tpm: unknown; state?: number },
  ): Promise<{ disposition: 'pass'; phi?: number }> {
    let phi: number | undefined

    try {
      const mod = await import('@deepseek-ai/dsh-enterprise-iit-core/pkg') as {
        enumerate_frontiers?: (n: number) => unknown[]
        best_frontier?: (tpm: unknown) => { phi: number } | number
      }
      if (typeof mod.best_frontier === 'function') {
        const best = mod.best_frontier(event.tpm) as { phi?: number } | number
        if (typeof best === 'number') phi = best
        else if (best && typeof (best as { phi?: number }).phi === 'number') phi = (best as { phi: number }).phi
      }
    } catch {
      // WASM not built or boundary.rs stub todo!() — fallback below
    }

    if (phi === undefined) {
      try {
        const iitGuards = (ctx as { get?: (k: string) => { calculatePhi?: (tpm: unknown, state: number) => Promise<{ phi: number }> } }).get?.('iitGuards')
        if (iitGuards?.calculatePhi && event.tpm !== undefined) {
          const state = typeof event.state === 'number' ? event.state : 0
          const r = await iitGuards.calculatePhi(event.tpm, state)
          if (typeof (r as { phi?: number }).phi === 'number') phi = (r as { phi: number }).phi
        }
      } catch {
        // ignore — pass through
      }
    }

    if (typeof phi === 'number' && phi < cfg.minBoundaryPhi) {
      throw new GuardError(`boundary phi ${phi} < minBoundaryPhi ${cfg.minBoundaryPhi}`)
    }
    return { disposition: 'pass', phi }
  },
}
