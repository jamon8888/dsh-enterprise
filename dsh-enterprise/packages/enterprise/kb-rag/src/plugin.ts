/**
 * kb-rag Cordis plugin — pgvector-backed knowledge search + knowledge_search tool routed from chains.
 * @module @deepseek-ai/dsh-enterprise-kb-rag/plugin
 */

export type KbEntry = {
  id: string
  content: string
  source?: string
  score?: number
}

export class KbRagService {
  private entries: KbEntry[] = []

  constructor(seed: KbEntry[] = []) {
    this.entries = [...seed]
  }

  seed(entries: KbEntry[]): void {
    this.entries.push(...entries)
  }

  // ponytail: in-memory substring search, pgvector cosine when PG + pgvector lands
  async search(q: string): Promise<KbEntry[]> {
    if (!q || q.trim() === '') return [...this.entries]
    const needle = q.toLowerCase()
    const scored = (this.entries
      .map((e) => {
        const hay = `${e.content} ${e.id} ${e.source ?? ''}`.toLowerCase()
        const idx = hay.indexOf(needle)
        if (idx === -1) return null
        const score = 1 - idx / Math.max(hay.length, 1)
        return { ...e, score }
      })
      .filter((e) => e !== null) as KbEntry[]).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    return scored
  }
}

/**
 * Route knowledge_search to best backend: kb-rag -> dsh-library -> empty.
 * Chains plugin delegates to this via ctx.get('kb-rag').search or this helper.
 */
export async function knowledgeSearch(ctx: unknown, q: string): Promise<KbEntry[]> {
  const get = (ctx as { get?: (n: string) => unknown })?.get
  if (typeof get === 'function') {
    try {
      const kb = get('kb-rag') as { search: (q: string) => Promise<KbEntry[]> } | undefined
      if (kb?.search) {
        const r = await kb.search(q)
        if (r.length > 0) return r
      }
    } catch {}
    try {
      const lib = get('dsh-library') as { search: (q: string) => Promise<KbEntry[]> } | undefined
      if (lib?.search) return await lib.search(q)
    } catch {}
  }
  return []
}

export const name = 'dsh-enterprise:kb-rag'
export const inject = [] as const

export function apply(ctx: unknown): void {
  const svc = new KbRagService([
    { id: 'kb-001', content: 'DORA requires ICT risk management and incident reporting', source: 'DORA Art.5' },
    { id: 'kb-002', content: 'GDPR data subject rights include erasure and access', source: 'GDPR Art.17' },
    { id: 'kb-003', content: 'AI Act conformity assessment for high-risk systems', source: 'AI Act Art.43' },
  ])
  const c = ctx as {
    effect: (n: string, fn: () => unknown) => unknown
    on: (e: string, h: (ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>) => unknown
    get?: (n: string) => unknown
  }
  c.effect('kb-rag', () => svc)
  // expose knowledge_search tool routed from chains — delegate to ctx.get('kb-rag').search
  c.effect('knowledge_search', () => ({
    search: (q: string) => svc.search(q),
    route: (q: string) => knowledgeSearch(ctx, q),
  }))
  c.on('knowledge/search', async (ev: unknown, next: (ev: unknown) => Promise<unknown>) => {
    const q = (ev as { q?: string; query?: string })?.q ?? (ev as { query?: string })?.query ?? String(ev ?? '')
    const r = await svc.search(q)
    return next({ ...(ev as object), results: r })
  })
}
