/**
 * GuardId union — matches guards-iit shape.
 * @module @deepseek-ai/dsh-enterprise-guards-non-iit/types
 */

import z from '@deepseek-ai/schemastery'

export const GuardId = z.union([
  'hhh-harmless',
  'hhh-helpful',
  'hhh-honest',
  'policy-allowed',
  'rate-limit',
  'budget-exhausted',
])

export type GuardId =
  | 'hhh-harmless'
  | 'hhh-helpful'
  | 'hhh-honest'
  | 'policy-allowed'
  | 'rate-limit'
  | 'budget-exhausted'

export const GuardDisposition = z.union(['pass', 'warn', 'block'])

export type GuardDisposition = 'pass' | 'warn' | 'block'

export interface GuardResult {
  disposition: 'pass' | 'warn' | 'block'
  score?: number
  reason?: string
  violated?: string[]
}

export interface ProviderConfig {
  tier: 'anthropic' | 'shared-org' | 'local-rules'
  anthropicApiKey?: string
  sharedOrgKey?: string
  model?: string
  judgeModel?: string
}
