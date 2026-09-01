/**
 * Watchtower Cordis plugin — exposes generateReceipt/verifyChain/runWatchtowerJob
 * + real-time receipt collector for IIT guard events.
 * @module @deepseek-ai/dsh-enterprise-watchtower/plugin
 */

import { generateReceipt, verifyChain } from './receipts.js'
import { runWatchtowerJob } from './job.js'
import type { Receipt, Run } from './types.js'

export const name = 'dsh-enterprise:watchtower'
export const inject = ['sessions', 'audit', 'postgresPersistenceBackend', 'scheduler?'] as const

declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'session/end': { sessionId: string }
  }
}

// minimal scheduler type for ctx.scheduler.every
type Scheduler = { every(interval: string, fn: () => unknown): void }

type PolicyEvaluateEvent = {
  turn?: number
  step?: number
  callId?: string
  guards: readonly { guardId: string; disposition: string; phi?: number; reason?: string }[]
  finalDisposition: 'pass' | 'block'
  blockedBy?: string
  timestamp: number
  sessionId?: string
  runId?: string
  agentId?: string
  phi?: number
  cesHash?: string
}

interface SessionReceiptState {
  sessionId: string
  runId: string
  agentId: string
  guardDispositions: { guardId: string; disposition: 'pass' | 'block' | 'warn' }[]
  phiSnapshot: { phi: number; method: string; cesHash: string }
  outcome: Receipt['outcome']
  prevHash: string
}

const collector = new Map<string, SessionReceiptState>()
let genesisHash = 'genesis'

function outcomeFromDisposition(finalDisposition: 'pass' | 'block'): Receipt['outcome'] {
  return finalDisposition === 'pass' ? 'accepted' : 'rejected'
}

function upsertSession(ev: PolicyEvaluateEvent): SessionReceiptState {
  const sessionId = ev.sessionId ?? 'default'
  const runId = ev.runId ?? `run-${sessionId}-${Date.now()}`
  const agentId = ev.agentId ?? 'anonymous'
  const existing = collector.get(sessionId)
  if (existing) return existing
  const state: SessionReceiptState = {
    sessionId,
    runId,
    agentId,
    guardDispositions: [],
    phiSnapshot: { phi: 0, method: 'exact', cesHash: 'none' },
    outcome: outcomeFromDisposition(ev.finalDisposition),
    prevHash: genesisHash,
  }
  collector.set(sessionId, state)
  return state
}

function onPolicyEvaluate(ev: PolicyEvaluateEvent): void {
  const state = upsertSession(ev)
  for (const g of ev.guards ?? []) {
    const disp = g.disposition as 'pass' | 'block' | 'warn'
    const idx = state.guardDispositions.findIndex((d) => d.guardId === g.guardId)
    if (idx >= 0) {
      state.guardDispositions[idx] = { guardId: g.guardId, disposition: disp }
    } else {
      state.guardDispositions.push({ guardId: g.guardId, disposition: disp })
    }
  }
  if (typeof ev.phi === 'number') {
    state.phiSnapshot = { phi: ev.phi, method: 'exact', cesHash: ev.cesHash ?? 'none' }
  }
  state.outcome = outcomeFromDisposition(ev.finalDisposition)
}

/**
 * Synchronous flush — used for shutdown path where async DB lookup is not available.
 * DB write is fire-and-forget; uses stored prevHash or module genesisHash.
 */
function flushSessionReceiptSync(ctx: any, sessionId: string): Receipt | null {
  const state = collector.get(sessionId)
  if (!state) return null
  const run: Run = {
    runId: state.runId as Run['runId'],
    sessionId: state.sessionId as Run['sessionId'],
    agentId: state.agentId,
    log: {},
    guardDispositions: state.guardDispositions,
    outcome: state.outcome,
    builtAt: Date.now(),
    builder: { gitSha: 'unknown', crateVersions: {} },
  }
  const prevHash = state.prevHash ?? genesisHash
  const receipt = generateReceipt(run, state.outcome, prevHash, state.phiSnapshot)

  const dbBackend = ctx.get('postgresPersistenceBackend') as {
    insertReceipt?: (r: Receipt) => Promise<void>
    setGenesisHash?: (h: string) => Promise<void>
  } | undefined
  if (dbBackend?.insertReceipt) {
    dbBackend.insertReceipt(receipt).catch(() => {})
    dbBackend.setGenesisHash?.(receipt.hash).catch(() => {})
  } else {
    genesisHash = receipt.hash
  }

  collector.delete(sessionId)
  return receipt
}

