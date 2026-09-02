/**
 * Gateway budget types — enterprise reimplementation of facility/services/gateway/src/types.ts BudgetState.
 * Upstream BudgetState has {scope, period:'daily'|'weekly'|'monthly', mode:'soft'|'hard'} + org/project/agentDef.
 * This package scopes to org|project + hour|day|month for enterprise billing.
 * @module @deepseek-ai/dsh-enterprise-gateway/types
 */

export type BudgetDef = {
  id: string
  scope: 'org' | 'project'
  projectId?: string
  orgId: string
  enabled: boolean
  period: 'hour' | 'day' | 'month'
  limitCents: number
}

export type BudgetState = {
  def: BudgetDef
  windowStart: string
  spentCents: number
  remaining: number
}

export type BudgetReservation = {
  budgetId: string
  windowStart: string
  estimatedCents: number
}

export type SpendCounter = {
  budgetId: string
  windowStart: string
  spentCents: number
}

/** Key used to resolve applicable budgets (mirrors AuthedKey subset). */
export type BudgetKey = {
  orgId: string
  projectId?: string
}
