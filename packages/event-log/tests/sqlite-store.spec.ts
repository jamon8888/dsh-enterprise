import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { EventEnvelope } from '../../src/event-types.js'
import { SqliteStore } from '../../src/stores/sqlite-store.js'

function makeEvent(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    eventId: 'id-' + Math.random().toString(36).slice(2),
    sessionId: 'session-1',
    turnId: 'turn-1',
    invocationId: 'inv-1',
    ts: Date.now(),
    eventType: 'session.start',
    payload: {},
    ...overrides,
  }
}

describe('SqliteStore', () => {
  const dir = join(tmpdir(), 'event-log-sqlite-test-' + Date.now())
  const dbPath = join(dir, 'session-1.db')

  beforeEach(async () => {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(dir, { recursive: true })
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('creates the events table on first project', () => {
    const store = new SqliteStore({ dbPath })
    const rows = store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='events'").all()
    expect(rows).toHaveLength(1)
    store.close()
  })

  it('projects an event and retrieves it', () => {
    const store = new SqliteStore({ dbPath })
    const event = makeEvent({ eventType: 'guard.decision', payload: { guardId: 'phi-threshold', disposition: 'block' } })
    store.project(event)

    const rows = store.db.prepare('SELECT * FROM events').all() as Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    expect(rows[0]!.eventId).toBe(event.eventId)
    expect(rows[0]!.eventType).toBe('guard.decision')
    expect(JSON.parse(rows[0]!.payload as string)).toMatchObject({ guardId: 'phi-threshold', disposition: 'block' })
    store.close()
  })

  it('queries by sessionId', () => {
    const store = new SqliteStore({ dbPath })
    store.project(makeEvent({ sessionId: 's1', eventType: 'session.start' }))
    store.project(makeEvent({ sessionId: 's2', eventType: 'session.start' }))
    store.project(makeEvent({ sessionId: 's1', eventType: 'guard.decision' }))

    const rows = store.query({ sessionId: 's1' }) as Record<string, unknown>[]
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.sessionId === 's1')).toBe(true)
    store.close()
  })

  it('queries by eventType', () => {
    const store = new SqliteStore({ dbPath })
    store.project(makeEvent({ eventType: 'session.start' }))
    store.project(makeEvent({ eventType: 'guard.decision' }))
    store.project(makeEvent({ eventType: 'session.end' }))
    store.project(makeEvent({ eventType: 'guard.decision' }))

    const rows = store.query({ eventType: 'guard.decision' }) as Record<string, unknown>[]
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.eventType === 'guard.decision')).toBe(true)
    store.close()
  })

  it('queries by turnId', () => {
    const store = new SqliteStore({ dbPath })
    store.project(makeEvent({ turnId: 't1', eventType: 'session.start' }))
    store.project(makeEvent({ turnId: 't2', eventType: 'session.end' }))
    store.project(makeEvent({ turnId: 't1', eventType: 'guard.decision' }))

    const rows = store.query({ turnId: 't1' }) as Record<string, unknown>[]
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.turnId === 't1')).toBe(true)
    store.close()
  })

  it('queries by time range', () => {
    const store = new SqliteStore({ dbPath })
    const now = Date.now()
    store.project(makeEvent({ ts: now - 2000, eventType: 'session.start' }))
    store.project(makeEvent({ ts: now - 1000, eventType: 'guard.decision' }))
    store.project(makeEvent({ ts: now, eventType: 'session.end' }))

    const rows = store.query({ tsMin: now - 1500, tsMax: now }) as Record<string, unknown>[]
    expect(rows).toHaveLength(2)
    store.close()
  })

  it('returns events ordered by ts asc', () => {
    const store = new SqliteStore({ dbPath })
    const now = Date.now()
    store.project(makeEvent({ ts: now + 100, eventType: 'session.start' }))
    store.project(makeEvent({ ts: now, eventType: 'guard.decision' }))
    store.project(makeEvent({ ts: now + 200, eventType: 'session.end' }))

    const rows = store.query({}) as Record<string, unknown>[]
    expect(rows[0]!.ts).toBeLessThanOrEqual(rows[1]!.ts)
    expect(rows[1]!.ts).toBeLessThanOrEqual(rows[2]!.ts)
    store.close()
  })
})
