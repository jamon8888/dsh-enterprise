import { describe, it, expect } from 'vitest'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from '../src/server.js'
import { allTools, toolGroups, chainTools } from '../src/tools/index.js'
import { PARENT_REQUIRED } from '../src/tools/chains.js'

function mockCtx(overrides: Record<string, unknown> = {}) {
  return {
    get: (name: string) => overrides[name],
    effect: (_name: string, fn: () => unknown) => fn(),
  }
}

describe('mcp server registers 5 tool groups', () => {
  it('has 5 groups and 9 tools total', () => {
    const ctx = mockCtx()
    const mcp = createMcpServer(ctx as never)
    expect(Object.keys(mcp.groups)).toEqual(['chains', 'gateway', 'watchtower', 'iit', 'guard'])
    expect(Object.keys(mcp.groups).length).toBe(5)
    expect(mcp.tools.length).toBe(9)
    expect(allTools.length).toBe(9)
    expect(toolGroups.chains.length).toBe(4)
    expect(toolGroups.gateway.length).toBe(1)
    expect(toolGroups.watchtower.length).toBe(2)
    expect(toolGroups.iit.length).toBe(1)
    expect(toolGroups.guard.length).toBe(1)
  })

  it('tool names match spec', () => {
    const names = allTools.map((t) => t.name).sort()
    expect(names).toEqual([
      'chain.createDecision',
      'chain.createSignal',
      'chain.createTask',
      'chain.createVerification',
      'gateway.issueVirtualKey',
      'guard.run',
      'iit.calculatePhi',
      'watchtower.generateReceipt',
      'watchtower.verifyChain',
    ].sort())
  })
})

describe('stdio transport instantiates', () => {
  it('StdioServerTransport can be constructed', () => {
    const t = new StdioServerTransport()
    expect(t).toBeDefined()
    expect(typeof (t as unknown as { start: unknown }).start).toBe('function')
  })

  it('createMcpServer connectStdio returns transport (without actually starting stdin)', async () => {
    const ctx = mockCtx()
    const mcp = createMcpServer(ctx as never)
    // We test that the method exists and would attempt connect — but actually
    // calling connectStdio would try to read stdin. Instead verify shape.
    expect(typeof mcp.connectStdio).toBe('function')
    expect(typeof mcp.connectStreamableHttp).toBe('function')
    await expect(mcp.connectStreamableHttp()).rejects.toThrow(/P1|not yet/i)
  })
})

describe('tool chain.createSignal validates S→D→T→V', () => {
  it('PARENT_REQUIRED discipline is S→D→T→V', () => {
    expect(PARENT_REQUIRED.S).toEqual([])
    expect(PARENT_REQUIRED.D).toEqual(['S'])
    expect(PARENT_REQUIRED.T).toEqual(['D'])
    expect(PARENT_REQUIRED.V).toEqual(['T'])
  })

  it('chain.createSignal succeeds without parent', async () => {
    const tool = chainTools.find((t) => t.name === 'chain.createSignal')!
    const ctx = mockCtx()
    const res = await tool.handler({ payload: { title: 's1' } }, ctx)
    expect(res).toMatchObject({ ok: true, type: 'S' })
  })

  it('chain.createDecision requires signalId (parent S)', async () => {
    const tool = chainTools.find((t) => t.name === 'chain.createDecision')!
    const ctx = mockCtx()
    await expect(tool.handler({ payload: {} }, ctx)).rejects.toThrow(/signalId|parent_required/i)
    const res = await tool.handler({ signalId: 'S-1', payload: { decision: 'd1' } }, ctx)
    expect(res).toMatchObject({ ok: true, type: 'D', parent: 'S-1' })
  })

  it('chain.createDecision rejects wrong parentType', async () => {
    const tool = chainTools.find((t) => t.name === 'chain.createDecision')!
    const ctx = mockCtx()
    await expect(tool.handler({ signalId: 'X-1', parentType: 'T', payload: {} }, ctx)).rejects.toThrow(/parent_required/i)
  })

  it('chain.createTask requires decisionId (parent D) and rejects wrong parent', async () => {
    const tool = chainTools.find((t) => t.name === 'chain.createTask')!
    const ctx = mockCtx()
    await expect(tool.handler({ payload: {} }, ctx)).rejects.toThrow(/decisionId|parent_required/i)
    await expect(tool.handler({ decisionId: 'D-1', parentType: 'S', payload: {} }, ctx)).rejects.toThrow(/parent_required/i)
    const res = await tool.handler({ decisionId: 'D-1', payload: {} }, ctx)
    expect(res).toMatchObject({ ok: true, type: 'T' })
  })

  it('chain.createVerification requires taskId (parent T)', async () => {
    const tool = chainTools.find((t) => t.name === 'chain.createVerification')!
    const ctx = mockCtx()
    await expect(tool.handler({ payload: {} }, ctx)).rejects.toThrow(/taskId|parent_required/i)
    const res = await tool.handler({ taskId: 'T-1', payload: {} }, ctx)
    expect(res).toMatchObject({ ok: true, type: 'V' })
  })

  it('full S→D→T→V chain links parents correctly', async () => {
    const ctx = mockCtx()
    const sig = await chainTools.find((t) => t.name === 'chain.createSignal')!.handler({ payload: { s: 1 } }, ctx) as { type: string }
    expect(sig.type).toBe('S')
    const dec = await chainTools.find((t) => t.name === 'chain.createDecision')!.handler({ signalId: 'sig1', payload: {} }, ctx) as { type: string; parent: string }
    expect(dec.parent).toBe('sig1')
    const task = await chainTools.find((t) => t.name === 'chain.createTask')!.handler({ decisionId: 'dec1', payload: {} }, ctx) as { type: string }
    expect(task.type).toBe('T')
    const ver = await chainTools.find((t) => t.name === 'chain.createVerification')!.handler({ taskId: 'task1', payload: {} }, ctx) as { type: string }
    expect(ver.type).toBe('V')
  })

  it('delegates to ctx.get(chains) when present', async () => {
    const spy = { createSignal: async (a: unknown) => ({ delegated: true, a }) }
    const ctx = mockCtx({ chains: spy })
    const tool = chainTools.find((t) => t.name === 'chain.createSignal')!
    const res = await tool.handler({ payload: { x: 1 } }, ctx as never)
    expect(res).toMatchObject({ delegated: true })
  })
})
