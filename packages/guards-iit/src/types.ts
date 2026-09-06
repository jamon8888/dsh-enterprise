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
  /** RiskGate viability index [-1, +1] (phi-trajectory): +1 healthy, -1 failure imminent. */
  viabilityIndex?: number
  /** Derived from viabilityIndex (> -0.5): false = early warning zone. */
  trajectoryStable?: boolean
  /** Violated teloid IDs (effect-ethos). */
  violated?: string[]
}

/** Generic guard config zod schema (leaf guards refine this). */
export const GuardConfig = z.object({
  enabled: z.boolean().default(true),
  severity: z.union(['error', 'warn']).default('error'),
})

export type GuardConfigType = {
  enabled: boolean
  severity: 'error' | 'warn'
}
