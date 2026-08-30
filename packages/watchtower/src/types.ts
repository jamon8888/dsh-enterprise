/**
 * Watchtower receipt types — hash-chained auditable proofs.
 * Mirrors facility/core/receipts.ts + DETAILED_PLAN.md §10.1.
 * @module @deepseek-ai/dsh-enterprise-watchtower/types
 */

export type RunId = string & { readonly __brand: 'RunId' }
export type SessionId = string & { readonly __brand: 'SessionId' }

export type TokenUsage = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  inputTokens?: number
  outputTokens?: number
  cacheRead?: number
  cacheWrite?: number
}

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

export type Receipt = {
  runId: RunId
  sessionId: SessionId
  agentId: string
  prevHash: string
  logHash: string
  phiSnapshot: { phi: number; method: string; cesHash: string }
  outcome: 'accepted' | 'rejected' | 'needs-human'
  cost: { tokens: TokenUsage; usd: number; budgets: BudgetState[] }
  guardDispositions: { guardId: string; disposition: 'pass' | 'block' | 'warn' }[]
  builtAt: number
  builder: { gitSha: string; crateVersions: Record<string, string> }
  hash: string
}

/** Minimal Run shape consumed by generateReceipt. */
export type Run = {
  runId: RunId
  sessionId: SessionId
  agentId: string
  log: unknown
  cost?: { tokens: TokenUsage; usd: number; budgets: BudgetState[] }
  guardDispositions?: { guardId: string; disposition: 'pass' | 'block' | 'warn' }[]
  builtAt?: number
  builder?: { gitSha: string; crateVersions: Record<string, string> }
  // facility-compatible extras (ignored by receipt but present on DB row)
  prNumber?: number
  commitSha?: string
  outcome?: Receipt['outcome'] | null
}
