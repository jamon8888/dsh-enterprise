/**
 * Cordis guard runner — registers iitGuards service + wraps waterfall.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guard-runner
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './config.js'
import { callIctBridge } from './bridge.js'
import { emitGuardDecision } from './session-events.js'
import { cesFingerprintGuard } from './guards/ces-fingerprint.js'
import { boundaryFrontierGuard } from './guards/boundary-frontier.js'
import { attractorEwsGuard } from './guards/attractor-ews.js'
import { catastropheCuspGuard } from './guards/catastrophe-cusp.js'
import { phiThresholdGuard } from './guards/phi-threshold.js'
import { workspaceIgnitionGuard } from './guards/workspace-ignition.js'
import { phiTrajectoryGuard } from './guards/phi-trajectory.js'
import { effectEthosGuard } from './guards/effect-ethos.js'

export const GUARDS = [
  phiThresholdGuard,
  phiTrajectoryGuard,
  workspaceIgnitionGuard,
  cesFingerprintGuard,
  boundaryFrontierGuard,
  attractorEwsGuard,
  catastropheCuspGuard,
  effectEthosGuard,
] as const

/** Guards that require a TPM + state to evaluate; skipped for action-only events. */
const TPM_DEPENDENT = new Set([
  'phi-threshold',
  'phi-trajectory',
  'ces-fingerprint',
  'boundary-frontier',
  'attractor-ews',
  'catastrophe-cusp',
])

export const name = 'dsh-enterprise:guards-iit'
export const inject = ['tools', 'sessions', 'audit', 'chains'] as const

export class GuardError extends Error {
  constructor(message: string, public code = 'GUARD_BLOCKED') {
    super(message)
    this.name = 'GuardError'
  }
}

/**
 * Plugin apply — registers `iitGuards` effect and decorates `ctx.tools.guard` waterfall.
 */
export function apply(ctx: Context, cfg: Config): void {
  ctx.effect('iitGuards', () => ({
    calculatePhi: async (tpm: unknown, state: number) => {
      const mod = await import('@deepseek-ai/dsh-enterprise-iit-core/pkg') as {
        calculate_phi_js: (tpmJson: string, state: number, budget: string) => unknown
      }
      return mod.calculate_phi_js(JSON.stringify(tpm), state, 'exact') as { phi: number; cesHash?: string }
    },
    runCusp: async (traj: unknown) => callIctBridge('/catastrophe/fit', { traj }),
  }))

  const tools: Record<string, unknown> = ctx.tools as unknown as Record<string, unknown>
  const orig = typeof tools.guard === 'function'
    ? (tools.guard as (ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>).bind(tools)
    : undefined

  const runGuards = async (ev: unknown): Promise<void> => {
    const e = ev as { tpm?: unknown; state?: number; phi?: number }
    const phiEv: any = {
      phi: (e as any).phi,
      minPhi: cfg.minPhi,
      tpm: (e as any).tpm,
      state: (e as any).state,
      region: (e as any).region,
    }
    if (typeof (ctx as any).waterfall === 'function') {
      await (ctx as any).waterfall('policy/evaluate', phiEv, async (x: unknown) => x)
    }
    // phi policy check fires even when no TPM (phi may come pre-evaluated)
    if (typeof phiEv.phi === 'number' && phiEv.phi < cfg.minPhi) {
      emitGuardDecision(ctx, 'phi-threshold', {
        disposition: 'block',
        phi: phiEv.phi,
        reason: `phi ${phiEv.phi} < minPhi ${cfg.minPhi}`,
      })
      throw new GuardError(`phi ${phiEv.phi} < minPhi ${cfg.minPhi}`)
    }
    const hasTpm = e?.tpm !== undefined && e?.state !== undefined
    for (const guard of GUARDS) {
      if (!hasTpm && TPM_DEPENDENT.has(guard.id)) continue
      const result = (await guard.run(ctx, cfg as any, e as any)) as import('./types.js').GuardResult
      if (result.disposition === 'block') {
        emitGuardDecision(ctx, guard.id, result)
        throw new GuardError((result as import('./types.js').GuardResult).reason ?? `Guard ${guard.id} blocked`)
      }
      emitGuardDecision(ctx, guard.id, result)
    }
  }

  // ctx.on hook to emit policy/evaluate before phi check (for direct callers)
  ctx.on('policy/evaluate', async (ev: any, next: any) => {
    if (typeof ev.phi === 'number' && typeof ev.minPhi === 'number' && ev.phi < ev.minPhi) {
      emitGuardDecision(ctx, 'phi-threshold', {
        disposition: 'block',
        phi: ev.phi,
        reason: `phi ${ev.phi} < minPhi ${ev.minPhi}`,
      })
      throw new GuardError(`phi ${ev.phi} < minPhi ${ev.minPhi}`)
    }
    return next(ev)
  })

  if (orig) {
    tools.guard = async (ev: unknown, next: (ev: unknown) => Promise<unknown>) => {
      await runGuards(ev)
      return next(ev)
    }
  } else {
    ctx.on('tools/guard', async (ev: unknown, next: (ev: unknown) => Promise<unknown>) => {
      await runGuards(ev)
      return next(ev as never)
    })
  }
}
