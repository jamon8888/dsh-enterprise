/**
 * SDK type re-exports — branded IDs + cross-package surfaces.
 * @module @deepseek-ai/dsh-enterprise-sdk/types
 */

import type { SessionId as SessionIdType } from '@deepseek-ai/dsh-session'
// Re-export branded SessionId from dsh-session (compile-time cast, no runtime cost).
export { SessionId } from '@deepseek-ai/dsh-session'
type SessionId = SessionIdType

/** Branded RunId — opaque cross-boundary id. */
export type RunId = string & { readonly __brand: 'RunId' }
export function RunId(id: string): RunId {
  return id as RunId
}

/** Branded ChainId — opaque cross-boundary id. */
export type ChainId = string & { readonly __brand: 'ChainId' }
export function ChainId(id: string): ChainId {
  return id as ChainId
}

/** Budget state — enterprise reimplementation of facility/services/gateway BudgetState. */
export type BudgetState = {
  def: {
    id: string
    limitCents: number
    scope?: string
    period?: string
    orgId?: string
    projectId?: string
  }
  windowStart: string
  spentCents: number
  remaining: number
}

/** Hash-chained receipt — mirrors watchtower Receipt. */
export type Receipt = {
  runId: RunId
  sessionId: SessionId
  agentId: string
  prevHash: string
  logHash: string
  phiSnapshot: { phi: number; method: string; cesHash: string }
  outcome: 'accepted' | 'rejected' | 'needs-human'
  cost: { tokens: Record<string, unknown>; usd: number; budgets: BudgetState[] }
  guardDispositions: { guardId: string; disposition: 'pass' | 'block' | 'warn'; cesHash?: string }[]
  builtAt: number
  builder: { gitSha: string; crateVersions: Record<string, string> }
  hash: string
}

/** Phi computation result — mirrors ruvector PhiResult. */
export type PhiResult = {
  phi: number
  algorithm: string
  mip: Bipartition | null
  computation_time_ms?: number
  n_partitions?: number
}

/** Bipartition — minimum information partition from ruvector. */
export type Bipartition = {
  part1: number[]
  part2: number[]
}
