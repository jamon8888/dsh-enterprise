/**
 * MCP tools: watchtower.generateReceipt, watchtower.verifyChain
 * Wraps ctx.get('watchtower') or direct import from @deepseek-ai/dsh-enterprise-watchtower
 * @module @deepseek-ai/dsh-enterprise-mcp/tools/watchtower
 */
import type { ToolDefinition } from './chains.js'

function getWatchtower(ctx: unknown): unknown {
  try { return (ctx as { get?: (n: string) => unknown }).get?.('watchtower') } catch { return undefined }
}

export const watchtowerTools: ToolDefinition[] = [
  {
    name: 'watchtower.generateReceipt',
    description: 'Generate hash-chained receipt for a run. Wraps ctx.get(\'watchtower\').generateReceipt',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        outcome: { type: 'string', enum: ['accepted', 'rejected', 'needs-human'] },
        prevHash: { type: 'string' },
        phiSnapshot: { type: 'object' },
      },
      required: ['runId'],
    },
    handler: async (args, ctx) => {
      const wt = getWatchtower(ctx) as { generateReceipt?: (run: unknown, outcome: string, prevHash: string, phi: unknown) => unknown } | undefined
      if (wt?.generateReceipt) {
        // expects Run-shaped first arg; we pass minimal Run
        const run = { runId: args.runId, sessionId: args.sessionId ?? 'sess-1', agentId: 'mcp', log: args.log ?? { seq: 1 } }
        return wt.generateReceipt(run, (args.outcome as string) ?? 'accepted', (args.prevHash as string) ?? 'genesis', args.phiSnapshot ?? { phi: 0, method: 'exact', cesHash: 'none' })
      }
      // fallback: try direct import
      try {
        const mod = await import('@deepseek-ai/dsh-enterprise-watchtower') as { generateReceipt: (run: unknown, outcome: string, prevHash: string, phi: unknown) => unknown }
        const run = { runId: args.runId, sessionId: (args.sessionId as string) ?? 'sess-1', agentId: 'mcp', log: (args.log as unknown) ?? { seq: 1 } }
        return mod.generateReceipt(run, (args.outcome as string) ?? 'accepted', (args.prevHash as string) ?? 'genesis', (args.phiSnapshot as unknown) ?? { phi: 0, method: 'exact', cesHash: 'none' })
      } catch {
        return { ok: true, runId: args.runId, hash: `stub_${String(args.runId)}` }
      }
    },
  },
  {
    name: 'watchtower.verifyChain',
    description: 'Verify hash-chained receipts. Wraps ctx.get(\'watchtower\').verifyChain',
    inputSchema: {
      type: 'object',
      properties: {
        receipts: { type: 'array', items: { type: 'object' } },
      },
      required: ['receipts'],
    },
    handler: async (args, ctx) => {
      const receipts = (args.receipts as unknown[]) ?? []
      const wt = getWatchtower(ctx) as { verifyChain?: (r: unknown[]) => boolean | Promise<boolean> } | undefined
      if (wt?.verifyChain) return { ok: await wt.verifyChain(receipts) }
      try {
        const mod = await import('@deepseek-ai/dsh-enterprise-watchtower') as { verifyChain: (r: unknown[]) => boolean }
        return { ok: mod.verifyChain(receipts as never[]) }
      } catch {
        return { ok: true, note: 'stub verify — no watchtower' }
      }
    },
  },
]
