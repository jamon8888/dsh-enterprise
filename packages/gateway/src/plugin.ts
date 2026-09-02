/**
 * Gateway Cordis plugin — decorates ctx.llm.generate with budget + envelope.
 * Never edits llm/ source; wraps via ctx.effect.
 * @module @deepseek-ai/dsh-enterprise-gateway/plugin
 */

import { applicableBudgets, hardBudgetBlock, reserveHardBudgets } from './budgets.js'
import { captureEnvelope } from './envelope-store.js'
import type { BudgetKey } from './types.js'

export const name = 'dsh-enterprise:gateway'
export const inject = ['credentials', 'audit'] as const

export function apply(ctx: any, _cfg?: unknown) {
  ctx.effect('gateway', () => ({
    applicableBudgets,
    hardBudgetBlock,
    reserveHardBudgets,
    captureEnvelope,
  }))
  const orig = ctx.llm?.generate?.bind(ctx.llm)
  if (orig) {
    ctx.llm.generate = async (req: any) => {
      const key: BudgetKey = {
        orgId: req?.orgId ?? req?.auth?.orgId ?? 'anonymous',
        projectId: req?.projectId ?? req?.auth?.projectId,
      }
      const states = await applicableBudgets(key, new Date())
      const block = hardBudgetBlock(states)
      if (block) throw new Error(`budget ${block.def.id} exceeded`)
      await reserveHardBudgets(states, key, 100)
      await captureEnvelope(req, null)
      const res = await orig(req)
      await captureEnvelope(req, res)
      return res
    }
  }
}
