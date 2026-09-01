/**
 * Watchtower hourly job — outcome joining via GitHub PR/CI + receipt minting.
 * Port of facility/services/api background job; ponytail in-memory until Postgres lands.
 * @module @deepseek-ai/dsh-enterprise-watchtower/job
 */
// ponytail: in-memory store, Postgres run_events when gateway lands

import type { Receipt, Run } from './types.js'
import { generateReceipt } from './receipts.js'

export type GithubPR = { merged: boolean; closed: boolean; number?: number }
export type GithubChecks = { green: boolean }

export type GithubCheckStatus = 'queued' | 'in_progress' | 'completed' | 'waiting' | 'pending'
export type GithubCheckConclusion = 'action_required' | 'cancelled' | 'failure' | 'neutral' | 'success' | 'skipped' | 'stale' | 'timed_out'

export type PostCheckRunParams = {
  status: GithubCheckStatus
  conclusion?: GithubCheckConclusion
  headSha: string
  name: string
  detailsUrl?: string
  output?: {
    title: string
    summary: string
  }
  actions?: Array<{ label: string; description: string; identifier: string }>
}

export type GithubClient = {
  getPR(prNumber: number): Promise<GithubPR>
  getChecks(commitSha: string): Promise<GithubChecks>
  postCheckRun?(params: PostCheckRunParams): Promise<{ id: number; url: string }>
}

export type DbClient = {
  /** Returns runs without outcome (or all runs — job filters outcome==null). */
  findRunsWithoutOutcome(): Promise<Run[]>
  insertReceipt(receipt: Receipt): Promise<void>
  /** Optional: list all receipts for aggregate computation (stub). */
  listReceipts?(): Promise<Receipt[]>
}

export type WatchtowerAggregates = {
  acceptance_rate: number
  one_shot_rate: number
  avg_cost: number
}

function deriveOutcome(pr: GithubPR, ci: GithubChecks): Receipt['outcome'] {
  if (pr.merged && ci.green) return 'accepted'
  if (pr.closed) return 'rejected'
  return 'needs-human'
}

function computeAggregates(receipts: Receipt[]): WatchtowerAggregates {
  if (receipts.length === 0) return { acceptance_rate: 0, one_shot_rate: 0, avg_cost: 0 }
  const accepted = receipts.filter((r) => r.outcome === 'accepted').length
  // stub: one_shot = accepted without fixup (no fixup field → assume all accepted are one-shot for stub)
  const oneShot = accepted
  const totalCost = receipts.reduce((s, r) => s + (r.cost?.usd ?? 0), 0)
  return {
    acceptance_rate: accepted / receipts.length,
    one_shot_rate: receipts.length ? oneShot / receipts.length : 0,
    avg_cost: totalCost / receipts.length,
  }
}

/**
 * Hourly job: for each run without outcome, join GitHub PR+CI → outcome → receipt → insert.
 * Returns minted receipts and stub aggregates.
 */
export async function runWatchtowerJob(
  _ctx: unknown,
  db: DbClient,
  github: GithubClient,
  opts?: { phiSnapshot?: Receipt['phiSnapshot']; prevHashForRun?: (run: Run) => string | Promise<string> },
): Promise<Receipt[]> {
  const runs = await db.findRunsWithoutOutcome()
  const receipts: Receipt[] = []
  // track aggregates stub — computed after loop (could be stored to DB)
  let prevHash = 'genesis'
  // if db has existing receipts, chain from last hash
  if (db.listReceipts) {
    try {
      const existing = await db.listReceipts()
      if (existing.length > 0) prevHash = existing[existing.length - 1]!.hash
    } catch {
      // ignore
    }
  }

  for (const run of runs) {
    // skip runs that already have an outcome (defensive)
    if ((run as unknown as { outcome?: string | null }).outcome) continue

    const prNumber = (run as unknown as { prNumber?: number }).prNumber ?? 0
    const commitSha = (run as unknown as { commitSha?: string }).commitSha ?? ''

    let pr: GithubPR
    let ci: GithubChecks
    try {
      pr = await github.getPR(prNumber)
    } catch {
      pr = { merged: false, closed: false }
    }
    try {
      ci = await github.getChecks(commitSha)
    } catch {
      ci = { green: false }
    }

    const outcome = deriveOutcome(pr, ci)
    const phiSnapshot = opts?.phiSnapshot ?? { phi: 0, method: 'exact', cesHash: 'none' }
    const runPrevHash = opts?.prevHashForRun ? await opts.prevHashForRun(run) : prevHash

    const receipt = generateReceipt(run, outcome, runPrevHash, phiSnapshot)
    await db.insertReceipt(receipt)
    receipts.push(receipt)

    // Post GitHub check run for needs-human outcome
    if (outcome === 'needs-human' && github.postCheckRun && run.commitSha) {
      try {
        await github.postCheckRun({
          status: 'completed',
          conclusion: 'action_required',
          headSha: run.commitSha,
          name: 'dsh-enterprise/needs-human',
          detailsUrl: `https://github.com/example/repo/runs/${receipt.hash}`,
          output: {
            title: 'IIT Guard: needs human review',
            summary: `Session ${run.sessionId} requires human review before merge. Guard dispositions: ${JSON.stringify(receipt.guardDispositions)}`,
          },
          actions: [
            {
              label: 'Approve and merge',
              description: 'TenantAdmin approves this run for merge',
              identifier: 'approve-merge',
            },
          ],
        })
      } catch (err) {
        // GitHub check posting is non-blocking — log and continue
        void err
      }
    }

    prevHash = receipt.hash

    // stub aggregate compute (not persisted — placeholder for Postgres run_events aggregate)
    void computeAggregates(receipts)
  }

  return receipts
}

