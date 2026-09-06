/**
 * phi-trajectory guard — blocks on Φ drift/slope anomalies.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guards/phi-trajectory
 */

import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type { GuardResult } from '../types.js'

// In-memory rolling window (per session). Keyed by sessionId.
const phiHistory = new Map<string, number[]>()

export const phiTrajectoryGuard = {
  id: 'phi-trajectory' as const,
  Config: z.object({
    window: z.number().default(10),
    maxDrop: z.number().default(0.15),
    maxSlope: z.number().default(-0.02),
    severity: z.union(['error', 'warn']).default('error'),
  }),
  async run(
    ctx: Context,
    config: {
      window: number
      maxDrop: number
      maxSlope: number
      severity: 'error' | 'warn'
      viabilityWarn?: number
      viabilityBlock?: number
    },
    ev: { tpm?: unknown; state?: number; sessionId?: string; phi?: number },
  ): Promise<GuardResult> {
    const iitGuards = (ctx as unknown as {
      get?: (k: string) => {
        phi_trajectory_wasm?: (historyJson: string, configJson: string) => Promise<{
          phi_current: number
          phi_mean: number
          drift: number
          slope: number
          variance: number
          alert: 'none' | 'drift-warning' | 'slope-warning' | 'critical'
        }>
        calculatePhi?: (tpm: unknown, state: number) => Promise<{ phi: number }>
      }
    })?.get?.('iitGuards')

    const sessionId = ev.sessionId ?? 'default'
    const phi = ev.phi ?? (await iitGuards?.calculatePhi?.(ev.tpm, ev.state ?? 0))?.phi

    if (typeof phi !== 'number') return { disposition: 'pass' }

    // Update rolling history
    const history = phiHistory.get(sessionId) ?? []
    history.push(phi)
    if (history.length > config.window) history.shift()
    phiHistory.set(sessionId, history)

    // RiskGate viability index from the rolling window (predictive signal).
    const warnAt = config.viabilityWarn ?? -0.5
    const blockAt = config.viabilityBlock ?? -0.8
    const viability = viabilityIndex(history, config.maxDrop, config.maxSlope)
    const viabilityFields =
      viability === undefined
        ? {}
        : {
            viabilityIndex: viability,
            trajectoryStable: viability > -0.5,
          }

    // Warmup gate: need 3 samples before any evaluation (unchanged contract).
    if (history.length < 3) return { disposition: 'pass', phi, ...viabilityFields }

    if (!iitGuards?.phi_trajectory_wasm) {
      return {
        disposition: viabilityDisposition(viability!, warnAt, blockAt),
        phi,
        reason: `phi viability: vi=${viability!.toFixed(3)}`,
        ...viabilityFields,
      }
    }
    
    const cfgJson = JSON.stringify({
      window: config.window,
      max_drop: config.maxDrop,
      max_slope: config.maxSlope,
    })
    
    const res = await iitGuards.phi_trajectory_wasm(JSON.stringify(history), cfgJson)
    const { drift, slope, variance, alert, phi_current, phi_mean } = res as {
      phi_current: number
      phi_mean: number
      drift: number
      slope: number
      variance: number
      alert: 'none' | 'drift-warning' | 'slope-warning' | 'critical'
    }
    
    if (alert !== 'none') {
      const disposition = config.severity === 'error' ? 'block' : 'warn'
      return {
        disposition: escalateDisposition(
          disposition,
          viabilityDisposition(viability!, warnAt, blockAt),
        ),
        phi: phi_current,
        reason: `phi trajectory ${alert}: drift=${drift.toFixed(4)}, slope=${slope.toFixed(4)}, var=${variance.toFixed(4)} (vi=${viability!.toFixed(3)})`,
        ...viabilityFields,
      }
    }

    return {
      disposition: viabilityDisposition(viability!, warnAt, blockAt),
      phi: phi_current,
      ...(viabilityDisposition(viability!, warnAt, blockAt) === 'pass'
        ? {}
        : { reason: `phi viability: vi=${viability!.toFixed(3)}` }),
      ...viabilityFields,
    }
  },
}

/**
 * RiskGate VI(t): bounded predictive viability from a rolling Φ window.
 * 1 - (peak-to-last drop / maxDrop) - (|least-squares slope| / |maxSlope|),
 * clamped to [-1, +1]. Undefined with fewer than 2 samples.
 */
export function viabilityIndex(history: number[], maxDrop: number, maxSlope: number): number | undefined {
  if (history.length < 2) return undefined
  const last = history[history.length - 1]!
  const peak = Math.max(...history)
  const dropRatio = maxDrop > 0 ? Math.max(0, peak - last) / maxDrop : 0
  const n = history.length
  const meanX = (n - 1) / 2
  const meanY = history.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (history[i]! - meanY)
    den += (i - meanX) * (i - meanX)
  }
  const slope = den > 0 ? num / den : 0
  const slopeRatio = maxSlope !== 0 ? Math.abs(slope) / Math.abs(maxSlope) : 0
  return Math.max(-1, Math.min(1, 1 - dropRatio - slopeRatio))
}

/** Map a viability value to a disposition (warn zone / block zone). */
export function viabilityDisposition(
  viability: number,
  warnAt = -0.5,
  blockAt = -0.8,
): 'pass' | 'warn' | 'block' {
  if (viability < blockAt) return 'block'
  if (viability < warnAt) return 'warn'
  return 'pass'
}

/** Escalate only: VI never downgrades a wasm block/warn. */
function escalateDisposition(
  base: 'pass' | 'warn' | 'block',
  vi: 'pass' | 'warn' | 'block',
): 'pass' | 'warn' | 'block' {
  const rank = { pass: 0, warn: 1, block: 2 } as const
  return rank[vi] > rank[base] ? vi : base
}