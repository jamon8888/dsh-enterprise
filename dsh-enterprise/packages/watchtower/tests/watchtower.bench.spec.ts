import { describe, it, expect } from 'vitest'
import { generateReceipt, verifyChain, hashReceiptWithoutHash } from '../src/receipts.js'
import { runWatchtowerJob } from '../src/job.js'
import {
  runNightlyBenchmarkJob,
  emitBenchmarkEnvelope,
  benchmarkRunEvents,
  clearBenchmarkRunEvents,
  type BenchmarkSuite,
} from '../src/job.js'
import type { Run, RunId, SessionId, Receipt } from '../src/types.js'

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    runId: 'run-bench-1' as RunId,
    sessionId: 'sess-bench' as SessionId,
    agentId: 'agent-bench',
    log: [{ seq: 1, type: 'tool/call' as const, data: { tool: 'bash' } }],
    builtAt: 1700000000000,
    builder: { gitSha: 'bench', crateVersions: {} },
    ...overrides,
  }
}

const phi = { phi: 0.42, method: 'exact', cesHash: 'ces-bench' }

describe('watchtower.bench — generateReceipt hash chain', () => {
  it('hash chain is stable across 100 receipts', () => {
    const receipts: Receipt[] = []
    let prev = 'genesis'
    for (let i = 0; i < 100; i++) {
      const run = makeRun({ runId: `run-${i}` as RunId, log: [{ seq: i }] })
      const r = generateReceipt(run, 'accepted', prev, phi)
      receipts.push(r)
      prev = r.hash
    }
    expect(verifyChain(receipts)).toBe(true)
    expect(receipts[99]!.prevHash).toBe(receipts[98]!.hash)
  })

  it('hashReceiptWithoutHash is deterministic', () => {
    const run = makeRun()
    const r = generateReceipt(run, 'accepted', 'genesis', phi)
    const { hash: _h, ...without } = r as Receipt & Record<string, unknown>
    const h2 = hashReceiptWithoutHash(without as Omit<Receipt, 'hash'>)
    expect(h2).toBe(r.hash)
  })

  // bench-like perf smoke (vitest bench runs with --bench; keep as it for `vitest run`)
  it('bench generateReceipt (100 receipts)', () => {
    for (let i = 0; i < 100; i++) {
      const run = makeRun({ runId: `run-bench-${i}` as RunId })
      generateReceipt(run, 'accepted', 'genesis', phi)
    }
  })

  it('bench verifyChain', () => {
    const receipts: Receipt[] = []
    let prev = 'genesis'
    for (let i = 0; i < 10; i++) {
      const run = makeRun({ runId: `run-${i}` as RunId, log: [{ seq: i }] })
      const r = generateReceipt(run, 'accepted', prev, phi)
      receipts.push(r)
      prev = r.hash
    }
    expect(verifyChain(receipts)).toBe(true)
  })
})

