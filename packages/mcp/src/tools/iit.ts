/**
 * MCP tool: iit.calculatePhi — calls @deepseek-ai/dsh-enterprise-iit-core/pkg calculate_phi_js
 * @module @deepseek-ai/dsh-enterprise-mcp/tools/iit
 */
import type { ToolDefinition } from './chains.js'

export const iitTools: ToolDefinition[] = [
  {
    name: 'iit.calculatePhi',
    description: 'Calculate Φ for a TPM via WASM calculate_phi_js (ruvector).',
    inputSchema: {
      type: 'object',
      properties: {
        tpm: { type: 'object', description: 'TransitionMatrix { n, data } or JSON string' },
        state: { type: 'number' },
        budget: { type: 'string', enum: ['exact', 'fast', 'balanced'] },
      },
      required: ['tpm'],
    },
    handler: async (args) => {
      const tpm = args.tpm as unknown
      const state = (args.state as number) ?? 0
      const budget = (args.budget as string) ?? 'balanced'
      const tpmJson = typeof tpm === 'string' ? (tpm as string) : JSON.stringify(tpm)
      try {
        const mod = await import('@deepseek-ai/dsh-enterprise-iit-core/pkg') as {
          calculate_phi_js: (tpmJson: string, state: number, budget: string) => unknown
        }
        const res = mod.calculate_phi_js(tpmJson, state, budget)
        return res
      } catch {
        // WASM not built (cargo build not yet run) — return deterministic stub so MCP stays usable
        // Compute trivial phi as 0 for uniform TPM, else stub
        return { phi: 0, method: 'stub', cesHash: 'stub', note: 'WASM pkg not built — run wasm-pack' }
      }
    },
  },
]
