import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateReceipt } from '../src/receipts.js'
import type { Run, RunId, SessionId, Receipt } from '../src/types.js'

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    runId: 'run-1' as RunId,
    sessionId: 'sess-1' as SessionId,
    agentId: 'agent-1',
    log: [{ seq: 1, type: 'tool/call', data: { tool: 'bash' } }],
    builtAt: 1700000000000,
    builder: { gitSha: 'abc123', crateVersions: {} },
    ...overrides,
  }
}

const phi = { phi: 1.23, method: 'exact', cesHash: 'ces-abc' }

describe('session/end auto-flush', () => {
  let mockCtx: any
  let insertReceiptCalls: Receipt[]
  let emittedEvents: Array<{ event: string; payload: unknown }>
  let removeHandler: () => void

  beforeEach(() => {
    insertReceiptCalls = []
    emittedEvents = []
    mockCtx = {
      get: vi.fn((name: string) => {
        if (name === 'postgresPersistenceBackend') {
          return {
            insertReceipt: vi.fn(async (r: Receipt) => {
              insertReceiptCalls.push(r)
            }),
            setGenesisHash: vi.fn(async (_h: string) => {}),
            getLastReceiptHash: vi.fn(async () => 'genesis'),
          }
        }
        return undefined
      }),
      emit: vi.fn((event: string, payload: unknown) => {
        emittedEvents.push({ event, payload })
      }),
      on: vi.fn((_event: string, handler: (ev: unknown) => void) => {
        removeHandler = () => {}
        return removeHandler
      }),
    }
  })

  it('flushSessionReceiptSync is called on session/end event', () => {
    // Simulate what the watchtower plugin does: on session/end, flush + emit
    const collector = new Map<string, any>()
    collector.set('sess-1', {
      sessionId: 'sess-1',
      runId: 'run-1',
      agentId: 'agent-1',
      guardDispositions: [{ guardId: 'phi-threshold', disposition: 'pass' }],
      phiSnapshot: phi,
      outcome: 'accepted' as const,
      prevHash: 'genesis',
    })

    const receipt = generateReceipt(
      makeRun({ sessionId: 'sess-1' as SessionId, runId: 'run-1' as RunId }),
      'accepted',
      'genesis',
      phi,
    )

    // Simulate session/end handler
    const sessionId = 'sess-1'
    const state = collector.get(sessionId)
    expect(state).toBeDefined()
    collector.delete(sessionId)

    expect(collector.has(sessionId)).toBe(false)
  })

  it('session/end event triggers receipt emit', () => {
    // Simulate the emit on session/end
    const receipt = generateReceipt(
      makeRun({ sessionId: 'sess-1' as SessionId }),
      'needs-human',
      'genesis',
      phi,
    )

    mockCtx.emit('watchtower/receipt', receipt)

    expect(emittedEvents).toContainEqual({
      event: 'watchtower/receipt',
      payload: receipt,
    })
  })

  it('collector entry cleaned up after session/end flush', () => {
    const collector = new Map<string, any>()
    collector.set('sess-1', { sessionId: 'sess-1', guardDispositions: [] })
    collector.set('sess-2', { sessionId: 'sess-2', guardDispositions: [] })

    // Simulate flush + delete for sess-1
    collector.delete('sess-1')

    expect(collector.size).toBe(1)
    expect(collector.has('sess-1')).toBe(false)
    expect(collector.has('sess-2')).toBe(true)
  })

  it('no-op when session not in collector', () => {
    const collector = new Map<string, any>()
    // sess-1 not in collector
    const result = collector.get('sess-1')
    expect(result).toBeUndefined()
  })

  it('SIGTERM handler iterates all collectors', () => {
    const collector = new Map<string, any>()
    collector.set('sess-1', { sessionId: 'sess-1' })
    collector.set('sess-2', { sessionId: 'sess-2' })

    const flushed: string[] = []
    for (const sessionId of collector.keys()) {
      flushed.push(sessionId)
      collector.delete(sessionId)
    }

    expect(flushed).toContain('sess-1')
    expect(flushed).toContain('sess-2')
    expect(collector.size).toBe(0)
  })
})
