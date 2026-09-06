/**
 * Policy guard — OPA-style rule evaluation for enterprise policies.
 * Block/warn based on configurable regex rules.
 * @module @deepseek-ai/dsh-enterprise-guards-non-iit/guards/policy
 */

import z from '@deepseek-ai/schemastery'
import type { GuardResult } from '../types.js'

export const policyAllowedGuard = {
  id: 'policy-allowed' as const,
  severity: 'block' as const,
  Config: z.object({
    rules: z.array(z.object({
      id: z.string(),
      pattern: z.string(),
      action: z.union(['block', 'warn', 'allow']),
      description: z.string(),
    })).default([]),
  }),
  async run(
    config: { rules: Array<{ id: string; pattern: string; action: 'block' | 'warn' | 'allow'; description: string }> },
    context: { toolName?: string; requestPath?: string; recentActions?: string[] },
  ): Promise<GuardResult> {
    const textToCheck = [
      context.toolName,
      context.requestPath,
      ...(context.recentActions ?? []),
    ].filter(Boolean).join(' ')

    const violated: string[] = []
    const warnings: string[] = []

    for (const rule of config.rules) {
      try {
        const regex = new RegExp(rule.pattern, 'i')
        if (regex.test(textToCheck)) {
          if (rule.action === 'block') {
            violated.push(rule.id)
          } else if (rule.action === 'warn') {
            warnings.push(rule.id)
          }
        }
      } catch {
        // Invalid regex, skip
      }
    }

    if (violated.length > 0) {
      return { disposition: 'block', violated, reason: `Policy violated: ${violated.join(', ')}` }
    }

    if (warnings.length > 0) {
      return { disposition: 'warn', violated: warnings, reason: `Policy warning: ${warnings.join(', ')}` }
    }

    return { disposition: 'pass' }
  },
}
