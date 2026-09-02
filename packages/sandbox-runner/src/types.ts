/**
 * Sandbox runner types — enterprise reimplementation of facility/runner/src/phases.ts + types.
 * Upstream runner is a service, not a publishable package; this is a service reimplementation.
 * @module @deepseek-ai/dsh-enterprise-sandbox-runner/types
 */

export const RUN_PHASE_NAMES = [
  'bootstrap',
  'workspace',
  'runner_runtime',
  'package_install',
  'provision',
  'agent',
  'result_capture',
  'acceptance',
  'delivery',
] as const

export type RunPhaseName = (typeof RUN_PHASE_NAMES)[number]
export type RunPhaseOutcome = 'succeeded' | 'failed' | 'skipped' | 'canceled'
export type RunPhaseSkipReason = 'not_configured' | 'agent_canceled' | 'run_preconditions_failed'

export type PhaseDetails = {
  durationMs?: number
  outcome?: RunPhaseOutcome
  error?: unknown
}

export type RunEvent = {
  phase: RunPhaseName
  status: RunPhaseOutcome | string
  durationMs: number
  timestamp: number | string
  phiSnapshot?: unknown
  outcome?: RunPhaseOutcome
  error?: unknown
  reason?: RunPhaseSkipReason
  // facility compat — preserved so upstream timeline readers don't break
  type?: string
  data?: Record<string, unknown>
  ts?: string
}

export type EmitRunEvents = (events: RunEvent[]) => Promise<unknown>
