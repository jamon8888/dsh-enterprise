import { describe, it, expect } from 'vitest'
import { canonicalJson, sha256Hex, hashReceiptWithoutHash, generateReceipt, verifyChain } from '../src/receipts.js'
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

describe('canonicalJson', () => {
  it('sorts keys deterministically', () => {
    const a = canonicalJson({ b: 2, a: 1 })
    const b = canonicalJson({ a: 1, b: 2 })
    expect(a).toBe(b)
    expect(a).toBe('{"a":1,"b":2}')
  })

  it('sorts nested keys', () => {
    const obj = { z: { b: 2, a: 1 }, a: 1 }
    expect(canonicalJson(obj)).toBe('{"a":1,"z":{"a":1,"b":2}}')
  })
})

describe('sha256Hex', () => {
  it('is deterministic', () => {
    expect(sha256Hex('hello')).toBe(sha256Hex('hello'))
    expect(sha256Hex('hello')).not.toBe(sha256Hex('world'))
  })
})

describe('hashReceiptWithoutHash', () => {
  it('is deterministic', () => {
    const run = makeRun()
    const r1 = generateReceipt(run, 'accepted', 'genesis', phi)
    const { hash: _h1, ...without1 } = r1
    const { hash: _h2, ...without2 } = generateReceipt(run, 'accepted', 'genesis', phi)
    // remove hash to get Omit<Receipt,'hash'>
    expect(hashReceiptWithoutHash(without1 as Omit<Receipt, 'hash'>)).toBe(hashReceiptWithoutHash(without2 as Omit<Receipt, 'hash'>))
  })
})

describe('generateReceipt hash chain', () => {
  it('prevHash === prev.hash', () => {
    const run1 = makeRun({ runId: 'run-1' as RunId, log: [{ seq: 1 }] })
    const run2 = makeRun({ runId: 'run-2' as RunId, log: [{ seq: 2 }] })
    const r1 = generateReceipt(run1, 'accepted', 'genesis', phi)
    const r2 = generateReceipt(run2, 'accepted', r1.hash, phi)
    expect(r2.prevHash).toBe(r1.hash)
    expect(verifyChain([r1, r2])).toBe(true)
  })

  it('computes logHash from run.log', () => {
    const run = makeRun({ log: [{ a: 1 }] })
    const r = generateReceipt(run, 'accepted', 'genesis', phi)
    expect(r.logHash).toBe(sha256Hex(canonicalJson(run.log)))
  })
})

describe('verifyChain tamper detection', () => {
  it('fails when receipt.hash is altered', () => {
    const run = makeRun()
    const r1 = generateReceipt(run, 'accepted', 'genesis', phi)
    const r2 = generateReceipt(makeRun({ runId: 'run-2' as RunId }), 'accepted', r1.hash, phi)
    const tampered = { ...r2, hash: 'deadbeef' }
    expect(verifyChain([r1, tampered as Receipt])).toBe(false)
  })

  it('fails when prevHash breaks chain', () => {
    const r1 = generateReceipt(makeRun({ runId: 'run-1' as RunId }), 'accepted', 'genesis', phi)
    const r2 = generateReceipt(makeRun({ runId: 'run-2' as RunId }), 'accepted', r1.hash, phi)
    const broken = { ...r2, prevHash: 'wrong' }
    // recompute hash so content hash still passes, but linkage fails — we tamper prevHash without recomputing hash
    // To keep content hash valid, we need to recompute hash for broken prevHash — craft a valid hash but wrong linkage
    const { hash: _old, ...without } = broken as Receipt
    const newHash = hashReceiptWithoutHash(without as Omit<Receipt, 'hash'>)
    const brokenValidHash = { ...without, hash: newHash } as Receipt
    expect(verifyChain([r1, brokenValidHash])).toBe(false)
  })

  it('empty chain is valid', () => {
    expect(verifyChain([])).toBe(true)
  })

  it('single receipt verifies', () => {
    const r = generateReceipt(makeRun(), 'needs-human', 'genesis', phi)
    expect(verifyChain([r])).toBe(true)
  })
})
