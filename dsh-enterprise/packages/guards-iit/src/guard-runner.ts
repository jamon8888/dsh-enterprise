/**
 * Cordis guard runner — registers iitGuards service + wraps waterfall.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guard-runner
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './config.js'
import { callIctBridge } from './bridge.js'
import { emitGuardDecision } from './session-events.js'
import { CesCache } from './cache.js'
import { recordPhi, recordLatency, recordEws } from './telemetry.js'

const cesCache = new CesCache()
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
      const cached = cesCache.get(tpm, state)
      if (cached) return { phi: cached.phi ?? 0, cesHash: cached.cesHash }
      const t0 = performance.now()
      const mod = await import('@deepseek-ai/dsh-enterprise-iit-core/pkg') as {
        calculate_phi_js: (tpmJson: string, state: number, budget: string) => unknown
      }
      const result = mod.calculate_phi_js(JSON.stringify(tpm), state, 'exact') as { phi: number; cesHash?: string }
      const ms = performance.now() - t0
      recordPhi(result.phi)
      recordLatency(ms, 'calculatePhi')
      cesCache.set(tpm, state, { disposition: 'pass', phi: result.phi, cesHash: result.cesHash })
      return result
    },
    phi_trajectory_wasm: async (phiHistoryJson: string, configJson: string) => {
      const mod = await import('@deepseek-ai/dsh-enterprise-iit-core/pkg') as unknown as {
        phi_trajectory_wasm: (phiHistoryJson: string, configJson: string) => unknown
      }
      return mod.phi_trajectory_wasm(phiHistoryJson, configJson)
    },
    ignition_score_wasm: async (broadcastJson: string, fanOut: number, threshold: number) => {
      const mod = await import('@deepseek-ai/dsh-enterprise-iit-core/pkg') as unknown as {
        ignition_score_wasm: (broadcastJson: string, fanOut: number, threshold: number) => unknown
      }
      return mod.ignition_score_wasm(broadcastJson, fanOut, threshold)
    },
    teloids_compile_wasm: async (yaml: string) => {
      const mod = await import('@deepseek-ai/dsh-enterprise-iit-core/pkg') as unknown as {
        teloids_compile_wasm: (yaml: string) => unknown
      }
      return mod.teloids_compile_wasm(yaml)
    },
    teloids_evaluate_wasm: async (compiledJson: string, actionJson: string) => {
      const mod = await import('@deepseek-ai/dsh-enterprise-iit-core/pkg') as unknown as {
        teloids_evaluate_wasm: (compiledJson: string, actionJson: string) => unknown
      }
      return mod.teloids_evaluate_wasm(compiledJson, actionJson)
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
    const guardDecisions: { guardId: string; disposition: string; phi?: number; reason?: string }[] = []
    for (const guard of GUARDS) {
      if (!hasTpm && TPM_DEPENDENT.has(guard.id)) continue
      const t0 = performance.now()
      const result = (await guard.run(ctx, cfg as any, e as any)) as import('./types.js').GuardResult
      const ms = performance.now() - t0
      recordLatency(ms, guard.id)
      guardDecisions.push({ guardId: guard.id, disposition: result.disposition, phi: result.phi, reason: result.reason })
      if (result.disposition === 'block') {
        emitGuardDecision(ctx, guard.id, result)
        try {
          ;(ctx.emit as (event: string, payload: unknown) => void)('policy/evaluate', {
            turn: (ev as { turn?: number }).turn ?? 0,
            step: (ev as { step?: number }).step ?? 0,
            callId: (ev as { callId?: string }).callId ?? '',
            guards: guardDecisions,
            finalDisposition: 'block',
            blockedBy: guard.id,
            timestamp: Date.now(),
            ignorable: true,
          })
        } catch {}
        throw new GuardError(result.reason ?? `Guard ${guard.id} blocked`)
      }
      emitGuardDecision(ctx, guard.id, result)
      if (guard.id === 'attractor-ews') {
        const ewsResult = result as unknown as { variance?: number; ac1?: number }
        if (ewsResult.variance !== undefined && ewsResult.ac1 !== undefined) {
          recordEws(ewsResult.variance, ewsResult.ac1)
        }
      }
    }
    try {
      ;(ctx.emit as (event: string, payload: unknown) => void)('policy/evaluate', {
        turn: (ev as { turn?: number }).turn ?? 0,
        step: (ev as { step?: number }).step ?? 0,
        callId: (ev as { callId?: string }).callId ?? '',
        guards: guardDecisions,
        finalDisposition: 'pass',
        timestamp: Date.now(),
        ignorable: true,
      })
    } catch {}
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
