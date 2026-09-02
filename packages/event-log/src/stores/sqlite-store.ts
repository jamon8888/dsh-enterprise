import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import type { EventEnvelope, EventType } from '../event-types.js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface SqliteStoreOptions {
  dbPath: string
}

export interface EventFilter {
  sessionId?: string
  turnId?: string
  invocationId?: string
  eventType?: EventType
  tsMin?: number
  tsMax?: number
  limit?: number
}

export class SqliteStore {
  private db: SqlJsDatabase | null = null
  private initPromise: Promise<void>

  constructor(private opts: SqliteStoreOptions) {
    this.initPromise = this.init()
  }

  private async init(): Promise<void> {
    const SQL = await initSqlJs()
    try {
      const data = await readFile(this.opts.dbPath)
      this.db = new SQL.Database(data)
    } catch {
      this.db = new SQL.Database()
    }
    this.db!.run(`
      CREATE TABLE IF NOT EXISTS events (
        eventId   TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        turnId    TEXT NOT NULL,
        invocationId TEXT NOT NULL,
        ts        INTEGER NOT NULL,
        eventType TEXT NOT NULL,
        payload   TEXT NOT NULL,
        PRIMARY KEY (eventId)
      )
    `)
    this.db!.run('CREATE INDEX IF NOT EXISTS idx_events_session ON events(sessionId)')
    this.db!.run('CREATE INDEX IF NOT EXISTS idx_events_turn    ON events(turnId)')
    this.db!.run('CREATE INDEX IF NOT EXISTS idx_events_inv     ON events(invocationId)')
    this.db!.run('CREATE INDEX IF NOT EXISTS idx_events_type    ON events(eventType)')
    this.db!.run('CREATE INDEX IF NOT EXISTS idx_events_ts      ON events(ts)')
  }

  private async ensure(): Promise<SqlJsDatabase> {
    await this.initPromise
    return this.db!
  }

  async project(event: EventEnvelope): Promise<void> {
    const db = await this.ensure()
    db.run(
      `INSERT OR REPLACE INTO events (eventId, sessionId, turnId, invocationId, ts, eventType, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [event.eventId, event.sessionId, event.turnId, event.invocationId, event.ts, event.eventType, JSON.stringify(event.payload)],
    )
    await this.persist()
  }

  async query(filter: EventFilter = {}): Promise<Record<string, unknown>[]> {
    const db = await this.ensure()
    const conditions: string[] = []
    const params: (string | number)[] = []

    if (filter.sessionId) { conditions.push('sessionId = ?'); params.push(filter.sessionId) }
    if (filter.turnId) { conditions.push('turnId = ?'); params.push(filter.turnId) }
    if (filter.invocationId) { conditions.push('invocationId = ?'); params.push(filter.invocationId) }
    if (filter.eventType) { conditions.push('eventType = ?'); params.push(filter.eventType) }
    if (filter.tsMin !== undefined) { conditions.push('ts >= ?'); params.push(filter.tsMin) }
    if (filter.tsMax !== undefined) { conditions.push('ts <= ?'); params.push(filter.tsMax) }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
    const limit = filter.limit ? `LIMIT ${filter.limit}` : ''
    const sql = `SELECT * FROM events ${where} ORDER BY ts ASC ${limit}`.trim()

    const rows = db.exec(sql, params)
    if (!rows[0]) return []
    const cols = rows[0]!.columns
    return rows[0]!.values.map((vals: (string | number | Uint8Array | null)[]) => {
      const obj: Record<string, unknown> = {}
      cols.forEach((c: string, i: number) => {
        if (c === 'payload') obj[c] = JSON.parse(vals[i] as string)
        else obj[c] = vals[i]
      })
      return obj
    })
  }

  private async persist(): Promise<void> {
    if (!this.db) return
    await mkdir(dirname(this.opts.dbPath), { recursive: true })
    const data = this.db.export()
    const buf = Buffer.from(data)
    await writeFile(this.opts.dbPath, buf)
  }

  async close(): Promise<void> {
    await this.initPromise
    await this.persist()
    this.db?.close()
    this.db = null
  }
}
