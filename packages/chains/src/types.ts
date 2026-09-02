/**
 * Chain type re-exports from `@facility/harness` — library import, no copy.
 * @module @deepseek-ai/dsh-enterprise-chains/types
 */

// Re-export harness chain contracts. Do NOT copy Facility source — this is
// the library-install boundary per SPEC.md:2.2 / DETAILED_PLAN.md:5.
export type { ChainTypeConfig, ArtifactChainConfig } from '@facility/harness/chains'

/** Branded chain identifier — opaque cross-boundary id. */
export type ChainId = string & { readonly __brand: 'ChainId' }

/** Brand a string as ChainId. */
export function ChainId(id: string): ChainId {
  return id as ChainId
}