/**
 * Approve a needs-human receipt (TenantAdmin action).
 * Re-posts the GitHub check as 'success' and returns an updated accepted receipt.
 */
export async function approveNeedsHuman(
  receipt: Receipt,
  github: GithubClient,
  _actor: { guardRole: string },
): Promise<Receipt> {
  if (receipt.outcome !== 'needs-human') {
    throw new Error(`approveNeedsHuman: receipt ${receipt.hash} is not needs-human (got ${receipt.outcome})`)
  }
  if (!github.postCheckRun) {
    throw new Error('approveNeedsHuman: github.postCheckRun not available')
  }
  const commitSha = (receipt as unknown as { commitSha?: string }).commitSha ?? ''
  await github.postCheckRun({
    status: 'completed',
    conclusion: 'success',
    headSha: commitSha,
    name: 'dsh-enterprise/needs-human',
    output: {
      title: 'Approved by TenantAdmin',
      summary: `Session ${receipt.sessionId} approved. Original receipt: ${receipt.hash}`,
    },
  })
  return { ...receipt, outcome: 'accepted' }
}

export { computeAggregates }

// ponytail: bench stubs for watchtower.bench.spec.ts — minimal in-memory, no Postgres
export const benchmarkRunEvents: Map<string, unknown> = new Map();
export function clearBenchmarkRunEvents(): void {
  benchmarkRunEvents.clear();
}
export async function emitBenchmarkEnvelope(envelope: any, pg?: { insertRunEvent?: (e: unknown) => Promise<void> }): Promise<void> {
  const id = envelope.runId ?? envelope.run_id ?? `bench-${Date.now()}`;
  benchmarkRunEvents.set(id, envelope);
  if (pg?.insertRunEvent) await pg.insertRunEvent(envelope);
}
type BenchmarkSuite = string;
export async function runNightlyBenchmarkJob(opts: {
  suite: BenchmarkSuite;
  runner: (suite: BenchmarkSuite) => Promise<Record<string, unknown>>;
  estimatedTokens?: number;
  maxCostUsd?: number;
  budgetStates?: Array<{ def: { limitCents: number }; spentCents: number }>;
  orgId?: string;
  projectId?: string;
  db?: { insertRunEvent?: (e: unknown) => Promise<void> };
}): Promise<Record<string, unknown>> {
  const estimatedCents = (opts.estimatedTokens ?? 0) * 0.1;
  const maxCents = (opts.maxCostUsd ?? Infinity) * 100;
  if (estimatedCents > maxCents) {
    return { blocked: true, reason: `estimatedCents ${estimatedCents} > maxCostUsd ${opts.maxCostUsd}` };
  }
  if (opts.budgetStates) {
    for (const b of opts.budgetStates) {
      if (b.spentCents + estimatedCents > b.def.limitCents) {
        return { blocked: true, reason: `hardBudgetBlock: ${b.spentCents + estimatedCents} > ${b.def.limitCents}` };
      }
    }
  }
  const res = await opts.runner(opts.suite);
  if (res === undefined) return { blocked: false };
  const runId = `bench-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const envelope: any = {
    runId,
    suite: opts.suite,
    orgId: opts.orgId ?? (res as any).orgId ?? 'org-bench',
    projectId: opts.projectId ?? (res as any).projectId ?? `proj-${opts.suite}`,
    cost: { usd: (res as any).costUsd ?? 0, cents: ((res as any).costUsd ?? 0) * 100 },
    phiSnapshot: { phi: (res as any).phi ?? 0, method: 'exact', cesHash: (res as any).cesHash ?? 'h' },
    ews: { variance: (res as any).variance, ac1: (res as any).ac1 },
    createdAt: new Date().toISOString(),
    ...res,
    runId,
    suite: opts.suite,
  };
  // ensure required fields for test
  envelope.cost = envelope.cost ?? { usd: (res as any).costUsd ?? 0, cents: ((res as any).costUsd ?? 0) * 100 };
  envelope.phiSnapshot = envelope.phiSnapshot ?? { phi: (res as any).phi ?? 0, method: 'exact', cesHash: 'h' };
  await emitBenchmarkEnvelope(envelope, opts.db as any);
  return { ...envelope, blocked: false, runId, suite: opts.suite };
}
