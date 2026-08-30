/**
 * dsh-local-llm Cordis plugin — Ollama stub for air-gapped EU region.
 * @module @deepseek-ai/dsh-enterprise-local-llm/plugin
 */

export const name = 'dsh-enterprise:local-llm'
export const inject = [] as const

// ponytail: in-memory Ollama stub, Ollama 7B/70B when air-gapped K8s lands
export function apply(ctx: any): void {
  ctx.effect('local-llm', () => ({ generate: async (prompt: string) => `Local response to ${prompt}`, models: ['llama3.1:70b'] }))
  ctx.on('gateway/request', async (ev: any, next: any) => {
    const region = ev?.region ?? ev?.sovereignty?.region
    if (region === 'EU-airgapped') {
      const prompt = ev?.prompt ?? ev?.input ?? ev?.query ?? ''
      const response = `Local response to ${prompt}`
      const out = { ...(ev as object), response, handledBy: 'local-llm', region }
      return typeof next === 'function' ? next(out) : out
    }
    return typeof next === 'function' ? next(ev) : ev
  })
}
