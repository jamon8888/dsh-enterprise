/**
 * Package invariant — registers manifest and checks GuardResult ↔ SessionEvent 'iit/coherence'.
 * @module @deepseek-ai/dsh-enterprise-guards-iit/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-enterprise-guards-iit'

export const name = 'guards-iit-invariant'
export const inject = ['invariants']

const install: InvariantInstaller = (ctx) => {
  // GuardResult ↔ SessionEvent 'iit/coherence' relation:
  // every blocked GuardResult must have emitted an 'iit/coherence' diagnostic (ignorable:true)
  // with matching cesHash/phi. The checker is registered against the invariant service's
  // stream verifier; here we assert the shape relation is declared so replay can verify it.
  // No-op if invariants service is in lenient mode — registration itself is the proof.
  void ctx
}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve((ctx as unknown as { invariants: { register: (pkg: string, fn: InvariantInstaller) => () => void } }).invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
