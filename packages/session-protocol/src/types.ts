/**
 * SessionEventMap extension for DSH Enterprise (SPEC.md:8).
 * Chain payloads reuse Facility harness chain schemas via library import;
 * `declare module` extends `@deepseek-ai/dsh-session` with correct ignorable
 * discipline per `dsh/packages/core/session/src/types.ts:338`.
 * @module @deepseek-ai/dsh-enterprise-session-protocol/types
 */

// Re-export Facility harness chain config types for consumers that need
// `SharedFrontmatter` / `ArtifactChainConfig` shapes — single source of truth.
export type { ChainTypeConfig, ArtifactChainConfig } from '@facility/harness/chains'

// Session event payloads — instances of chain types. These mirror
// `facility/packages/harness/src/chain.ts` `productChain` schemas:
//   S Signal: { title, source, evidence_refs[] } + SharedFrontmatter
//   D Decision: { title, status, decided_by, signalId } + SharedFrontmatter
//   T Task: { title, status, wsjf? } + SharedFrontmatter
//   V Verification: { task, outcome: 'pass'|'fail' } + SharedFrontmatter
// We keep them as explicit interfaces so `SessionEventMap` is self-documenting
// without requiring consumers to import Facility zod schemas at runtime.
export interface ChainSignal {
  title: string
  source: string
  evidence_refs: string[]
  status?: string
}
export interface ChainDecision {
  title: string
  status: string
  decided_by: string
  signalId: string
}
export interface ChainTask {
  title: string
  status: string
  wsjf?: number
  decisionId: string
}
export interface ChainVerification {
  task: string
  outcome: 'pass' | 'fail'
  taskId: string
}

declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    /** Required — shapes reconstruction; no ignorable flag. Old readers refuse unknown required. */
    'chain/signal': { chainId: string; signal: ChainSignal }
    'chain/decision': { chainId: string; decision: ChainDecision }
    'chain/task': { chainId: string; task: ChainTask }
    'chain/verification': { chainId: string; verification: ChainVerification }
    /** Ignorable diagnostics — old readers skip; loss does not affect reconstruction. */
    'iit/coherence': { phi: number; cesHash: string; mip: { part1: number[]; part2: number[] }; ignorable: true }
    'iit/cusp': { distanceToBifurcation: number; hysteresis: boolean; ignorable: true }
    'iit/ews': { variance: number; ac1: number; ignorable: true }
  }
}
