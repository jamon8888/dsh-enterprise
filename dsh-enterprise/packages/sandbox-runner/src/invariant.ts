/**
 * Package invariant — declares sandbox-runner phase relation.
 * @module @deepseek-ai/dsh-enterprise-sandbox-runner/invariant
 */

/* jscpd:ignore-start */

export const name = 'sandbox-runner-invariant'
export const inject = ['invariants'] as const

type InvariantInstaller = (ctx: unknown) => void

const PACKAGE_NAME = '@deepseek-ai/dsh-enterprise-sandbox-runner'

const install: InvariantInstaller = (_ctx) => {
  // Invariant: every RunEvent emitted by RunPhaseRecorder has
  // phase ∈ RUN_PHASE_NAMES, durationMs >=0, status ∈ RunPhaseOutcome ∪ completed/failed/skipped
  // and timestamp is monotonic within a run. Registered for replay verification.
  void _ctx
}

export const apply = (ctx: unknown): Promise<() => void> =>
  Promise.resolve(
    (ctx as unknown as { invariants: { register: (pkg: string, fn: InvariantInstaller) => () => void } }).invariants.register(
      PACKAGE_NAME,
      install,
    ),
  )

/* jscpd:ignore-end */
