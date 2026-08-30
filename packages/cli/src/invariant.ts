/**
 * Package invariant — CLI scaffolding idempotency.
 * @module @deepseek-ai/dsh-enterprise-cli/invariant
 */

/* jscpd:ignore-start */
export const name = 'cli-invariant'
export const inject = ['invariants'] as const

type InvariantInstaller = (ctx: unknown) => void
const PACKAGE_NAME = '@deepseek-ai/dsh-enterprise-cli'
const install: InvariantInstaller = (_ctx) => { void _ctx }
export const apply = (ctx: unknown): Promise<() => void> =>
  Promise.resolve(
    (ctx as unknown as { invariants: { register: (pkg: string, fn: InvariantInstaller) => () => void } }).invariants.register(PACKAGE_NAME, install),
  )
/* jscpd:ignore-end */
