/**
 * MCP tool: gateway.issueVirtualKey — wraps ctx.get('gateway')
 * @module @deepseek-ai/dsh-enterprise-mcp/tools/gateway
 */
import type { ToolDefinition } from './chains.js'

function getGateway(ctx: unknown): unknown {
  try { return (ctx as { get?: (n: string) => unknown }).get?.('gateway') } catch { return undefined }
}

export const gatewayTools: ToolDefinition[] = [
  {
    name: 'gateway.issueVirtualKey',
    description: 'Issue a short-TTL virtual key (project/run/agent scoped). Wraps ctx.get(\'gateway\').',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        scopes: { type: 'array', items: { type: 'string' } },
        ttl: { type: 'number', description: 'TTL seconds' },
        budgetUsd: { type: 'number' },
      },
      required: ['projectId'],
    },
    handler: async (args, ctx) => {
      if (!args.projectId) throw new Error('gateway.issueVirtualKey: projectId required')
      const gateway = getGateway(ctx) as { issueVirtualKey?: (a: unknown) => Promise<unknown>; captureEnvelope?: unknown } | undefined
      if (gateway?.issueVirtualKey) return gateway.issueVirtualKey(args)
      // P0 fallback: return stub key
      return { ok: true, keyId: `vk_${String(args.projectId).slice(0, 8)}_${Date.now()}`, projectId: args.projectId, scopes: args.scopes ?? [], ttl: args.ttl ?? 3600 }
    },
  },
]
