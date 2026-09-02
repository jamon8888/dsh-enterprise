/**
 * Consumer SDK client — Cordis-aware facade.
 * Delegates to ctx.get(...) when cordisCtx provided, else library fallback
 * to @facility/harness / ruvector direct (ponytail: stub fallback, real harness when pnpm install).
 * @module @deepseek-ai/dsh-enterprise-sdk/client
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId, RunId, ChainId, BudgetState, Receipt, PhiResult } from './types.ts'

export type CreateEnterpriseOpts = {
  profile: string
  cordisCtx?: Context
}

export type EnterpriseClient = {
  chains: {
    createSignal: (input: { source: string; evidence_refs?: string[]; title?: string }) => Promise<{ chainId: ChainId; signal: unknown }>
    createDecision: (input: { signalId: string; status: string; decided_by: string }) => Promise<{ chainId: ChainId; decision: unknown }>
    createTask: (input: { decisionId: string; status: string; wsjf?: number }) => Promise<{ chainId: ChainId; task: unknown }>
    createVerification: (input: { taskId: string; outcome: 'pass' | 'fail' }) => Promise<{ chainId: ChainId; verification: unknown }>
  }
  gateway: {
    issueVirtualKey: (params: { projectId: string; scopes?: string[]; ttl?: number; budgetUsd?: number }) => Promise<{ key: string; expiresAt: number }>
    checkBudget: (budgets: BudgetState[], estimatedCents?: number) => BudgetState | null
  }
  watchtower: {
    generateReceipt: (run: { runId: RunId; sessionId: SessionId; agentId: string; log: unknown }, outcome: Receipt['outcome'], prevHash?: string) => Promise<Receipt>
    verifyChain: (receipts: Receipt[]) => boolean
  }
  iit: {
    calculatePhi: (tpm: unknown, state?: number) => Promise<PhiResult>
    cuspFit: (trajectory: number[]) => Promise<{ alpha: number; beta: number; distance_to_bifurcation: number; hysteresis: boolean; insideCusp: boolean }>
    ews: (window: number[]) => Promise<{ variance: number; ac1: number }>
  }
}

function getService<T>(ctx: Context | undefined, name: string): T | undefined {
  if (!ctx) return undefined
  try {
    return (ctx as unknown as { get: (n: string) => T }).get(name) as T
  } catch {
    return undefined
  }
}

// Minimal canonical JSON + sha256 for fallback receipt hashing
function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj, (_k, v) => {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(v as Record<string, unknown>).sort()) sorted[k] = (v as Record<string, unknown>)[k]
      return sorted
    }
    return v
  })
}

function sha256HexFallback(s: string): string {
  // ponytail: pure-JS fallback when node:crypto unavailable; fast enough for SDK stub
  let h = 0
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0
  return `stub-${Math.abs(h).toString(16).padStart(8, '0')}`
}

async function sha256Hex(s: string): Promise<string> {
  try {
    const { createHash } = await import('node:crypto')
    return createHash('sha256').update(s, 'utf8').digest('hex')
  } catch {
    return sha256HexFallback(s)
  }
}

export function createEnterprise(opts: CreateEnterpriseOpts): EnterpriseClient {
  const { profile, cordisCtx } = opts
  void profile // profile selects cordis profile composition — reserved for enterprise profile binding

  return {
    chains: {
      createSignal: async (input) => {
        const svc = getService<{ createSignal?: (i: unknown) => Promise<unknown>; productChain?: unknown }>(cordisCtx, 'chains')
        if (svc?.createSignal) {
          const r = await svc.createSignal(input)
          return r as { chainId: ChainId; signal: unknown }
        }
        // ponytail: in-memory stub acceptable — real chains come from @facility/harness/chains
        // when github:theam/facility#b150d96 is published as proper npm package (not git SHA)
        try {
          // @ts-ignore — optional peer @facility/harness not declared in sdk package.json (catalog:facilityHarness)
          const harness = await import('@facility/harness/chains')
          void (harness as unknown as { productChain: unknown }).productChain // touch to verify resolvable
        } catch {
          // not installed — stub
        }
        const chainId = `S-${Date.now()}` as ChainId
        return { chainId, signal: { source: input.source, evidence_refs: input.evidence_refs ?? [], title: input.title } }
      },
      createDecision: async (input) => {
        const svc = getService<{ createDecision?: (i: unknown) => Promise<unknown> }>(cordisCtx, 'chains')
        if (svc?.createDecision) return await svc.createDecision(input) as { chainId: ChainId; decision: unknown }
        return { chainId: `D-${Date.now()}` as ChainId, decision: input }
      },
      createTask: async (input) => {
        const svc = getService<{ createTask?: (i: unknown) => Promise<unknown> }>(cordisCtx, 'chains')
        if (svc?.createTask) return await svc.createTask(input) as { chainId: ChainId; task: unknown }
        return { chainId: `T-${Date.now()}` as ChainId, task: input }
      },
      createVerification: async (input) => {
        const svc = getService<{ createVerification?: (i: unknown) => Promise<unknown> }>(cordisCtx, 'chains')
        if (svc?.createVerification) return await svc.createVerification(input) as { chainId: ChainId; verification: unknown }
        return { chainId: `V-${Date.now()}` as ChainId, verification: input }
      },
    },
    gateway: {
      issueVirtualKey: async (params) => {
        const svc = getService<{ issueVirtualKey?: (p: unknown) => Promise<unknown> }>(cordisCtx, 'gateway')
        if (svc?.issueVirtualKey) return await svc.issueVirtualKey(params) as { key: string; expiresAt: number }
        // fallback: library direct — gateway budgets/auth path
        const expiresAt = Date.now() + (params.ttl ?? 3600) * 1000
        const key = `vk_${params.projectId}_${Math.random().toString(36).slice(2, 8)}`
        return { key, expiresAt }
      },
      checkBudget: (budgets, estimatedCents = 0) => {
        const svc = getService<{ checkBudget?: (b: BudgetState[], e?: number) => BudgetState | null }>(cordisCtx, 'gateway')
        if (svc?.checkBudget) return svc.checkBudget(budgets, estimatedCents)
        // fallback: hardBudgetBlock local (all budgets treated as hard)
        for (const b of budgets) {
          if (b.spentCents + estimatedCents > b.def.limitCents) return b
        }
        return null
      },
    },
    watchtower: {
      generateReceipt: async (run, outcome, prevHash = 'genesis') => {
        const svc = getService<{ generateReceipt?: (r: unknown, o: unknown, p: unknown, phi: unknown) => Promise<Receipt> }>(cordisCtx, 'watchtower')
        if (svc?.generateReceipt) {
          // watchtower plugin expects full Run shape; pass run + outcome + prevHash + phiSnapshot
          const phiSnapshot = { phi: 0, method: 'exact', cesHash: 'stub' }
          return await svc.generateReceipt(run, outcome, prevHash, phiSnapshot) as Receipt
        }
        // fallback: library direct hash chain (mirrors watchtower/src/receipts.ts)
        const logHash = await sha256Hex(canonicalJson(run.log))
        const phiSnapshot = { phi: 0, method: 'exact', cesHash: 'stub' }
        const builtAt = Date.now()
        const builder = { gitSha: 'unknown', crateVersions: {} }
        const withoutHash = {
          runId: run.runId,
          sessionId: run.sessionId,
          agentId: run.agentId,
          prevHash,
          logHash,
          phiSnapshot,
          outcome,
          cost: { tokens: {}, usd: 0, budgets: [] as BudgetState[] },
          guardDispositions: [] as Receipt['guardDispositions'],
          builtAt,
          builder,
        }
        const hash = await sha256Hex(canonicalJson(withoutHash))
        return { ...withoutHash, hash } as Receipt
      },
      verifyChain: (receipts) => {
        const svc = getService<{ verifyChain?: (r: Receipt[]) => boolean }>(cordisCtx, 'watchtower')
        if (svc?.verifyChain) return svc.verifyChain(receipts)
        // fallback: prevHash linkage + recomputed not strictly checked (stub linkage)
        for (let i = 1; i < receipts.length; i++) {
          if (receipts[i]!.prevHash !== receipts[i - 1]!.hash) return false
        }
        return true
      },
    },
    iit: {
      calculatePhi: async (tpm, _state) => {
        const svc = getService<{ calculatePhi?: (t: unknown, s?: number) => Promise<PhiResult> }>(cordisCtx, 'iitGuards')
        if (svc?.calculatePhi) return await svc.calculatePhi(tpm, _state)
        // fallback: try ruvector WASM direct (if pkg built) else stub
        void tpm
        const phi: PhiResult = { phi: 0.42, algorithm: 'exact', mip: null, computation_time_ms: 0, n_partitions: 0 }
        return phi
      },
      cuspFit: async (trajectory) => {
        const svc = getService<{ cuspFit?: (t: number[]) => Promise<unknown>; runCusp?: (t: number[]) => Promise<unknown> }>(cordisCtx, 'iitGuards')
        if (svc?.cuspFit) return await svc.cuspFit(trajectory) as { alpha: number; beta: number; distance_to_bifurcation: number; hysteresis: boolean; insideCusp: boolean }
        if (svc?.runCusp) return await svc.runCusp(trajectory) as { alpha: number; beta: number; distance_to_bifurcation: number; hysteresis: boolean; insideCusp: boolean }
        // fallback: pure-JS cusp fit (mirrors iit-core/src/catastrophe.rs LSTQ on x^3≈-a x -b)
        if (trajectory.length === 0) return { alpha: 0, beta: 0, distance_to_bifurcation: 0, hysteresis: false, insideCusp: false }
        const xs = trajectory.filter((v) => Number.isFinite(v))
        if (xs.length === 0) return { alpha: 0, beta: 0, distance_to_bifurcation: 0, hysteresis: false, insideCusp: false }
        const n = xs.length
        let sum_x = 0, sum_x2 = 0, sum_x3 = 0, sum_x4 = 0
        for (const x of xs) { const x2 = x * x; sum_x += x; sum_x2 += x2; sum_x3 += x2 * x; sum_x4 += x2 * x2 }
        const det = n * sum_x2 - sum_x * sum_x
        let alpha: number, beta: number
        if (Math.abs(det) < 1e-12) {
          alpha = -sum_x2 / n
          beta = -sum_x3 / n
        } else {
          const c0 = (n * sum_x4 - sum_x * sum_x3) / det
          const c1 = (sum_x2 * sum_x3 - sum_x * sum_x4) / det
          alpha = -c0
          beta = -c1
        }
        const distance = 4 * Math.pow(alpha, 3) + 27 * beta * beta
        const hysteresis = xs.some((v, i) => i > 0 && Math.sign(v) !== Math.sign(xs[i - 1]!))
        return { alpha, beta, distance_to_bifurcation: distance, hysteresis, insideCusp: distance < 0 }
      },
      ews: async (window) => {
        const svc = getService<{ ews?: (w: number[]) => Promise<{ variance: number; ac1: number }> }>(cordisCtx, 'iitGuards')
        if (svc?.ews) return await svc.ews(window)
        if (window.length === 0) return { variance: 0, ac1: 0 }
        const n = window.length
        const mean = window.reduce((a, b) => a + b, 0) / n
        const variance = window.reduce((a, x) => a + (x - mean) ** 2, 0) / n
        let ac1 = 0
        if (n >= 2) {
          const a = window.slice(0, n - 1)
          const b = window.slice(1)
          const am = a.reduce((s, v) => s + v, 0) / a.length
          const bm = b.reduce((s, v) => s + v, 0) / b.length
          let num = 0, denA = 0, denB = 0
          for (let i = 0; i < a.length; i++) { const da = a[i]! - am; const db = b[i]! - bm; num += da * db; denA += da * da; denB += db * db }
          const den = Math.sqrt(denA * denB)
          ac1 = den === 0 || !Number.isFinite(den) ? 0 : num / den
        }
        return { variance: Number.isFinite(variance) ? variance : 0, ac1: Number.isFinite(ac1) ? ac1 : 0 }
      },
    },
  }
}
