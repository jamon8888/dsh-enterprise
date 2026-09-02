import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { EventEnvelope } from '../src/event-types.js'
import { SqliteStore } from '../src/stores/sqlite-store.js'

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
    await mkdir(dir, { recursive: true })
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('creates the events table on first open', async () => {
    const store = new SqliteStore({ dbPath })
    await store.close()
    const { readFile } = await import('node:fs/promises')
    const data = await readFile(dbPath)
    expect(data.length).toBeGreaterThan(0)
  })

  it('projects an event and retrieves it', async () => {
    const store = new SqliteStore({ dbPath })
    const event = makeEvent({ eventType: 'guard.decision', payload: { guardId: 'phi-threshold', disposition: 'block' } })
    await store.project(event)

    const rows = await store.query({})
    expect(rows).toHaveLength(1)
    expect(rows[0]!.eventId).toBe(event.eventId)
    expect(rows[0]!.eventType).toBe('guard.decision')
    expect(rows[0]!.payload).toMatchObject({ guardId: 'phi-threshold', disposition: 'block' })
    await store.close()
  })

  it('queries by sessionId', async () => {
    const store = new SqliteStore({ dbPath })
    await store.project(makeEvent({ sessionId: 's1', eventType: 'session.start' }))
    await store.project(makeEvent({ sessionId: 's2', eventType: 'session.start' }))
    await store.project(makeEvent({ sessionId: 's1', eventType: 'guard.decision' }))

    const rows = await store.query({ sessionId: 's1' })
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.sessionId === 's1')).toBe(true)
    await store.close()
  })

  it('queries by eventType', async () => {
    const store = new SqliteStore({ dbPath })
    await store.project(makeEvent({ eventType: 'session.start' }))
    await store.project(makeEvent({ eventType: 'guard.decision' }))
    await store.project(makeEvent({ eventType: 'session.end' }))
    await store.project(makeEvent({ eventType: 'guard.decision' }))

    const rows = await store.query({ eventType: 'guard.decision' })
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.eventType === 'guard.decision')).toBe(true)
    await store.close()
  })

  it('queries by turnId', async () => {
    const store = new SqliteStore({ dbPath })
    await store.project(makeEvent({ turnId: 't1', eventType: 'session.start' }))
    await store.project(makeEvent({ turnId: 't2', eventType: 'session.end' }))
    await store.project(makeEvent({ turnId: 't1', eventType: 'guard.decision' }))

    const rows = await store.query({ turnId: 't1' })
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.turnId === 't1')).toBe(true)
    await store.close()
  })

  it('queries by time range', async () => {
    const store = new SqliteStore({ dbPath })
    const now = Date.now()
    await store.project(makeEvent({ ts: now - 2000, eventType: 'session.start' }))
    await store.project(makeEvent({ ts: now - 1000, eventType: 'guard.decision' }))
    await store.project(makeEvent({ ts: now, eventType: 'session.end' }))

    const rows = await store.query({ tsMin: now - 1500, tsMax: now })
    expect(rows).toHaveLength(2)
    await store.close()
  })

  it('returns events ordered by ts asc', async () => {
    const store = new SqliteStore({ dbPath })
    const now = Date.now()
    await store.project(makeEvent({ ts: now + 100, eventType: 'session.start' }))
    await store.project(makeEvent({ ts: now, eventType: 'guard.decision' }))
    await store.project(makeEvent({ ts: now + 200, eventType: 'session.end' }))

    const rows = await store.query({})
    expect((rows[0]!.ts as number)).toBeLessThanOrEqual(rows[1]!.ts as number)
    expect((rows[1]!.ts as number)).toBeLessThanOrEqual(rows[2]!.ts as number)
    await store.close()
  })
})
