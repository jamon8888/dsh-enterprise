/**
 * Cordis plugin for MCP server.
 * @module @deepseek-ai/dsh-enterprise-mcp/plugin
 */

import { createMcpServer } from './server.js'

export const name = 'dsh-enterprise:mcp'
export const inject = ['chains', 'gateway', 'watchtower', 'sessions'] as const

export function apply(ctx: unknown): unknown {
  const c = ctx as { effect: (name: string, fn: () => unknown) => unknown }
  return c.effect('mcpEnterprise', () => createMcpServer(c as never))
}
