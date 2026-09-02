/**
 * Guard types for DSH Enterprise IIT guards.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/types
 */

import z from '@deepseek-ai/schemastery'

/** Guard identifier — extendable union. */
export type GuardId = 'phi-threshold' | 'phi-trajectory' | 'ces-fingerprint' | 'mip-shift' | 'boundary-frontier' | 'catastrophe-cusp' | 'attractor-ews' | 'workspace-ignition' | 'free-energy' | 'causal-emergence' | 'effect-ethos' | (string & {})

/**
 * Result of a single guard evaluation.
 * Maps to waterfall disposition: pass → next(), block → throw GuardError, warn → audit event.
 */
export interface GuardResult {
  disposition: 'pass' | 'block' | 'warn'
  /** Phi value when computed (phi-threshold, phi-trajectory). */
  phi?: number
  /** CES hash snapshot for ces-fingerprint / receipt. */
  cesHash?: string
  /** Human-readable block/warn reason. */
  reason?: string
  /** Violated teloid IDs (effect-ethos). */
  violated?: string[]
}

/** Generic guard config zod schema (leaf guards refine this). */
export const GuardConfig = z.object({
  enabled: z.boolean().default(true),
  severity: z.enum(['error', 'warn']).default('error'),
})

export type GuardConfigType = {
  enabled: boolean
  severity: 'error' | 'warn'
}