async function flushSessionReceipt(
  ctx: any,
  sessionId: string,
  prevHashOverride?: string,
): Promise<Receipt | null> {
  const state = collector.get(sessionId)
  if (!state) return null
  const run: Run = {
    runId: state.runId as Run['runId'],
    sessionId: state.sessionId as Run['sessionId'],
    agentId: state.agentId,
    log: {},
    guardDispositions: state.guardDispositions,
    outcome: state.outcome,
    builtAt: Date.now(),
    builder: { gitSha: 'unknown', crateVersions: {} },
  }

  let resolvedPrevHash = prevHashOverride ?? state.prevHash
  if (!resolvedPrevHash) {
    const backend = ctx.get('postgresPersistenceBackend') as {
      getLastReceiptHash?: () => Promise<string>
    } | undefined
    if (backend?.getLastReceiptHash) {
      resolvedPrevHash = await backend.getLastReceiptHash()
    }
    resolvedPrevHash ??= genesisHash
  }

  const receipt = generateReceipt(run, state.outcome, resolvedPrevHash!, state.phiSnapshot)

  const dbBackend = ctx.get('postgresPersistenceBackend') as {
    insertReceipt?: (r: Receipt) => Promise<void>
    setGenesisHash?: (h: string) => Promise<void>
  } | undefined
  if (dbBackend?.insertReceipt) {
    await dbBackend.insertReceipt(receipt)
    if (dbBackend.setGenesisHash) {
      await dbBackend.setGenesisHash(receipt.hash)
    }
  } else {
    genesisHash = receipt.hash
  }

  collector.delete(sessionId)
  return receipt
}

export function apply(ctx: any): void {
  const self = {
    generateReceipt,
    verifyChain,
    runWatchtowerJob,
    flushSessionReceipt: async (sessionId: string, prevHashOverride?: string) =>
      flushSessionReceipt(ctx, sessionId, prevHashOverride),
    collectorSize: () => collector.size,
    collectorEntries: () => [...collector.keys()],
  }
  ctx.effect('watchtower', () => self)

  ctx.on('policy/evaluate', (ev: PolicyEvaluateEvent) => {
    onPolicyEvaluate(ev)
  })

  ctx.on('session/end' as any, (ev: { sessionId: string }) => {
    const receipt = flushSessionReceiptSync(ctx, ev.sessionId)
    if (receipt) {
      ;(ctx.emit as (event: string, payload: unknown) => void)('watchtower/receipt', receipt)
    }
    collector.delete(ev.sessionId)
  })

  process.on('SIGTERM', () => {
    for (const sessionId of collector.keys()) {
      const receipt = flushSessionReceiptSync(ctx, sessionId)
      if (receipt) {
        try {
          ;(ctx.emit as (event: string, payload: unknown) => void)('watchtower/receipt', receipt)
        } catch {}
      }
      collector.delete(sessionId)
    }
  })

  const scheduler: Scheduler | undefined = ctx.scheduler as Scheduler | undefined
  if (scheduler?.every) {
    scheduler.every('1h', () => {
      const db = ctx.db ?? ctx.sessions?.db ?? {
        findRunsWithoutOutcome: async () => [],
        insertReceipt: async () => {},
      }
      const github = ctx.github ?? {
        getPR: async () => ({ merged: false, closed: false }),
        getChecks: async () => ({ green: false }),
      }
      return runWatchtowerJob(ctx, db, github)
    })
  }
}
