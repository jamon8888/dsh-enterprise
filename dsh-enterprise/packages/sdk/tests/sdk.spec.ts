import { describe, it, expect } from 'vitest'
import { createEnterprise } from '../src/client.ts'
import { SessionId, RunId, ChainId } from '../src/types.ts'

describe('createEnterprise', () => {
  it('returns object with chains.createSignal function', async () => {
    const ent = createEnterprise({ profile: 'enterprise' })
    expect(typeof ent.chains.createSignal).toBe('function')
    const r = await ent.chains.createSignal({ source: 'test', evidence_refs: [] })
    expect(r.chainId).toBeDefined()
  })

  it('returns gateway.issueVirtualKey function', () => {
    const ent = createEnterprise({ profile: 'enterprise' })
    expect(typeof ent.gateway.issueVirtualKey).toBe('function')
  })

  it('branded SessionId cast', () => {
    const sid = SessionId('test')
    expect(sid).toBe('test')
    // branded types are string-compatible
    const sid2: string = sid as unknown as string
    expect(sid2).toBe('test')

    const rid = RunId('run-1')
    expect(rid).toBe('run-1')

    const cid = ChainId('chain-1')
    expect(cid).toBe('chain-1')
  })

  it('delegates to cordisCtx when provided', async () => {
    const mockCtx = {
      get: (name: string) => {
        if (name === 'chains') return { createSignal: async () => ({ chainId: 'S-mock' as unknown as ChainId, signal: { mock: true } }) }
        if (name === 'gateway') return { issueVirtualKey: async () => ({ key: 'mock-key', expiresAt: 999 }) }
        return undefined
      },
    } as unknown as import('@deepseek-ai/cordis').Context

    const ent = createEnterprise({ profile: 'enterprise', cordisCtx: mockCtx })
    const sig = await ent.chains.createSignal({ source: 'x', evidence_refs: [] })
    expect((sig as { chainId: string }).chainId).toBe('S-mock')
    const k = await ent.gateway.issueVirtualKey({ projectId: 'p1' })
    expect(k.key).toBe('mock-key')
  })

  it('exposes watchtower and iit', async () => {
    const ent = createEnterprise({ profile: 'enterprise' })
    expect(typeof ent.watchtower.generateReceipt).toBe('function')
    expect(typeof ent.watchtower.verifyChain).toBe('function')
    expect(typeof ent.iit.calculatePhi).toBe('function')
    expect(typeof ent.iit.cuspFit).toBe('function')
    expect(typeof ent.iit.ews).toBe('function')

    const receipt = await ent.watchtower.generateReceipt(
      { runId: RunId('run-1'), sessionId: SessionId('sess-1'), agentId: 'a1', log: [{ seq: 1 }] },
      'accepted',
    )
    expect(receipt.runId).toBe('run-1')
    expect(receipt.hash).toBeDefined()

    const phi = await ent.iit.calculatePhi({ n: 2 })
    expect(typeof phi.phi).toBe('number')

    const cusp = await ent.iit.cuspFit([1, 2, 3])
    expect(typeof cusp.alpha).toBe('number')

    const e = await ent.iit.ews([1, 2, 3, 2, 1])
    expect(typeof e.variance).toBe('number')
  })
})