describe('watchtower.bench — runWatchtowerJob with budgetCapped terminal-bench stub', () => {
  function memoryDb(runs: Run[]) {
    const receipts: Receipt[] = []
    return {
      receipts,
      async findRunsWithoutOutcome() {
        return runs
      },
      async insertReceipt(receipt: Receipt) {
        receipts.push(receipt)
      },
      async listReceipts() {
        return receipts
      },
      async insertRunEvent(envelope: unknown) {
        // capture for bench assertion — also mirrored to benchmarkRunEvents via emitBenchmarkEnvelope
        void envelope
      },
    }
  }

  it('terminal-bench stub succeeds when under MAX_COST_USD', async () => {
    clearBenchmarkRunEvents()
    const stubRunner = async (suite: BenchmarkSuite) => ({
      phi: 0.9,
      variance: 0.3,
      ac1: 0.2,
      costUsd: 0.5,
      orgId: 'org-bench',
      projectId: `proj-${suite}`,
    })
    const res = await runNightlyBenchmarkJob({
      suite: 'terminal-bench',
      runner: stubRunner,
      estimatedTokens: 500,
      maxCostUsd: 5,
      orgId: 'org-bench',
      projectId: 'proj-terminal',
    })
    expect((res as { blocked?: boolean }).blocked).not.toBe(true)
    // benchmark envelope assertions
    const stored = benchmarkRunEvents.get((res as { runId: string }).runId)
    expect(stored).toBeDefined()
    expect(stored!.suite).toBe('terminal-bench')
    expect(stored!.cost.usd).toBeCloseTo(0.5)
    expect(stored!.phiSnapshot.phi).toBe(0.9)
    expect(stored!.ews?.variance).toBe(0.3)
  })

  it('browsecomp stub is blocked when estimatedCents > maxCostUsd', async () => {
    clearBenchmarkRunEvents()
    let runnerCalled = false
    const stubRunner = async (_suite: BenchmarkSuite) => {
      runnerCalled = true
      return { phi: 1.1, costUsd: 0.1 }
    }
    // estimatedTokens 100_000 → estimatedCents 10_000 → $100 > maxCostUsd 0.01 → blocked
    const res = await runNightlyBenchmarkJob({
      suite: 'browsecomp',
      runner: stubRunner,
      estimatedTokens: 100_000,
      maxCostUsd: 0.01,
    })
    expect((res as { blocked: boolean }).blocked).toBe(true)
    expect(runnerCalled).toBe(false)
    expect((res as { reason: string }).reason).toMatch(/maxCostUsd|estimatedCents/)
  })

  it('hardBudgetBlock blocks when budgetStates would exceed limit', async () => {
    clearBenchmarkRunEvents()
    const stubRunner = async () => ({ phi: 0.5, costUsd: 0.2 })
    const res = await runNightlyBenchmarkJob({
      suite: 'terminal-bench',
      runner: stubRunner,
      estimatedTokens: 2000, // 200 cents
      budgetStates: [{ def: { limitCents: 150 }, spentCents: 0 }],
      maxCostUsd: 100,
    })
    expect((res as { blocked: boolean }).blocked).toBe(true)
    expect((res as { reason: string }).reason).toMatch(/hardBudgetBlock/)
  })

  it('runWatchtowerJob still mints receipts alongside bench envelope', async () => {
    clearBenchmarkRunEvents()
    const runs: Run[] = [
      makeRun({ runId: 'run-wt-1' as RunId, log: [{ seq: 1 }] }) as Run & { prNumber: number; commitSha: string },
    ]
    // attach prNumber/commitSha via unknown cast
    ;(runs[0] as unknown as { prNumber: number }).prNumber = 1
    ;(runs[0] as unknown as { commitSha: string }).commitSha = 'sha-bench'
    const db = memoryDb(runs)
    const github = {
      getPR: async () => ({ merged: true, closed: true }),
      getChecks: async () => ({ green: true }),
    }
    const receipts = await runWatchtowerJob({}, db as never, github)
    expect(receipts).toHaveLength(1)
    expect(receipts[0]!.outcome).toBe('accepted')
    // bench envelope dual-write still works independently
    const benchRes = await runNightlyBenchmarkJob({
      suite: 'terminal-bench',
      runner: async () => ({ phi: receipts[0]!.phiSnapshot.phi, costUsd: receipts[0]!.cost.usd }),
      db: { insertRunEvent: async (e: unknown) => { db.receipts.push(e as unknown as Receipt) } } as never,
      estimatedTokens: 100,
      maxCostUsd: 5,
    })
    expect((benchRes as { blocked?: boolean }).blocked).not.toBe(true)
  })

  it('emitBenchmarkEnvelope dual-writes to Map and Postgres stub', async () => {
    clearBenchmarkRunEvents()
    const envelope = {
      runId: 'bench-test-dual',
      suite: 'terminal-bench' as BenchmarkSuite,
      orgId: 'org-x',
      projectId: 'proj-y',
      cost: { usd: 1.23, cents: 123 },
      phiSnapshot: { phi: 0.7, method: 'exact', cesHash: 'h' },
      ews: { variance: 0.4, ac1: 0.1 },
      createdAt: new Date().toISOString(),
    }
    let pgCalled = false
    await emitBenchmarkEnvelope(envelope, {
      insertRunEvent: async () => {
        pgCalled = true
      },
    })
    expect(benchmarkRunEvents.get('bench-test-dual')).toEqual(envelope)
    expect(pgCalled).toBe(true)
  })

  it('bench runNightlyBenchmarkJob budget-capped stub', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await runNightlyBenchmarkJob({
        suite: 'terminal-bench',
        runner: async () => ({ phi: 0.5, costUsd: 0.1 }),
        estimatedTokens: 100,
        maxCostUsd: 5,
      })
      expect((res as { blocked?: boolean }).blocked).not.toBe(true)
    }
  })
})
