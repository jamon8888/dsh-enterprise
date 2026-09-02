import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { EventEnvelope } from '../src/event-types.js'
import { JsonlStore } from '../src/stores/jsonl-store.js'

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

describe('JsonlStore', () => {
  const dir = join(tmpdir(), 'event-log-test-' + Date.now())
  const sessionId = 'session-1'

  beforeEach(async () => {
    await mkdir(dir, { recursive: true })
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('appends an event as a JSON line', async () => {
    const store = new JsonlStore({ logDir: dir, sessionId })
    const event = makeEvent({ eventType: 'session.start' })
    await store.append(event)

    const content = await readFile(join(dir, `${sessionId}.jsonl`), 'utf8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(1)
    const parsed = JSON.parse(lines[0]!) as EventEnvelope
    expect(parsed.eventId).toBe(event.eventId)
    expect(parsed.eventType).toBe('session.start')
  })

  it('appends multiple events as separate lines', async () => {
    const store = new JsonlStore({ logDir: dir, sessionId })
    await store.append(makeEvent({ eventType: 'session.start' }))
    await store.append(makeEvent({ eventType: 'guard.decision' }))
    await store.append(makeEvent({ eventType: 'session.end' }))

    const content = await readFile(join(dir, `${sessionId}.jsonl`), 'utf8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(3)
  })

  it('flushes buffered events', async () => {
    const store = new JsonlStore({ logDir: dir, sessionId })
    await store.append(makeEvent({ eventType: 'tool.result', payload: { big: 'data' } }))
    await store.flush()

    const content = await readFile(join(dir, `${sessionId}.jsonl`), 'utf8')
    expect(content.trim().length).toBeGreaterThan(0)
  })

  it('replays events in order', async () => {
    const store = new JsonlStore({ logDir: dir, sessionId })
    const events = [
      makeEvent({ eventType: 'session.start' }),
      makeEvent({ eventType: 'message.text', payload: { text: 'hello' } }),
      makeEvent({ eventType: 'session.end' }),
    ]
    for (const e of events) {
      await store.append(e)
    }

    const read: EventEnvelope[] = []
    for await (const line of store.readLines()) {
      read.push(JSON.parse(line) as EventEnvelope)
    }
    expect(read).toHaveLength(3)
    expect(read.map((e) => e.eventType)).toEqual(['session.start', 'message.text', 'session.end'])
  })

  it('writes audit-critical events immediately', async () => {
    const store = new JsonlStore({ logDir: dir, sessionId })
    await store.appendImmediate(makeEvent({ eventType: 'guard.decision' }))

    const content = await readFile(join(dir, `${sessionId}.jsonl`), 'utf8')
    expect(content.trim().length).toBeGreaterThan(0)
  })

  it('file path is sessionId.jsonl', () => {
    const store = new JsonlStore({ logDir: dir, sessionId })
    expect(store.filePath).toBe(join(dir, `${sessionId}.jsonl`))
  })
})
