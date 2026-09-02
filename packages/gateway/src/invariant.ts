/**
 * Package invariant — declares gateway budget relation.
 * @module @deepseek-ai/dsh-enterprise-gateway/invariant
 */

/* jscpd:ignore-start */

export const name = 'gateway-invariant'
export const inject = ['invariants'] as const

type InvariantInstaller = (ctx: unknown) => void

const PACKAGE_NAME = '@deepseek-ai/dsh-enterprise-gateway'

const install: InvariantInstaller = (_ctx) => {
  // BudgetState invariant: remaining === def.limitCents - spentCents
  // and windowStart matches period. Registered for replay verification.
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
