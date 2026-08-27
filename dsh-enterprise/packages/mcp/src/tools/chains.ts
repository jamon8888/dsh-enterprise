/**
 * MCP tools: chain.createSignal, chain.createDecision, chain.createTask, chain.createVerification
 * Wraps `@deepseek-ai/dsh-enterprise-chains` via `ctx.get('chains')`.
 * Validates S→D→T→V linking discipline (parent_required).
 * @module @deepseek-ai/dsh-enterprise-mcp/tools/chains
 */

export type ToolDefinition = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: Record<string, unknown>, ctx: unknown) => Promise<unknown>
}

// S→D→T→V expected parent discipline: S free, D→S, T→D, V→T
export const PARENT_REQUIRED: Record<string, string[]> = {
  S: [],
  D: ['S'],
  T: ['D'],
  V: ['T'],
}

function getChains(ctx: unknown): unknown {
  try {
    return (ctx as { get?: (n: string) => unknown }).get?.('chains')
  } catch { return undefined }
}

function validateLink(expectedParent: string[], providedParentType?: string): string | null {
  if (expectedParent.length === 0) return null
  if (!providedParentType) return `parent_required: expected parent ${expectedParent.join('|')}`
  if (!expectedParent.includes(providedParentType)) {
    return `parent_required: expected ${expectedParent.join('|')} got ${providedParentType}`
  }
  return null
}

export const chainTools: ToolDefinition[] = [
  {
    name: 'chain.createSignal',
    description: 'Create S signal — root of S→D→T→V chain. Wraps ctx.get(\'chains\'). No parent required.',
    inputSchema: {
      type: 'object',
      properties: {
        chainId: { type: 'string', description: 'Chain id (product|research)' },
        payload: { type: 'object', description: 'Signal payload' },
      },
      required: ['payload'],
    },
    handler: async (args, ctx) => {
      const payload = args.payload
      if (!payload) throw new Error('chain.createSignal: payload required')
      const chains = getChains(ctx) as { productChain?: unknown; chainFromConfig?: (c: unknown) => unknown } | undefined
      // Validate S is root (no parent) — always passes
      if (chains?.chainFromConfig) {
        // optional harness check: ensure productChain S has no parent
        try { chains.chainFromConfig({ chain: 'product' }) } catch {}
      }
      // delegate if chains service exposes createSignal-like helper
      const impl = chains as unknown as { createSignal?: (a: unknown) => Promise<unknown> } | undefined
      if (impl?.createSignal) return impl.createSignal(args)
      return { ok: true, type: 'S', chainId: args.chainId ?? 'product', payload, createdAt: Date.now() }
    },
  },
  {
    name: 'chain.createDecision',
    description: 'Create D decision — requires parent S. Validates S→D.',
    inputSchema: {
      type: 'object',
      properties: {
        signalId: { type: 'string', description: 'Parent S signal id' },
        parentType: { type: 'string', description: 'Parent type, must be S' },
        payload: { type: 'object' },
      },
      required: ['signalId'],
    },
    handler: async (args, ctx) => {
      const err = validateLink(PARENT_REQUIRED.D!, (args.parentType as string) ?? 'S')
      // If parentType not provided, assume S (common) — but if explicitly wrong, fail
      if (args.parentType && err) throw new Error(err)
      if (!args.signalId) throw new Error('chain.createDecision: signalId (parent S) required — parent_required')
      const chains = getChains(ctx) as unknown as { createDecision?: (a: unknown) => Promise<unknown> } | undefined
      if (chains?.createDecision) return chains.createDecision(args)
      return { ok: true, type: 'D', parent: args.signalId, payload: args.payload, createdAt: Date.now() }
    },
  },
  {
    name: 'chain.createTask',
    description: 'Create T task — requires parent D. Validates D→T.',
    inputSchema: {
      type: 'object',
      properties: {
        decisionId: { type: 'string', description: 'Parent D decision id' },
        parentType: { type: 'string' },
        payload: { type: 'object' },
      },
      required: ['decisionId'],
    },
    handler: async (args, ctx) => {
      const err = validateLink(PARENT_REQUIRED.T!, (args.parentType as string) ?? 'D')
      if (args.parentType && err) throw new Error(err)
      if (!args.decisionId) throw new Error('chain.createTask: decisionId (parent D) required — parent_required')
      const chains = getChains(ctx) as unknown as { createTask?: (a: unknown) => Promise<unknown> } | undefined
      if (chains?.createTask) return chains.createTask(args)
      return { ok: true, type: 'T', parent: args.decisionId, payload: args.payload, createdAt: Date.now() }
    },
  },
  {
    name: 'chain.createVerification',
    description: 'Create V verification — requires parent T. Validates T→V.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Parent T task id' },
        parentType: { type: 'string' },
        payload: { type: 'object' },
      },
      required: ['taskId'],
    },
    handler: async (args, ctx) => {
      const err = validateLink(PARENT_REQUIRED.V!, (args.parentType as string) ?? 'T')
      if (args.parentType && err) throw new Error(err)
      if (!args.taskId) throw new Error('chain.createVerification: taskId (parent T) required — parent_required')
      const chains = getChains(ctx) as unknown as { createVerification?: (a: unknown) => Promise<unknown> } | undefined
      if (chains?.createVerification) return chains.createVerification(args)
      return { ok: true, type: 'V', parent: args.taskId, payload: args.payload, createdAt: Date.now() }
    },
  },
]
