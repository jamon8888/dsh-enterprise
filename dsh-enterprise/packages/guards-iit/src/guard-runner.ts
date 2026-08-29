/**
 * Cordis guard runner — registers iitGuards service + wraps waterfall.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guard-runner
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './config.js'
import { callIctBridge } from './bridge.js'
import { cesFingerprintGuard } from './guards/ces-fingerprint.js'
import { boundaryFrontierGuard } from './guards/boundary-frontier.js'
import { attractorEwsGuard } from './guards/attractor-ews.js'
import { catastropheCuspGuard } from './guards/catastrophe-cusp.js'
import { phiThresholdGuard } from './guards/phi-threshold.js'
import { recordPhi, recordEws, recordLatency } from './telemetry.js'

export const GUARDS = [phiThresholdGuard, cesFingerprintGuard, boundaryFrontierGuard, attractorEwsGuard, catastropheCuspGuard] as const

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
 * Follows `dsh/packages/AGENTS.md` function-plugin contract (named exports, no default).
 */
export function apply(ctx: Context, cfg: Config): void {
  // iitGuards service — pure decoration, disposer is no-op (WASM module is stateless per call)
  ctx.effect('iitGuards', () => ({
    calculatePhi: async (tpm: unknown, state: number) => {
      const t0 = performance.now()
      const mod = await import('@deepseek-ai/dsh-enterprise-iit-core/pkg') as {
        calculate_phi_js: (tpmJson: string, state: number, budget: string) => unknown
      }
      const result = mod.calculate_phi_js(JSON.stringify(tpm), state, 'exact') as { phi: number; cesHash?: string }
      const ms = performance.now() - t0
      if (typeof result.phi === 'number') {
        recordPhi(result.phi)
        recordLatency(ms, 'calculatePhi')
      }
      return result
    },
    runCusp: async (traj: unknown) => callIctBridge('/catastrophe/fit', { traj }),
  }))

  // Waterfall guard decoration — run all registered guards
  const tools: Record<string, unknown> = ctx.tools as unknown as Record<string, unknown>
  const orig = typeof tools.guard === 'function' ? (tools.guard as (ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>).bind(tools) : undefined

  const runGuards = async (ev: unknown): Promise<void> => {
    const e = ev as { tpm?: unknown; state?: number; phi?: number; minPhi?: number }
    // emit policy/evaluate before phi check so triad can intercept
    const phiEv: any = {
      phi: (e as any).phi,
      minPhi: cfg.minPhi,
      tpm: (e as any).tpm,
      state: (e as any).state,
      region: (e as any).region,
    };
    if (typeof (ctx as any).waterfall === 'function') {
      await (ctx as any).waterfall('policy/evaluate', phiEv, async (x: unknown) => x);
    }
    // also register ctx.on hook path for audit mirror
    // phi threshold check via policy/evaluate already done above; still run guard for completeness
    if (e?.tpm === undefined || e?.state === undefined) {
      // if no tpm but phi already evaluated via policy/evaluate, still check phi < minPhi
      if (typeof phiEv.phi === 'number' && phiEv.phi < cfg.minPhi) {
        throw new GuardError(`phi ${phiEv.phi} < minPhi ${cfg.minPhi}`);
      }
      return;
    }
    for (const guard of GUARDS) {
      const config = guard.Config.shape ? guard.Config.parse({}) : {}
      const mergedConfig = { ...config, minPhi: cfg.minPhi }
      const t0 = performance.now()
      const result = (await guard.run(ctx, mergedConfig, e as any)) as import('./types.js').GuardResult
      const ms = performance.now() - t0
      recordLatency(ms, guard.id)
      if (guard.id === 'attractor-ews') {
        const r = result as { variance?: number; ac1?: number }
        if (typeof r.variance === 'number' && typeof r.ac1 === 'number') {
          recordEws(r.variance, r.ac1)
        }
      }
      if (result.disposition === 'block') {
        throw new GuardError((result as import('./types.js').GuardResult).reason ?? `Guard ${guard.id} blocked`)
      }
    }
  }

  // ctx.on hook to emit policy/evaluate before phi check (for direct callers)
  ctx.on('policy/evaluate', async (ev: any, next: any) => {
    if (typeof ev.phi === 'number' && typeof ev.minPhi === 'number' && ev.phi < ev.minPhi) {
      throw new GuardError(`phi ${ev.phi} < minPhi ${ev.minPhi}`);
    }
    return next(ev);
  });

  if (orig) {
    tools.guard = async (ev: unknown, next: (ev: unknown) => Promise<unknown>) => {
      await runGuards(ev)
      return next(ev)
    }
  } else {
    // Cordis waterfall fallback — host without tools.guard seam
    ctx.on('tools/guard', async (ev: unknown, next: (ev: unknown) => Promise<unknown>) => {
      await runGuards(ev)
      return next(ev as never)
    })
  }
}
