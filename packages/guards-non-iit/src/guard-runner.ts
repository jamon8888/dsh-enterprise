/**
 * Cordis guard runner for non-IIT guards — runs BEFORE IIT guards in waterfall.
 * @module @deepseek-ai/dsh-enterprise-guards-non-iit/guard-runner
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './config.js'
import { hhhHarmlessGuard, hhhHelpfulGuard, hhhHonestGuard } from './guards/hhh.js'
import { policyAllowedGuard } from './guards/policy.js'
import { rateLimitGuard, budgetExhaustedGuard } from './guards/rate-limit.js'
import { createProvider } from './providers/index.js'
import type { EvaluationProvider } from './providers/index.js'

export const GUARDS = [
  hhhHarmlessGuard,
  hhhHelpfulGuard,
  hhhHonestGuard,
  policyAllowedGuard,
] as const

export const name = 'dsh-enterprise:guards-non-iit'
export const inject = ['tools', 'sessions', 'audit'] as const

export class NonIitGuardError extends Error {
  constructor(message: string, public code = 'NON_IIT_GUARD_BLOCKED') {
    super(message)
    this.name = 'NonIitGuardError'
  }
}

function getGuardConfig(guardId: string, cfg: Config): Record<string, unknown> {
  switch (guardId) {
    case 'hhh-harmless':
      return { blockThreshold: cfg.hhh.harmlessBlockThreshold, warnThreshold: cfg.hhh.harmlessWarnThreshold }
    case 'hhh-helpful':
      return { minScore: cfg.hhh.minHelpfulScore }
    case 'hhh-honest':
      return { minScore: cfg.hhh.minHonestScore }
    case 'policy-allowed':
      return { rules: cfg.policy.rules }
    case 'rate-limit':
      return { maxRequestsPerMinute: cfg.rateLimit.maxRequestsPerMinute, maxTokensPerMinute: cfg.rateLimit.maxTokensPerMinute }
    case 'budget-exhausted':
      return { maxSpendPerSession: cfg.budget.maxSpendPerSession, maxTokensPerSession: cfg.budget.maxTokensPerSession }
    default:
      return {}
  }
}

export function apply(ctx: Context, cfg: Config): void {
  const provider: EvaluationProvider = createProvider(cfg.provider)

  ctx.effect('nonIitGuards', () => ({
    evaluate: async (prompt: string, context?: Record<string, unknown>) => {
      return provider.evaluate(prompt, context)
    },
    provider: provider.name(),
  }))

  const tools: Record<string, unknown> = (ctx as any).tools as unknown as Record<string, unknown>
  const orig = typeof tools.guard === 'function'
    ? (tools.guard as (ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>).bind(tools)
    : undefined

  const runGuards = async (ev: unknown): Promise<void> => {
    const e = ev as {
      sessionId?: string
      turn?: number
      step?: number
      callId?: string
      recentOutputs?: string[]
      recentActions?: string[]
      toolName?: string
      requestPath?: string
      tokenUsage?: { prompt: number; completion: number; total: number }
      costUsd?: number
    }

    const guardDecisions: { guardId: string; disposition: string; reason?: string }[] = []

    if (e.sessionId) {
      const rateLimitResult = rateLimitGuard.evaluate(
        e.sessionId,
        { maxRequestsPerMinute: cfg.rateLimit.maxRequestsPerMinute, maxTokensPerMinute: cfg.rateLimit.maxTokensPerMinute },
        e.tokenUsage?.total,
      )
      if (rateLimitResult.disposition === 'block') {
        throw new NonIitGuardError(rateLimitResult.reason ?? 'Rate limit exceeded')
      }
      guardDecisions.push({ guardId: 'rate-limit', disposition: rateLimitResult.disposition, reason: rateLimitResult.reason })
    }

    if (e.sessionId) {
      const budgetResult = budgetExhaustedGuard.evaluate(
        e.sessionId,
        { maxSpendPerSession: cfg.budget.maxSpendPerSession, maxTokensPerSession: cfg.budget.maxTokensPerSession },
        e.costUsd,
        e.tokenUsage?.total,
      )
      if (budgetResult.disposition === 'block') {
        throw new NonIitGuardError(budgetResult.reason ?? 'Budget exhausted')
      }
      guardDecisions.push({ guardId: 'budget-exhausted', disposition: budgetResult.disposition, reason: budgetResult.reason })
    }

    for (const guard of GUARDS) {
      const guardCfg = getGuardConfig(guard.id, cfg)
      const context = {
        recentOutputs: e.recentOutputs,
        recentActions: e.recentActions,
        toolName: e.toolName,
        requestPath: e.requestPath,
        prompt: (ev as { prompt?: string }).prompt,
      }

      let result: { disposition: string; score?: number; reason?: string; violated?: string[] }

      if (guard.id === 'policy-allowed') {
        result = await guard.run(guardCfg as any, context) as typeof result
      } else if (guard.id.startsWith('hhh-')) {
        result = await guard.run(provider, guardCfg as any, context) as typeof result
      } else {
        continue
      }

      guardDecisions.push({ guardId: guard.id, disposition: result.disposition, reason: result.reason })

      if (result.disposition === 'block') {
        try {
          ;((ctx as any).emit as (event: string, payload: unknown) => void)('policy/evaluate', {
            turn: e.turn ?? 0,
            step: e.step ?? 0,
            callId: e.callId ?? '',
            guards: guardDecisions,
            finalDisposition: 'block',
            blockedBy: guard.id,
            timestamp: Date.now(),
            ignorable: true,
          })
        } catch {}
        throw new NonIitGuardError(result.reason ?? `Guard ${guard.id} blocked`)
      }
    }

    try {
      ;((ctx as any).emit as (event: string, payload: unknown) => void)('policy/evaluate', {
        turn: e.turn ?? 0,
        step: e.step ?? 0,
        callId: e.callId ?? '',
        guards: guardDecisions,
        finalDisposition: 'pass',
        timestamp: Date.now(),
        ignorable: true,
      })
    } catch {}
  }

  if (orig) {
    tools.guard = async (ev: unknown, next: (ev: unknown) => Promise<unknown>) => {
      await runGuards(ev)
      return next(ev)
    }
  } else {
    (ctx.on as any)('tools/guard', async (ev: unknown, next: (ev: unknown) => Promise<unknown>) => {
      await runGuards(ev)
      return next(ev as never)
    })
  }
}
