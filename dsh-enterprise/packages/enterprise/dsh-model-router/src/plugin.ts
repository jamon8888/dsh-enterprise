/**
 * dsh-model-router Cordis plugin — cost/latency/quality router for gateway.
 * @module @deepseek-ai/dsh-enterprise-model-router/plugin
 */

export const name = 'dsh-enterprise:model-router'
export const inject = [] as const

// ponytail: in-memory router stub, cost/latency/quality when gateway PG lands
export function apply(ctx: any): void {
  ctx.effect('model-router', () => ({ select: async (req: any) => (req.preferLocal ? 'local-llm' : 'gateway') }))
  ctx.on('gateway/request', async (ev: any, next: any) => {
    const sel = (ctx as any)?.get?.('model-router') as { select: (r: any) => Promise<string> } | undefined
    const route = sel?.select ? await sel.select(ev) : ev?.preferLocal ? 'local-llm' : 'gateway'
    let out: any = { ...(ev as object), route, handledBy: route }
    if (route === 'local-llm') {
      try {
        const local = (ctx as any)?.get?.('local-llm') as { generate: (p: string) => Promise<string> } | undefined
        const prompt = ev?.prompt ?? ev?.input ?? ev?.query ?? ''
        if (local?.generate) out.response = await local.generate(String(prompt))
        else out.response = `Local response to ${prompt}`
      } catch {
        out.response = `Local response to ${ev?.prompt ?? ''}`
      }
    }
    return typeof next === 'function' ? next(out) : out
  })
}
