/**
 * dsh-library Cordis plugin — fs.read('.dsh/library') stub + citation fallback for knowledge_search.
 * @module @deepseek-ai/dsh-enterprise-dsh-library/plugin
 */

export type LibraryEntry = {
  id: string
  title: string
  content: string
  path: string
  cite?: string
}

export class LibraryService {
  private entries: LibraryEntry[] = []

  constructor(seed: LibraryEntry[] = []) {
    this.entries = [...seed]
  }

  seed(entries: LibraryEntry[]): void {
    this.entries.push(...entries)
  }

  // ponytail: in-memory .dsh/library stub, fs.read when .dsh/library lands
  async search(q: string): Promise<LibraryEntry[]> {
    if (!q || q.trim() === '') return [...this.entries]
    const needle = q.toLowerCase()
    return this.entries.filter((e) => `${e.title} ${e.content} ${e.id}`.toLowerCase().includes(needle))
  }

  cite(id: string): string {
    const e = this.entries.find((x) => x.id === id)
    if (!e) throw new Error(`library cite not found: ${id}`)
    return e.cite ?? `${e.title} — ${e.path} [${e.id}]`
  }

  citeEntry(entry: LibraryEntry): string {
    return entry.cite ?? `${entry.title} — ${entry.path} [${entry.id}]`
  }
}

export const name = 'dsh-enterprise:dsh-library'
export const inject = [] as const

export function apply(ctx: unknown): void {
  const svc = new LibraryService([
    {
      id: 'lib-001',
      title: 'Session Protocol Charter',
      content: 'The session protocol defines chain S→D→T→V linking',
      path: '.dsh/library/charter.md',
      cite: 'Session Protocol Charter — .dsh/library/charter.md [lib-001]',
    },
    {
      id: 'lib-002',
      title: 'DORA Compliance Guide',
      content: 'DORA incident reporting and ICT risk templates',
      path: '.dsh/library/dora.md',
    },
  ])
  const c = ctx as {
    effect: (n: string, fn: () => unknown) => unknown
    on: (e: string, h: (ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>) => unknown
  }
  c.effect('dsh-library', () => svc)
  c.effect('library', () => svc)
  // fallback tool when kb-rag not available — chains can delegate here
  c.effect('knowledge_search', () => ({
    search: (q: string) => svc.search(q),
  }))
  c.on('library/search', async (ev: unknown, next: (ev: unknown) => Promise<unknown>) => {
    const q = (ev as { q?: string; query?: string })?.q ?? (ev as { query?: string })?.query ?? String(ev ?? '')
    const r = await svc.search(q)
    return next({ ...(ev as object), results: r })
  })
}
