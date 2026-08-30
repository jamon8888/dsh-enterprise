/**
 * catastrophe-cusp guard — warns at `distance < bifurcationMargin` (default 0.2),
 * blocks when `distance < 0` (inside cusp). Uses Rust `catastrophe.rs` WASM
 * `CuspFit.from_trajectory` when available; falls back to pure JS `cuspFitJs`.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guards/catastrophe-cusp
 */

import z from '@deepseek-ai/schemastery'
import { GuardError } from '../guard-runner.js'

export const catastropheCuspGuard = {
  id: 'catastrophe-cusp' as const,
  Config: z.object({ bifurcationMargin: z.number().default(0.2) }),
  async run(
    ctx: unknown,
    cfg: { bifurcationMargin: number },
    event: { trajectory: number[] },
  ): Promise<{ disposition: 'pass' | 'warn' | 'block'; distanceToBifurcation?: number; hysteresis?: boolean }> {
    let distance: number | undefined
    let hysteresis: boolean | undefined

    try {
      const mod = await import('@deepseek-ai/dsh-enterprise-iit-core/pkg') as {
        CuspFit?: { from_trajectory: (traj: number[]) => { distance_to_bifurcation: number; hysteresis: boolean; alpha?: number; beta?: number } }
      }
      if (mod.CuspFit?.from_trajectory) {
        const fit = mod.CuspFit.from_trajectory(event.trajectory)
        distance = (fit as { distance_to_bifurcation?: number; distanceToBifurcation?: number }).distance_to_bifurcation
          ?? (fit as { distanceToBifurcation?: number }).distanceToBifurcation
        hysteresis = (fit as { hysteresis?: boolean }).hysteresis
      }
    } catch {
      // WASM not available — fall through to pure JS
    }

    if (distance === undefined) {
      const fit = cuspFitJs(event.trajectory)
      distance = fit.distance_to_bifurcation
      hysteresis = fit.hysteresis
    }

    if (typeof distance === 'number') {
      if (distance < 0) {
        throw new GuardError(`catastrophe bifurcation crossed: distance ${distance} < 0`)
      }
      if (distance < cfg.bifurcationMargin) {
        const payload = { distanceToBifurcation: distance, hysteresis }
        const maybeAudit = ctx as { audit?: { emit?: (ev: string, data: unknown) => void }; get?: (k: string) => { emit?: (ev: string, data: unknown) => void } }
        const emit = maybeAudit.audit?.emit ?? maybeAudit.get?.('audit')?.emit
        if (typeof emit === 'function') {
          try { emit.call(maybeAudit.audit ?? maybeAudit.get?.('audit'), 'iit/cusp', payload) } catch { /* ignore */ }
        } else if (typeof (maybeAudit as { emit?: (ev: string, data: unknown) => void }).emit === 'function') {
          try { (maybeAudit as { emit: (ev: string, data: unknown) => void }).emit('iit/cusp', payload) } catch { /* ignore */ }
        }
        return { disposition: 'warn', distanceToBifurcation: distance, hysteresis }
      }
    }

    return { disposition: 'pass', distanceToBifurcation: distance, hysteresis }
  },
}

function cuspFitJs(traj: number[]): { distance_to_bifurcation: number; hysteresis: boolean } {
  if (!traj || traj.length === 0) return { distance_to_bifurcation: 0, hysteresis: false }
  const xs = traj.filter((v) => Number.isFinite(v))
  if (xs.length === 0) return { distance_to_bifurcation: 0, hysteresis: false }
  const n = xs.length
  let sumX = 0
  let sumX2 = 0
  let sumX3 = 0
  let sumX4 = 0
  for (const x of xs) {
    const x2 = x * x
    sumX += x
    sumX2 += x2
    sumX3 += x2 * x
    sumX4 += x2 * x2
  }
  const det = n * sumX2 - sumX * sumX
  let alpha: number
  let beta: number
  if (Math.abs(det) < 1e-12 || !Number.isFinite(det)) {
    alpha = -sumX2 / n
    beta = -sumX3 / n
  } else {
    const c0 = (n * sumX4 - sumX * sumX3) / det
    const c1 = (sumX2 * sumX3 - sumX * sumX4) / det
    const a = -c0
    const b = -c1
    if (Number.isFinite(a) && Number.isFinite(b)) {
      alpha = a
      beta = b
    } else {
      alpha = -sumX2 / n
      beta = -sumX3 / n
    }
  }
  const distance_to_bifurcation = 4 * alpha ** 3 + 27 * beta ** 2
  let hysteresis = false
  if (distance_to_bifurcation < 0) {
    const min = Math.min(...xs)
    const max = Math.max(...xs)
    const range = max - min
    const mean = sumX / n
    const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n
    const std = Math.sqrt(variance)
    if (Number.isFinite(std) && std > 1e-12 && Number.isFinite(range)) hysteresis = range > 0.5 * std
  }
  return { distance_to_bifurcation, hysteresis }
}
