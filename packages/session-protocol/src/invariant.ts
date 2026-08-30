/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-enterprise-session-protocol`.
 * @module @deepseek-ai/dsh-enterprise-session-protocol/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-enterprise-session-protocol'

export const name = 'session-protocol-invariant'
export const inject = ['invariants'] as const

/**
 * No runtime invariant: protocol owns no mutable package-local data relation
 * beyond the SessionEventMap declaration merging and ignorable discipline,
 * which Session itself validates (old reader skips ignorable unknowns).
 */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, Object.assign(install, { inject })))
