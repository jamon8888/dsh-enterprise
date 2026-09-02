/**
 * MCP tool: guard.run — wraps ctx.get('guards-iit') / ctx.get('iitGuards')
 * @module @deepseek-ai/dsh-enterprise-mcp/tools/guard
 */
import type { ToolDefinition } from './chains.js'

function getGuards(ctx: unknown): unknown {
  try {
    const g = (ctx as { get?: (n: string) => unknown })
    return g.get?.('guards-iit') ?? g.get?.('iitGuards') ?? g.get?.('guards') ?? undefined
  } catch { return undefined }
}

export const guardTools: ToolDefinition[] = [
  {
    name: 'guard.run',
    description: 'Run IIT guards against current event. Wraps ctx.get(\'guards-iit\').',
    inputSchema: {
      type: 'object',
      properties: {
        guardId: { type: 'string', description: 'Guard id (phi-threshold, ces-fingerprint, etc.) or "all"' },
        event: { type: 'object' },
        tpm: { type: 'object' },
        state: { type: 'number' },
      },
    },
    handler: async (args, ctx) => {
      const guards = getGuards(ctx) as {
        run?: (id: string, ev: unknown) => Promise<unknown>
        calculatePhi?: (tpm: unknown, state: number) => Promise<unknown>
      } | undefined
      const guardId = (args.guardId as string) ?? 'phi-threshold'
      const ev = args.event ?? { tpm: args.tpm, state: args.state }
      if (guards?.run) return guards.run(guardId, ev)
      if (guards?.calculatePhi && (args.tpm !== undefined || (ev as { tpm?: unknown }).tpm !== undefined)) {
        const tpm = args.tpm ?? (ev as { tpm?: unknown }).tpm
        const state = (args.state as number) ?? (ev as { state?: number }).state ?? 0
        const phi = await guards.calculatePhi(tpm, state)
        return { disposition: 'pass', phi }
      }
      // stub: no guards installed
      return { disposition: 'pass', note: 'no guards-iit service — stub pass' }
    },
  },
]
