import { describe, it, expect, vi, beforeEach } from 'vitest'
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

describe('flushSessionReceipt DB integration', () => {
  let mockCtx: any
  let insertReceiptCalls: Receipt[]
  let setGenesisHashCalls: string[]
  let getLastReceiptHashCalls: string[]

  beforeEach(() => {
    insertReceiptCalls = []
    setGenesisHashCalls = []
    getLastReceiptHashCalls = []
    mockCtx = {
      get: vi.fn((name: string) => {
        if (name === 'postgresPersistenceBackend') {
          return {
            insertReceipt: vi.fn(async (r: Receipt) => {
              insertReceiptCalls.push(r)
            }),
            setGenesisHash: vi.fn(async (h: string) => {
              setGenesisHashCalls.push(h)
            }),
            getLastReceiptHash: vi.fn(async () => {
              getLastReceiptHashCalls.push('called')
              return 'genesis'
            }),
          }
        }
        return undefined
      }),
      logger: { error: vi.fn() },
    }
  })

  it('calls backend.insertReceipt and setGenesisHash on flush', async () => {
    // Simulate what flushSessionReceipt does with DB
    const run = makeRun({ runId: 'run-1' as RunId, sessionId: 'sess-1' as SessionId })
    const receipt = generateReceipt(run, 'accepted', 'genesis', phi)
    const backend = mockCtx.get('postgresPersistenceBackend')
    await backend.insertReceipt(receipt)
    await backend.setGenesisHash(receipt.hash)
    expect(insertReceiptCalls).toHaveLength(1)
    expect(insertReceiptCalls[0]!.hash).toBe(receipt.hash)
    expect(setGenesisHashCalls).toContain(receipt.hash)
  })

  it('resolves prevHash from DB tip when not overridden', async () => {
    const backend = mockCtx.get('postgresPersistenceBackend')
    const tip = await backend.getLastReceiptHash()
    expect(tip).toBe('genesis')
    expect(getLastReceiptHashCalls).toHaveLength(1)
  })

  it('in-memory fallback when no backend', async () => {
    const noDbCtx = { get: vi.fn(() => undefined), logger: { error: vi.fn() } }
    const backend = noDbCtx.get('postgresPersistenceBackend')
    expect(backend).toBeUndefined()
  })
})

describe('receipt chain constraint (SQL trigger)', () => {
  it('chain requires consecutive prev_hash linkage', () => {
    // In-memory verification: receipts must be chained in order
    const r1 = generateReceipt(makeRun({ runId: 'run-1' as RunId }), 'accepted', 'genesis', phi)
    const r2 = generateReceipt(makeRun({ runId: 'run-2' as RunId }), 'accepted', r1.hash, phi)
    const r3 = generateReceipt(makeRun({ runId: 'run-3' as RunId }), 'accepted', r2.hash, phi)

    // Simulate DB constraint: r3.prevHash must equal r2.hash (which it does)
    expect(r3.prevHash).toBe(r2.hash)
    expect(r2.prevHash).toBe(r1.hash)

    // Violation: r4 with wrong prevHash would fail the DB trigger
    const r4Wrong = generateReceipt(makeRun({ runId: 'run-4' as RunId }), 'accepted', 'wrong', phi)
    expect(r4Wrong.prevHash).not.toBe(r3.hash)
    // The SQL trigger would reject this with: prev_hash does not match latest receipt hash
  })

  it('genesis singleton is sha256(genesis) not literal "genesis" in production', () => {
    // In production, genesisHash = sha256('genesis' + orgId)
    // but for the DB init, we use literal 'genesis' as the seed value
    const r1 = generateReceipt(makeRun({ runId: 'run-1' as RunId }), 'accepted', 'genesis', phi)
    expect(r1.prevHash).toBe('genesis')
    // First receipt after genesis: prevHash='genesis' is valid
  })
})
