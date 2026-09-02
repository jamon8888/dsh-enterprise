import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { EventEnvelope } from '../../event-log/src/event-types.js'
import { JsonlStore } from '../../event-log/src/stores/jsonl-store.js'

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

describe('JsonlStore.replay', () => {
  const dir = join(tmpdir(), 'event-log-replay-test-' + Date.now())
  const sessionId = 'session-1'

  beforeEach(async () => {
    await mkdir(dir, { recursive: true })
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('yields all events from the session JSONL', async () => {
    const store = new JsonlStore({ logDir: dir, sessionId })
    const events = [
      makeEvent({ eventType: 'session.start', ts: 100 }),
      makeEvent({ eventType: 'guard.decision', ts: 101 }),
      makeEvent({ eventType: 'session.end', ts: 200 }),
    ]
    for (const ev of events) {
      await store.appendImmediate(ev)
    }

    const replayed: EventEnvelope[] = []
    for await (const ev of store.replay()) {
      replayed.push(ev)
    }

    expect(replayed).toHaveLength(3)
    expect(replayed.map((e) => e.eventType)).toEqual(['session.start', 'guard.decision', 'session.end'])
  })

  it('yields events in ts order', async () => {
    const store = new JsonlStore({ logDir: dir, sessionId })
    await store.appendImmediate(makeEvent({ eventType: 'session.start', ts: 300 }))
    await store.appendImmediate(makeEvent({ eventType: 'guard.decision', ts: 100 }))
    await store.appendImmediate(makeEvent({ eventType: 'tool.call', ts: 200 }))

    const replayed: EventEnvelope[] = []
    for await (const ev of store.replay()) {
      replayed.push(ev)
    }

    expect(replayed.map((e) => e.ts)).toEqual([300, 100, 200])
  })

  it('skips corrupt lines and continues', async () => {
    const filePath = join(dir, `${sessionId}.jsonl`)
    await appendFile(filePath, '{"eventId":"a","sessionId":"s1","ts":100,"eventType":"session.start","payload":{}}\n', 'utf8')
    await appendFile(filePath, 'not valid json\n', 'utf8')
    await appendFile(filePath, '{"eventId":"b","sessionId":"s1","ts":200,"eventType":"guard.decision","payload":{}}\n', 'utf8')

    const store = new JsonlStore({ logDir: dir, sessionId })
    const replayed: EventEnvelope[] = []
    for await (const ev of store.replay()) {
      replayed.push(ev)
    }

    expect(replayed).toHaveLength(2)
    expect(replayed[0]!.eventId).toBe('a')
    expect(replayed[1]!.eventId).toBe('b')
  })

  it('returns empty generator for non-existent session', async () => {
    const store = new JsonlStore({ logDir: dir, sessionId: 'does-not-exist' })
    const replayed: EventEnvelope[] = []
    for await (const _ev of store.replay()) {
      replayed.push(_ev)
    }
    expect(replayed).toHaveLength(0)
  })
})
