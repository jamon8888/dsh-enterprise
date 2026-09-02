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
    severity: z.enum(['error', 'warn']).default('error'),
  }),
  async run(
    ctx: Context,
    config: { window: number; maxDrop: number; maxSlope: number; severity: 'error' | 'warn' },
    ev: { tpm?: unknown; state?: number; sessionId?: string; phi?: number },
  ): Promise<GuardResult> {
    const iitGuards = (ctx as unknown as { 
      get: (k: string) => { 
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
    }).get('iitGuards')
    
    if (!iitGuards?.phi_trajectory_wasm) return { disposition: 'pass' }
    
    const sessionId = ev.sessionId ?? 'default'
    const phi = ev.phi ?? (await iitGuards.calculatePhi?.(ev.tpm, ev.state ?? 0))?.phi
    
    if (typeof phi !== 'number') return { disposition: 'pass' }
    
    // Update rolling history
    const history = phiHistory.get(sessionId) ?? []
    history.push(phi)
    if (history.length > config.window) history.shift()
    phiHistory.set(sessionId, history)
    
    if (history.length < 3) return { disposition: 'pass', phi }
    
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
        disposition, 
        phi: phi_current, 
        reason: `phi trajectory ${alert}: drift=${drift.toFixed(4)}, slope=${slope.toFixed(4)}, var=${variance.toFixed(4)}` 
      }
    }
    
    return { disposition: 'pass', phi: phi_current }
  },
}