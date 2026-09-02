/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-enterprise-chains`.
 * Checks S→D→T→V linking discipline.
 * @module @deepseek-ai/dsh-enterprise-chains/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import { createRequire } from 'node:module'

const PACKAGE_NAME = '@deepseek-ai/dsh-enterprise-chains'

export const name = 'chains-invariant'
export const inject = ['invariants'] as const

const install: InvariantInstaller = (ctx: Context, fail) => {
  // Validate chain topology immediately on install — not per-event, because
  // chains are static config, not a mutable log relation. If harness is not
  // yet installed (consumer hasn't run pnpm install), skip gracefully; the
  // validate path in tests covers the runtime parent_required check.
  try {
    const require = createRequire((import.meta as unknown as { url: string }).url)
    const harness = require('@facility/harness/chains') as typeof import('@facility/harness/chains')
    const { productChain } = harness

    // S→D→T→V must be a linear chain: S free, D→S, T→D, V→T
    const expect = (prefix: string, parents: string[]) => {
      const cfg = productChain.types[prefix]
      if (!cfg) fail(`productChain missing type ${prefix}`)
      const got = (cfg as NonNullable<typeof cfg>).parentTypes
      if (got.length !== parents.length || !got.every((p, i) => p === parents[i])) {
        fail(`productChain ${prefix} parentTypes expected [${parents.join(',')}] got [${got.join(',')}]`)
      }
    }
    expect('S', [])
    expect('D', ['S'])
    expect('T', ['D'])
    expect('V', ['T'])
    // R is free (no parent) — stable docs, not part of S→D→T→V critical path

    // Also ensure ctx.chains service, when present, round-trips chainFromConfig correctly
    // Do not fail here if service not yet registered — plugin is independent of invariant ordering.
    const chains = (ctx as unknown as { get?: (n: string) => unknown }).get?.('chains') as
      | { chainFromConfig?: (c: unknown) => unknown }
      | undefined
    if (chains?.chainFromConfig) {
      const a = chains.chainFromConfig({ chain: 'product' })
      const b = chains.chainFromConfig({ artifact_types: [{ prefix: 'S' }] })
      if (a !== productChain || b !== productChain) {
        fail('chainFromConfig round-trip mismatch')
      }
    }
  } catch (err) {
    // If harness not resolvable, don't fail — this is library-install divergence
    // (consumer must pnpm install github:theam/facility#b150d96). Swallow only that case.
    const msg = String(err)
    if (msg.includes('invariant violated')) throw err
    if (!msg.includes('@facility/harness')) throw err
  }
}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, Object.assign(install, { inject })))
