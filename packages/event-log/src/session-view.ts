import type { EventEnvelope, SessionView, Turn, Invocation } from './event-types.js'

export function projectSessionView(events: EventEnvelope[]): SessionView {
  const sorted = [...events].sort((a, b) => a.ts - b.ts)

  const turnMap = new Map<string, Turn>()
  const invMap = new Map<string, Invocation>()

  for (const ev of sorted) {
    if (!turnMap.has(ev.turnId)) {
      const turn: Turn = { turnId: ev.turnId, invocations: [] }
      turnMap.set(ev.turnId, turn)
    }
    if (!invMap.has(ev.invocationId)) {
      const inv: Invocation = { invocationId: ev.invocationId, events: [] }
      invMap.set(ev.invocationId, inv)
    }
    invMap.get(ev.invocationId)!.events.push(ev)
  }

  for (const inv of invMap.values()) {
    const turn = turnMap.get(inv.events[0]!.turnId)
    if (turn && !turn.invocations.find((i: Invocation) => i.invocationId === inv.invocationId)) {
      turn.invocations.push(inv)
    }
  }

  const turns = [...turnMap.values()].sort((a, b) => a.turnId.localeCompare(b.turnId))
  const sessionStart = events.find((e) => e.eventType === 'session.start')
  const sessionEnd = events.find((e) => e.eventType === 'session.end')

  return {
    sessionId: events[0]?.sessionId ?? '',
    startTs: sessionStart?.ts ?? events[0]?.ts ?? 0,
    endTs: sessionEnd?.ts,
    turns,
  }
}
