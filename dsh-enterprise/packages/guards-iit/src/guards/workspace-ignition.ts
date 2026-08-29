/**
 * workspace-ignition guard — blocks when GWT ignition fires.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/guards/workspace-ignition
 */

import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type { GuardResult } from '../types.js'

export const workspaceIgnitionGuard = {
  id: 'workspace-ignition' as const,
  Config: z.object({
    threshold: z.number().default(1.0),
    broadcastVar: z.string().default('broadcast'),
    fanOutVar: z.string().default('fan_out'),
  }),
  async run(
    ctx: Context,
    config: { threshold?: number; broadcastVar?: string; fanOutVar?: string; workspaceIgnition?: { threshold?: number; broadcastVar?: string; fanOutVar?: string } },
    ev: Record<string, unknown>,
  ): Promise<GuardResult> {
    const threshold = config.workspaceIgnition?.threshold ?? config.threshold ?? 1.0
    const broadcastVar = config.workspaceIgnition?.broadcastVar ?? config.broadcastVar ?? 'broadcast'
    const fanOutVar = config.workspaceIgnition?.fanOutVar ?? config.fanOutVar ?? 'fan_out'
    const iitGuards = (ctx as unknown as {
      get: (k: string) => {
        ignition_score_wasm?: (broadcast: string, fanOut: number, threshold: number) => Promise<{ score: number; ignited: boolean }>
      }
    }).get('iitGuards')

    if (!iitGuards?.ignition_score_wasm) return { disposition: 'pass' }

    const broadcast = ev[broadcastVar]
    const fanOut = ev[fanOutVar]
    if (!Array.isArray(broadcast) || typeof fanOut !== 'number') {
      return { disposition: 'pass' }
    }

    const res = await iitGuards.ignition_score_wasm(
      JSON.stringify(broadcast),
      fanOut,
      threshold,
    )
    const { score, ignited } = res as { score: number; ignited: boolean }

    if (ignited) {
      return {
        disposition: 'block',
        phi: score,
        reason: `workspace ignition: score ${score} > threshold ${threshold}`,
      }
    }
    return { disposition: 'pass', phi: score }
  },
}
