/**
 * Rate limit and budget guards — resource quota enforcement.
 * @module @deepseek-ai/dsh-enterprise-guards-non-iit/guards/rate-limit
 */

import type { GuardResult } from '../types.js'

const rateLimitCounters = new Map<string, { count: number; resetAt: number }>()
const budgetCounters = new Map<string, { spent: number; tokens: number }>()

export const rateLimitGuard = {
  id: 'rate-limit' as const,
  severity: 'warn' as const,
  evaluate(
    sessionId: string,
    config: { maxRequestsPerMinute: number; maxTokensPerMinute: number },
    tokenCount = 0,
  ): GuardResult {
    const now = Date.now()
    const key = `rate:${sessionId}`
    let entry = rateLimitCounters.get(key)

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + 60000 }
      rateLimitCounters.set(key, entry)
    }

    entry.count++

    if (entry.count >= config.maxRequestsPerMinute) {
      return { disposition: 'block', reason: `Rate limit: ${entry.count} >= ${config.maxRequestsPerMinute}/min` }
    }

    if (tokenCount > config.maxTokensPerMinute) {
      return { disposition: 'block', reason: `Token rate limit: ${tokenCount} > ${config.maxTokensPerMinute}/min` }
    }

    return { disposition: 'pass' }
  },
}

export const budgetExhaustedGuard = {
  id: 'budget-exhausted' as const,
  severity: 'block' as const,
  evaluate(
    sessionId: string,
    config: { maxSpendPerSession: number; maxTokensPerSession: number },
    costUsd = 0,
    tokenCount = 0,
  ): GuardResult {
    const key = `budget:${sessionId}`
    let entry = budgetCounters.get(key)

    if (!entry) {
      entry = { spent: 0, tokens: 0 }
      budgetCounters.set(key, entry)
    }

    entry.spent += costUsd
    entry.tokens += tokenCount

    if (entry.spent > config.maxSpendPerSession) {
      return { disposition: 'block', reason: `Budget exhausted: $${entry.spent.toFixed(2)} > $${config.maxSpendPerSession}/session` }
    }

    if (entry.tokens > config.maxTokensPerSession) {
      return { disposition: 'block', reason: `Token budget exhausted: ${entry.tokens} > ${config.maxTokensPerSession}/session` }
    }

    return { disposition: 'pass' }
  },
  reset(sessionId: string) {
    budgetCounters.delete(`budget:${sessionId}`)
    rateLimitCounters.delete(`rate:${sessionId}`)
  },
}
