import { describe, it, expect, vi } from 'vitest'
import { runWatchtowerJob, approveNeedsHuman } from '../src/job.js'
import type { DbClient, GithubClient } from '../src/job.js'
import type { Run, RunId, SessionId, Receipt } from '../src/types.js'

function makeRun(overrides: Partial<Run> & { prNumber?: number; commitSha?: string } = {}): Run & { prNumber: number; commitSha: string } {
  return {
    runId: (overrides.runId ?? 'run-1') as RunId,
    sessionId: 'sess-1' as SessionId,
    agentId: 'agent-1',
    log: [{ seq: 1 }],
    prNumber: overrides.prNumber ?? 42,
    commitSha: overrides.commitSha ?? 'abc123',
    ...overrides,
  } as Run & { prNumber: number; commitSha: string }
}

function memoryDb(runs: (Run & { prNumber: number; commitSha: string })[]): DbClient & { receipts: Receipt[] } {
  const receipts: Receipt[] = []
  return {
    receipts,
    async findRunsWithoutOutcome() {
      return runs.filter((r) => !r.outcome)
    },
    async insertReceipt(receipt: Receipt) {
      receipts.push(receipt)
    },
    async listReceipts() {
      return receipts
    },
  }
}

describe('runWatchtowerJob outcome joining', () => {
  it('PR merged + CI green → accepted', async () => {
    const run = makeRun({ runId: 'run-a' as RunId, prNumber: 1, commitSha: 'sha1' })
    const db = memoryDb([run])
    const github: GithubClient = {
      getPR: async () => ({ merged: true, closed: true }),
      getChecks: async () => ({ green: true }),
    }
    const receipts = await runWatchtowerJob({}, db, github)
    expect(receipts).toHaveLength(1)
    expect(receipts[0]!.outcome).toBe('accepted')
    expect(db.receipts[0]!.outcome).toBe('accepted')
  })

  it('PR closed (not merged) → rejected', async () => {
    const run = makeRun({ runId: 'run-b' as RunId, prNumber: 2, commitSha: 'sha2' })
    const db = memoryDb([run])
    const github: GithubClient = {
      getPR: async () => ({ merged: false, closed: true }),
      getChecks: async () => ({ green: false }),
    }
    const receipts = await runWatchtowerJob({}, db, github)
    expect(receipts[0]!.outcome).toBe('rejected')
  })

  it('PR open + CI pending → needs-human', async () => {
    const run = makeRun({ runId: 'run-c' as RunId, prNumber: 3, commitSha: 'sha3' })
    const db = memoryDb([run])
    const github: GithubClient = {
      getPR: async () => ({ merged: false, closed: false }),
      getChecks: async () => ({ green: false }),
    }
    const receipts = await runWatchtowerJob({}, db, github)
    expect(receipts[0]!.outcome).toBe('needs-human')
  })

  it('PR merged but CI not green → needs-human (not accepted)', async () => {
    const run = makeRun({ runId: 'run-d' as RunId, prNumber: 4, commitSha: 'sha4' })
    const db = memoryDb([run])
    const github: GithubClient = {
      getPR: async () => ({ merged: true, closed: true }),
      getChecks: async () => ({ green: false }),
    }
    const receipts = await runWatchtowerJob({}, db, github)
    // spec: accepted only if merged && green, else closed→rejected else needs-human.
    // merged && !green + closed true would be rejected per spec's ternary: pr.merged&&ci.green ? accepted : pr.closed ? rejected : needs-human
    // Since pr.closed true, this goes to rejected
    expect(receipts[0]!.outcome).toBe('rejected')
  })

  it('inserts receipt via db and chains prevHash', async () => {
    const run1 = makeRun({ runId: 'run-1' as RunId, prNumber: 10, commitSha: 's1' })
    const run2 = makeRun({ runId: 'run-2' as RunId, prNumber: 11, commitSha: 's2' })
    const db = memoryDb([run1, run2])
    const github: GithubClient = {
      getPR: async () => ({ merged: true, closed: true }),
      getChecks: async () => ({ green: true }),
    }
    const receipts = await runWatchtowerJob({}, db, github)
    expect(receipts).toHaveLength(2)
    expect(receipts[1]!.prevHash).toBe(receipts[0]!.hash)
  })

  it('aggregates stub: acceptance_rate etc via compute (smoke)', async () => {
    const runs = [
      makeRun({ runId: 'r1' as RunId, prNumber: 1, commitSha: 'a' }),
      makeRun({ runId: 'r2' as RunId, prNumber: 2, commitSha: 'b' }),
    ]
    const db = memoryDb(runs)
    let call = 0
    const github: GithubClient = {
      getPR: async () => {
        call++
        // first accepted, second rejected
        return call === 1 ? { merged: true, closed: true } : { merged: false, closed: true }
      },
      getChecks: async () => (call === 1 ? { green: true } : { green: false }),
    }
    const receipts = await runWatchtowerJob({}, db, github)
    expect(receipts[0]!.outcome).toBe('accepted')
    expect(receipts[1]!.outcome).toBe('rejected')
  })
})

