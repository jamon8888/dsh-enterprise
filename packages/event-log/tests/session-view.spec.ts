import { describe, it, expect } from 'vitest'
import type { EventEnvelope } from '../../src/event-types.js'
import { projectSessionView } from '../../src/session-view.js'

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

describe('projectSessionView', () => {
  it('groups events by turn and invocation', () => {
    const events: EventEnvelope[] = [
      makeEvent({ turnId: 't1', invocationId: 'i1', eventType: 'session.start', ts: 100 }),
      makeEvent({ turnId: 't1', invocationId: 'i1', eventType: 'guard.decision', ts: 101 }),
      makeEvent({ turnId: 't2', invocationId: 'i2', eventType: 'session.end', ts: 200 }),
    ]

    const view = projectSessionView(events)

    expect(view.sessionId).toBe('session-1')
    expect(view.turns).toHaveLength(2)
    expect(view.turns[0]!.invocations).toHaveLength(1)
    expect(view.turns[1]!.invocations).toHaveLength(1)
    expect(view.turns[0]!.invocations[0]!.events).toHaveLength(2)
    expect(view.turns[1]!.invocations[0]!.events).toHaveLength(1)
  })

  it('orders events within invocations by ts', () => {
    const events: EventEnvelope[] = [
      makeEvent({ turnId: 't1', invocationId: 'i1', eventType: 'session.start', ts: 100 }),
      makeEvent({ turnId: 't1', invocationId: 'i1', eventType: 'guard.decision', ts: 102 }),
      makeEvent({ turnId: 't1', invocationId: 'i1', eventType: 'message.text', ts: 101 }),
    ]

    const view = projectSessionView(events)

    const inv = view.turns[0]!.invocations[0]!
    expect(inv.events.map((e) => e.eventType)).toEqual(['session.start', 'message.text', 'guard.decision'])
  })

  it('orders turns by turnId', () => {
    const events: EventEnvelope[] = [
      makeEvent({ turnId: 't2', invocationId: 'i2', eventType: 'session.end', ts: 200 }),
      makeEvent({ turnId: 't1', invocationId: 'i1', eventType: 'session.start', ts: 100 }),
    ]

    const view = projectSessionView(events)

    expect(view.turns[0]!.turnId).toBe('t1')
    expect(view.turns[1]!.turnId).toBe('t2')
  })

  it('captures session.start and session.end ts', () => {
    const events: EventEnvelope[] = [
      makeEvent({ eventType: 'session.start', ts: 100 }),
      makeEvent({ eventType: 'session.end', ts: 500 }),
    ]

    const view = projectSessionView(events)

    expect(view.startTs).toBe(100)
    expect(view.endTs).toBe(500)
  })

  it('returns empty view for no events', () => {
    const view = projectSessionView([])
    expect(view.sessionId).toBe('')
    expect(view.turns).toHaveLength(0)
    expect(view.startTs).toBe(0)
    expect(view.endTs).toBeUndefined()
  })

  it('handles multiple invocations per turn', () => {
    const events: EventEnvelope[] = [
      makeEvent({ turnId: 't1', invocationId: 'i1', eventType: 'session.start', ts: 100 }),
      makeEvent({ turnId: 't1', invocationId: 'i2', eventType: 'guard.decision', ts: 200 }),
    ]

    const view = projectSessionView(events)

    expect(view.turns).toHaveLength(1)
    expect(view.turns[0]!.invocations).toHaveLength(2)
  })
})
