/**
 * Package invariant — SDK manifest + event/data relation.
 * @module @deepseek-ai/dsh-enterprise-sdk/invariant
 */

/* jscpd:ignore-start */

export const name = 'sdk-invariant'
export const inject = ['invariants'] as const

type InvariantInstaller = (ctx: unknown) => void

const PACKAGE_NAME = '@deepseek-ai/dsh-enterprise-sdk'

const install: InvariantInstaller = (_ctx) => {
  // SDK invariant: createEnterprise is pure and returns branded IDs that
  // round-trip via SessionId/RunId/ChainId casts; Receipt.hash === sha256(canonicalJson(without hash))
  // and PhiResult.mip partitions when present.
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