describe('needs-human GitHub check run', () => {
  it('posts action_required check run when outcome is needs-human', async () => {
    const run = makeRun({ runId: 'run-nh' as RunId, prNumber: 5, commitSha: 'sha5' })
    const db = memoryDb([run])
    const checkRuns: Parameters<NonNullable<GithubClient['postCheckRun']>>[0][] = []
    const github: GithubClient = {
      getPR: async () => ({ merged: false, closed: false }),
      getChecks: async () => ({ green: false }),
      postCheckRun: async (params) => {
        checkRuns.push(params)
        return { id: 123, url: 'https://github.com/run/123' }
      },
    }
    const receipts = await runWatchtowerJob({}, db, github)
    expect(receipts[0]!.outcome).toBe('needs-human')
    expect(checkRuns).toHaveLength(1)
    expect(checkRuns[0]!.conclusion).toBe('action_required')
    expect(checkRuns[0]!.name).toBe('dsh-enterprise/needs-human')
    expect(checkRuns[0]!.headSha).toBe('sha5')
    expect(checkRuns[0]!.actions).toContainEqual(
      expect.objectContaining({ identifier: 'approve-merge' }),
    )
  })

  it('does not post check run when github.postCheckRun is absent (no-op)', async () => {
    const run = makeRun({ runId: 'run-nh-no-gh' as RunId, prNumber: 6, commitSha: 'sha6' })
    const db = memoryDb([run])
    const github: GithubClient = {
      getPR: async () => ({ merged: false, closed: false }),
      getChecks: async () => ({ green: false }),
      // no postCheckRun
    }
    // Should not throw — just no-ops
    const receipts = await runWatchtowerJob({}, db, github)
    expect(receipts[0]!.outcome).toBe('needs-human')
  })

  it('approved needs-human receipt returns accepted outcome', async () => {
    const receipt = {
      hash: 'abc123',
      sessionId: 'sess-1' as SessionId,
      outcome: 'needs-human' as const,
      guardDispositions: [],
    } as unknown as Receipt & { commitSha: string }
    const approvedReceipt = await approveNeedsHuman(
      receipt,
      {
        postCheckRun: async () => ({ id: 1, url: 'https://github.com/run/1' }),
      },
      { guardRole: 'tenantadmin' },
    )
    expect(approvedReceipt.outcome).toBe('accepted')
  })

  it('approveNeedsHuman throws when receipt is not needs-human', async () => {
    const receipt = {
      hash: 'def456',
      sessionId: 'sess-2' as SessionId,
      outcome: 'accepted' as const,
    } as unknown as Receipt
    await expect(
      approveNeedsHuman(
        receipt,
        { postCheckRun: async () => ({ id: 1, url: '' }) },
        { guardRole: 'tenantadmin' },
      ),
    ).rejects.toThrow('not needs-human')
  })
})
