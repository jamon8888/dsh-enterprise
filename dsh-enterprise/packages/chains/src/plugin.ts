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
    // ponytail: real facility when github:theam/facility#b150d96 is installed
    let harness: typeof import('@facility/harness/chains')
    try {
      harness = await import('@facility/harness/chains')
    } catch {
      console.warn('[chains] @facility/harness/chains not available — using in-memory stub (github:theam/facility#b150d96)')
      const productChain = {
        id: 'product',
        types: {
          S: { prefix: 'S', parentTypes: [] as string[] },
          D: { prefix: 'D', parentTypes: ['S'] },
          T: { prefix: 'T', parentTypes: ['D'] },
          V: { prefix: 'V', parentTypes: ['T'] },
        },
      }
      const researchChain = {
        id: 'research',
        types: {
          H: { prefix: 'H', parentTypes: [] as string[] },
          E: { prefix: 'E', parentTypes: ['H'] },
          F: { prefix: 'F', parentTypes: ['E'] },
        },
      }
      harness = {
        productChain,
        researchChain,
        bundledChains: [productChain, researchChain],
        chainFromConfig: (config: unknown) => {
          const v = config && typeof config === 'object' ? (config as Record<string, unknown>) : {}
          const explicit = v.chain ?? v.harnessChain
          if (explicit === 'product' || explicit === 'product-chain') return productChain
          if (explicit === 'research' || explicit === 'research-chain') return researchChain
          return researchChain
        },
      } as typeof import('@facility/harness/chains')
    }

  ctx.effect('chains', () => ({
    productChain: harness.productChain,
    researchChain: harness.researchChain,
    bundledChains: harness.bundledChains,
    chainFromConfig: harness.chainFromConfig,
  }))
}
