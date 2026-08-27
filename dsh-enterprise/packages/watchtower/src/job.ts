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

export type GithubClient = {
  getPR(prNumber: number): Promise<GithubPR>
  getChecks(commitSha: string): Promise<GithubChecks>
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
    prevHash = receipt.hash

    // stub aggregate compute (not persisted — placeholder for Postgres run_events aggregate)
    void computeAggregates(receipts)
  }

  return receipts
}

export { computeAggregates }
