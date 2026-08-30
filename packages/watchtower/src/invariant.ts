/**
 * Package invariant — watchtower receipt hash chain.
 * @module @deepseek-ai/dsh-enterprise-watchtower/invariant
 */

/* jscpd:ignore-start */

export const name = 'watchtower-invariant'
export const inject = ['invariants'] as const

type InvariantInstaller = (ctx: unknown) => void

const PACKAGE_NAME = '@deepseek-ai/dsh-enterprise-watchtower'

const install: InvariantInstaller = (_ctx) => {
  // Invariant: receipts chain is append-only with prevHash === prev.hash
  // and hash === sha256(canonicalJson(without hash)).
  // Also logHash === sha256(canonicalJson(run.log)).
  // Registered for replay verification; no runtime effect beyond documentation.
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
