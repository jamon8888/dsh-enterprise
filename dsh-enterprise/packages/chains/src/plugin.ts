/**
 * Cordis plugin: `dsh-enterprise:chains`.
 * Imports `@facility/harness/chains` as a library — no copy of Facility source.
 * Uses ESM `await import` — `@facility/harness` is `type: module` (ESM) so
 * `createRequire` would throw `ERR_REQUIRE_ESM`. Cordis `apply` may be async;
 * the effect factory is async and Cordis handles `Promise<Disposer>`.
 * @module @deepseek-ai/dsh-enterprise-chains
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-enterprise:chains'

// Async apply — Cordis awaits the returned Promise before considering the plugin ready.
// This allows the dynamic import of the private `@facility/harness` git dep
// to resolve after `pnpm install` (github:theam/facility#b150d96).
export async function apply(ctx: Context): Promise<void> {
  // Library install per SPEC.md:2.2 / CRITICAL_REVIEW.md:3.2 — not file:../facility.
  // The harness package is ESM, so we must use `await import`, not `createRequire`.
  let harness: typeof import('@facility/harness/chains')
  try {
    harness = await import('@facility/harness/chains')
  } catch (err) {
    throw new Error(
      `@facility/harness not resolvable — run pnpm install (github:theam/facility#b150d96) and ensure @facility/harness dist is built (tsup). Original: ${String(err)}`,
    )
  }

  ctx.effect('chains', () => ({
    productChain: harness.productChain,
    researchChain: harness.researchChain,
    bundledChains: harness.bundledChains,
    chainFromConfig: harness.chainFromConfig,
  }))
}
