/**
 * effect-ethos guard — evaluates Teloids (deontic norms) against proposed actions.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guards/effect-ethos
 */

import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type { GuardResult } from '../types.js'

export const effectEthosGuard = {
  id: 'effect-ethos' as const,
  Config: z.object({
    teloidsYaml: z.string().default(''),
    severity: z.enum(['error', 'warn']).default('warn'),
  }),
  async run(
    ctx: Context,
    config: { teloidsYaml?: string; severity?: 'error' | 'warn'; effectEthos?: { teloidsYaml?: string; severity?: 'error' | 'warn' } },
    ev: { action?: string; tool?: string; args?: Record<string, unknown>; principal?: string; resource?: string },
  ): Promise<GuardResult> {
    const teloidsYaml = config.effectEthos?.teloidsYaml ?? config.teloidsYaml ?? ''
    const severity = config.effectEthos?.severity ?? config.severity ?? 'warn'
    if (!teloidsYaml?.trim()) return { disposition: 'pass' }

    const iitGuards = (ctx as unknown as {
      get: (k: string) => {
        teloids_compile_wasm?: (yaml: string) => Promise<{ teloids: unknown[] }>
        teloids_evaluate_wasm?: (compiledJson: string, actionJson: string) => Promise<{
          disposition: 'allow' | 'deny' | 'oblige'
          violated: string[]
          reason: string
        }>
      }
    }).get('iitGuards')
    if (!iitGuards?.teloids_compile_wasm || !iitGuards?.teloids_evaluate_wasm) {
      return { disposition: 'pass' }
    }

    const action = {
      tool: ev.tool ?? ev.action,
      args: ev.args ?? {},
      principal: ev.principal,
      resource: ev.resource,
    }

    const compiled = await iitGuards.teloids_compile_wasm(teloidsYaml)
    const { teloids } = compiled as { teloids: unknown[] }

    const res = await iitGuards.teloids_evaluate_wasm(
      JSON.stringify({ teloids, default_severity: severity }),
      JSON.stringify(action),
    )
    const { disposition, reason } = res as {
      disposition: 'allow' | 'deny' | 'oblige'
      violated: string[]
      reason: string
    }

    if (disposition === 'deny') {
      return { disposition: 'block', reason: `effect-ethos: ${reason}`, phi: 0 }
    }
    if (disposition === 'oblige' && severity === 'error') {
      return { disposition: 'warn', reason: `effect-ethos oblige: ${reason}`, phi: 0 }
    }

    return { disposition: 'pass', phi: 0 }
  },
}
