/**
 * MCP server — createMcpServer(ctx) using @modelcontextprotocol/sdk
 * Registers 5 tool groups (chains, gateway, watchtower, iit, guard).
 * P0: Stdio only (like basemind `basemind serve`). HTTP stub exported for P1.
 * @module @deepseek-ai/dsh-enterprise-mcp/server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { allTools, toolGroups } from './tools/index.js'

export type McpContext = {
  get?: (name: string) => unknown
  effect?: (name: string, fn: () => unknown) => unknown
  [k: string]: unknown
}

export function createMcpServer(ctx: McpContext) {
  const server = new McpServer({ name: '@deepseek-ai/dsh-enterprise-mcp', version: '0.1.0' })

  for (const tool of allTools) {
    // McpServer's registerTool expects zod-shaped inputSchema; we pass undefined
    // and handle validation inside handler. Cast to bypass strict zod type.
    const inputSchema = undefined as unknown as Record<string, unknown>
    // If tool has JSON schema object, convert to zod-like empty schema for registration.
    // P0: register with empty schema; handler validates required fields and throws
    // with parent_required etc. This keeps SDK dependency light (no zod in handler).
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inputSchema: inputSchema as any,
      },
      async (args: unknown) => {
        const a = (args ?? {}) as Record<string, unknown>
        try {
          const result = await tool.handler(a, ctx)
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }, null, 2) }],
            isError: true,
          }
        }
      },
    )
  }

  // advertise fixed capability (no listChanged, like facility)
  server.server.registerCapabilities({ tools: { listChanged: false } })

  return {
    server,
    tools: allTools,
    groups: toolGroups,
    /** Connect via stdio (P0). Returns the transport for caller to manage. */
    async connectStdio(): Promise<unknown> {
      const transport = new StdioServerTransport()
      await server.connect(transport as never)
      return transport
    },
    /** HTTP stub — P1 will use StreamableHTTPServerTransport. */
    async connectStreamableHttp(_opts?: unknown): Promise<never> {
      // Dynamically import to avoid hard dep on streamableHttp export existing in SDK ^1.0
      try {
        await import('@modelcontextprotocol/sdk/server/streamableHttp.js')
      } catch {}
      throw new Error('StreamableHTTPServerTransport not yet implemented (P1) — use connectStdio')
    },
  }
}

/** Convenience: create + connect stdio in one call (mirrors basemind serve). */
export async function startStdioServer(ctx: McpContext) {
  const mcp = createMcpServer(ctx)
  const transport = await mcp.connectStdio()
  return { mcp, transport }
}
