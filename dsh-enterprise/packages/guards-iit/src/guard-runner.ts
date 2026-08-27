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
      const mod = await import('@deepseek-ai/dsh-enterprise-iit-core/pkg') as {
        calculate_phi_js: (tpmJson: string, state: number, budget: string) => unknown
      }
      return mod.calculate_phi_js(JSON.stringify(tpm), state, 'exact') as { phi: number; cesHash?: string }
    },
    runCusp: async (traj: unknown) => callIctBridge('/catastrophe/fit', { traj }),
  }))

  // Waterfall guard decoration — run all registered guards
  const tools: Record<string, unknown> = ctx.tools as unknown as Record<string, unknown>
  const orig = typeof tools.guard === 'function' ? (tools.guard as (ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>).bind(tools) : undefined

  const runGuards = async (ev: unknown): Promise<void> => {
    const e = ev as { tpm?: unknown; state?: number }
    if (e?.tpm === undefined || e?.state === undefined) return
    for (const guard of GUARDS) {
      const config = guard.Config.shape ? guard.Config.parse({}) : {}
      // Merge with enterprise config
      const mergedConfig = { ...config, minPhi: cfg.minPhi }
      const result = await guard.run(ctx, mergedConfig, e)
      if (result.disposition === 'block') {
        throw new GuardError(result.reason ?? `Guard ${guard.id} blocked`)
      }
    }
  }

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
