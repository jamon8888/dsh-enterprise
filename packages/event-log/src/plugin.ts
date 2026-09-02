import type { Context } from '@deepseek-ai/cordis'
import type { EventEnvelope, EventType } from './event-types.js'
import { JsonlStore } from './stores/jsonl-store.js'
import { SqliteStore } from './stores/sqlite-store.js'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export interface EventLogOptions {
  logDir?: string
  sqliteDb?: boolean
  flushIntervalMs?: number
  sessionId?: string
  turnId?: string
  invocationId?: string
}

interface SessionContext {
  sessionId: string
  turnId: string
  invocationId: string
}

type EmitFn = (eventType: string, payload: unknown) => Promise<void>

export function eventLogPlugin(ctx: Context, opts: EventLogOptions = {}): void {
  const logDir = opts.logDir ?? './event-logs'
  const sessionId = opts.sessionId ?? randomUUID()
  const flushIntervalMs = opts.flushIntervalMs ?? 500
  const enableSqlite = opts.sqliteDb ?? true

  const jsonl = new JsonlStore({ logDir, sessionId })
  const sqlite = enableSqlite
    ? new SqliteStore({ dbPath: join(logDir, `${sessionId}.db`) })
    : null

  const sessionCtx: SessionContext = {
    sessionId,
    turnId: opts.turnId ?? 'turn-0',
    invocationId: opts.invocationId ?? 'inv-0',
  }

  const originalEmit = ctx.emit.bind(ctx) as EmitFn

  const wrappedEmit: EmitFn = async (eventType: string, payload: unknown) => {
    const envelope: EventEnvelope = {
      eventId: randomUUID(),
      sessionId: sessionCtx.sessionId,
      turnId: sessionCtx.turnId,
      invocationId: sessionCtx.invocationId,
      ts: Date.now(),
      eventType: eventType as EventType,
      payload,
    }

    if (eventType.startsWith('guard.') || eventType.startsWith('permission.')) {
      await jsonl.appendImmediate(envelope)
      if (sqlite) {
        await sqlite.project(envelope).catch((err: unknown) => {
          console.error('[event-log] sqlite project failed:', err)
        })
      }
    } else {
      jsonl.append(envelope)
      if (sqlite) {
        sqlite.project(envelope).catch((err: unknown) => {
          console.error('[event-log] sqlite project failed:', err)
        })
      }
    }

    await originalEmit(eventType, payload)
  }

  ctx.emit = wrappedEmit as Context['emit']

  if (flushIntervalMs > 0) {
    jsonl.scheduleFlush(flushIntervalMs)
  }

  ctx.on('dispose', async () => {
    jsonl.stopScheduledFlush()
    await jsonl.flush()
    if (sqlite) {
      await sqlite.close().catch((err: unknown) => {
        console.error('[event-log] sqlite close failed:', err)
      })
    }
  })
}
