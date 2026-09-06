/**
 * Basic smoke tests for guards-non-iit.
 */

import { describe, it, expect } from 'vitest'
import {
  hhhHarmlessGuard,
  hhhHelpfulGuard,
  hhhHonestGuard,
  policyAllowedGuard,
  rateLimitGuard,
  budgetExhaustedGuard,
} from '../src/index.js'

describe('guards-non-iit smoke', () => {
  describe('guard shapes', () => {
    it('hhh-harmless has required shape', () => {
      expect(hhhHarmlessGuard.id).toBe('hhh-harmless')
      expect(hhhHarmlessGuard.severity).toBe('block')
      expect(typeof hhhHarmlessGuard.run).toBe('function')
    })

    it('hhh-helpful has required shape', () => {
      expect(hhhHelpfulGuard.id).toBe('hhh-helpful')
      expect(hhhHelpfulGuard.severity).toBe('warn')
      expect(typeof hhhHelpfulGuard.run).toBe('function')
    })

    it('hhh-honest has required shape', () => {
      expect(hhhHonestGuard.id).toBe('hhh-honest')
      expect(hhhHonestGuard.severity).toBe('warn')
      expect(typeof hhhHonestGuard.run).toBe('function')
    })

    it('policy-allowed has required shape', () => {
      expect(policyAllowedGuard.id).toBe('policy-allowed')
      expect(policyAllowedGuard.severity).toBe('block')
      expect(typeof policyAllowedGuard.run).toBe('function')
    })

    it('rate-limit has evaluate fn', () => {
      expect(rateLimitGuard.id).toBe('rate-limit')
      expect(typeof rateLimitGuard.evaluate).toBe('function')
    })

    it('budget-exhausted has evaluate + reset', () => {
      expect(budgetExhaustedGuard.id).toBe('budget-exhausted')
      expect(typeof budgetExhaustedGuard.evaluate).toBe('function')
      expect(typeof budgetExhaustedGuard.reset).toBe('function')
    })
  })

  describe('rate-limit guard', () => {
    it('passes under limit', () => {
      const result = rateLimitGuard.evaluate('session-1', {
        maxRequestsPerMinute: 60,
        maxTokensPerMinute: 100000,
      }, 500)
      expect(result.disposition).toBe('pass')
    })

    it('blocks over request limit', () => {
      for (let i = 0; i < 59; i++) {
        rateLimitGuard.evaluate('session-rl-test', {
          maxRequestsPerMinute: 60,
          maxTokensPerMinute: 100000,
        }, 0)
      }
      const result = rateLimitGuard.evaluate('session-rl-test', {
        maxRequestsPerMinute: 60,
        maxTokensPerMinute: 100000,
      }, 0)
      expect(result.disposition).toBe('block')
    })
  })

  describe('budget-exhausted guard', () => {
    it('passes under budget', () => {
      const result = budgetExhaustedGuard.evaluate('session-budget-1', {
        maxSpendPerSession: 10.0,
        maxTokensPerSession: 100000,
      }, 1.0, 10000)
      expect(result.disposition).toBe('pass')
    })

    it('blocks over spend budget', () => {
      budgetExhaustedGuard.reset('session-budget-spend')
      const result = budgetExhaustedGuard.evaluate('session-budget-spend', {
        maxSpendPerSession: 5.0,
        maxTokensPerSession: 100000,
      }, 6.0, 1000)
      expect(result.disposition).toBe('block')
    })

    it('blocks over token budget', () => {
      budgetExhaustedGuard.reset('session-budget-tokens')
      const result = budgetExhaustedGuard.evaluate('session-budget-tokens', {
        maxSpendPerSession: 100.0,
        maxTokensPerSession: 50000,
      }, 1.0, 60000)
      expect(result.disposition).toBe('block')
    })
  })

  describe('policy-allowed guard', () => {
    it('passes allowed actions', async () => {
      const result = await policyAllowedGuard.run({
        rules: [
          { id: 'no-delete', pattern: 'delete.*production', action: 'block', description: 'No prod deletes' },
        ],
      }, { toolName: 'read_file', requestPath: '/safe/path' })
      expect(result.disposition).toBe('pass')
    })

    it('blocks disallowed patterns', async () => {
      const result = await policyAllowedGuard.run({
        rules: [
          { id: 'no-delete', pattern: 'rm.*-rf.*production', action: 'block', description: 'No prod deletes' },
        ],
      }, { toolName: 'shell', requestPath: 'rm -rf /production' })
      expect(result.disposition).toBe('block')
      expect(result.violated).toContain('no-delete')
    })

    it('warns on warning patterns', async () => {
      const result = await policyAllowedGuard.run({
        rules: [
          { id: 'manipulation', pattern: 'trick.*user', action: 'warn', description: 'Warn on manipulation' },
        ],
      }, { toolName: 'prompt', requestPath: 'Some prompt with trick the user intent' })
      expect(result.disposition).toBe('warn')
      expect(result.violated).toContain('manipulation')
    })
  })
})
