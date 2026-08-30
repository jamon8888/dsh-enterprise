/**
 * dsh-mneme Cordis plugin — SQLite recall/store + session/event auto-store.
 * @module @deepseek-ai/dsh-enterprise-dsh-mneme/plugin
 */

import { createRequire } from 'node:module'

export type MnemeEntry = { k: string; v: string; ts: number }

export class MnemeStore {
  private map = new Map<string, string>()
  private db: {
    exec: (sql: string) => void
    prepare: (sql: string) => { run: (...a: unknown[]) => unknown; get: (...a: unknown[]) => unknown; all: (...a: unknown[]) => unknown[] }
  } | null = null

  constructor() {
    // ponytail: in-memory Map primary, better-sqlite3 when native addon lands
    this.tryInitSqlite()
  }

  private tryInitSqlite(): void {
    try {
      const rq = createRequire(import.meta.url)
      const Database = rq('better-sqlite3') as unknown as new (path: string) => {
        exec: (sql: string) => void
        prepare: (sql: string) => { run: (...a: unknown[]) => unknown; get: (...a: unknown[]) => unknown; all: (...a: unknown[]) => unknown[] }
      }
      const db = new Database(':memory:')
      db.exec('CREATE TABLE IF NOT EXISTS mneme (k TEXT PRIMARY KEY, v TEXT, ts INTEGER)')
      this.db = db
    } catch {
      this.db = null
    }
  }

  async store(k: string, v: string): Promise<void> {
    this.map.set(k, v)
    if (this.db) {
      try {
        this.db.prepare('INSERT OR REPLACE INTO mneme (k,v,ts) VALUES (?,?,?)').run(k, v, Date.now())
      } catch {}
    }
  }

  // ponytail: substring query over Map, sqlite LIKE when better-sqlite3 lands
  async recall(q: string): Promise<MnemeEntry[]> {
    const needle = q.toLowerCase()
    if (this.db) {
      try {
        if (q.trim() !== '') {
          const rows = this.db.prepare('SELECT k,v,ts FROM mneme WHERE k LIKE ? OR v LIKE ?').all(`%${q}%`, `%${q}%`) as MnemeEntry[]
          if (rows.length > 0) return rows
        } else {
          return this.db.prepare('SELECT k,v,ts FROM mneme').all() as MnemeEntry[]
        }
      } catch {}
    }
    if (!q || q.trim() === '') return [...this.map.entries()].map(([k, v]) => ({ k, v, ts: 0 }))
    return [...this.map.entries()]
      .filter(([k, v]) => `${k} ${v}`.toLowerCase().includes(needle))
      .map(([k, v]) => ({ k, v, ts: 0 }))
  }

  async get(k: string): Promise<string | undefined> {
    if (this.db) {
      try {
        const row = this.db.prepare('SELECT v FROM mneme WHERE k=?').get(k) as { v: string } | undefined
        if (row) return row.v
      } catch {}
    }
    return this.map.get(k)
  }

  entries(): MnemeEntry[] {
    return [...this.map.entries()].map(([k, v]) => ({ k, v, ts: 0 }))
  }

  async search(query: string): Promise<MnemeEntry[]> {
    return this.recall(query)
  }

  async recent(n: number): Promise<MnemeEntry[]> {
    if (this.db) {
      try {
        const rows = this.db.prepare('SELECT k,v,ts FROM mneme ORDER BY ts DESC LIMIT ?').all(n) as MnemeEntry[]
        return rows
      } catch {}
    }
    return []
  }

  clear(): void {
    this.map.clear()
    if (this.db) {
      try {
        this.db.exec('DELETE FROM mneme')
      } catch {}
    }
  }
}

export const name = 'dsh-enterprise:dsh-mneme'
export const inject = [] as const

export function apply(ctx: unknown): void {
  const store = new MnemeStore()
  const c = ctx as {
    effect: (n: string, fn: () => unknown) => unknown
    on: (e: string, h: (ev: unknown, next: (ev: unknown) => Promise<unknown>) => Promise<unknown>) => unknown
  }
  c.effect('dsh-mneme', () => store)
  c.effect('mneme', () => store)
  c.on('session/event', async (ev: unknown, next: (ev: unknown) => Promise<unknown>) => {
    const e = ev as { type?: string; key?: string; k?: string; value?: unknown; v?: unknown; payload?: unknown }
    const k = e?.k ?? e?.key ?? e?.type ?? `event:${Date.now()}`
    const v = e?.v ?? e?.value ?? e?.payload ?? ev
    const vStr = typeof v === 'string' ? v : JSON.stringify(v)
    await store.store(String(k), vStr)
    return next(ev)
  })
}
