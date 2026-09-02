import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdir, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { eventLogPlugin } from '../src/plugin.js'

function createMockCtx() {
  const events: Array<{ type: string; payload: unknown }> = []
  return {
    emit: vi.fn((type: string, payload: unknown) => { events.push({ type, payload }) }) as unknown as import('@deepseek-ai/cordis').Context['emit'],
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    effect: vi.fn(),
    dispose: vi.fn(),
    _events: events,
  }
}

describe('eventLogPlugin', () => {
  const dir = join(tmpdir(), 'event-log-plugin-test-' + Date.now())

  beforeEach(async () => {
    await mkdir(dir, { recursive: true })
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('wraps ctx.emit to log guard.decision events immediately', async () => {
    const ctx = createMockCtx() as any
    eventLogPlugin(ctx, { logDir: dir, sessionId: 's1', flushIntervalMs: -1 })

    ctx.emit('guard.decision', { guardId: 'phi-threshold', disposition: 'block' })

    const content = await readFile(join(dir, 's1.jsonl'), 'utf8')
    const line = content.trim()
    const parsed = JSON.parse(line)
    expect(parsed.eventType).toBe('guard.decision')
    expect(parsed.payload.disposition).toBe('block')
    expect(parsed.sessionId).toBe('s1')
    expect(ctx.emit).toHaveBeenCalledWith('guard.decision', { guardId: 'phi-threshold', disposition: 'block' })
  })

  it('wraps ctx.emit to log permission events immediately', async () => {
    const ctx = createMockCtx() as any
    eventLogPlugin(ctx, { logDir: dir, sessionId: 's2', flushIntervalMs: -1 })

    ctx.emit('permission.ask', { tool: 'bash', args: {} })

    const content = await readFile(join(dir, 's2.jsonl'), 'utf8')
    const line = content.trim()
    const parsed = JSON.parse(line)
    expect(parsed.eventType).toBe('permission.ask')
  })

  it('buffers non-audit events and flushes on schedule', async () => {
    const ctx = createMockCtx() as any
    eventLogPlugin(ctx, { logDir: dir, sessionId: 's3', flushIntervalMs: 50 })

    ctx.emit('message.text', { text: 'hello' })
    ctx.emit('tool.result', { callId: 'c1', result: 'ok' })

    const filePath = join(dir, 's3.jsonl')
    let content: string
    try {
      content = await readFile(filePath, 'utf8')
    } catch {
      content = ''
    }
    expect(content.trim()).toBe('')

    await new Promise((r) => setTimeout(r, 80))
    content = await readFile(filePath, 'utf8')
    expect(content.trim().split('\n')).toHaveLength(2)
  })

  it('still calls original ctx.emit after logging', () => {
    const ctx = createMockCtx() as any
    eventLogPlugin(ctx, { logDir: dir, flushIntervalMs: -1 })

    ctx.emit('session.start', { sessionId: 's4' })

    expect(ctx.emit).toHaveBeenCalledTimes(1)
    expect((ctx as any)._events).toHaveLength(1)
    expect((ctx as any)._events[0]!.type).toBe('session.start')
  })

  it('emits dispose event to flush buffers', async () => {
    const ctx = createMockCtx() as any
    const disposeHandler = vi.fn()
    ctx.on = vi.fn((event: string, handler: Function) => {
      if (event === 'dispose') disposeHandler.mockImplementation(handler)
    }) as any

    eventLogPlugin(ctx, { logDir: dir, sessionId: 's5', flushIntervalMs: 100 })

    ctx.emit('tool.result', { callId: 'c1', result: 'data' })

    await disposeHandler()

    const content = await readFile(join(dir, 's5.jsonl'), 'utf8')
    expect(content.trim().split('\n')).toHaveLength(1)
  })

  it('generates unique eventId per envelope', async () => {
    const ctx = createMockCtx() as any
    eventLogPlugin(ctx, { logDir: dir, sessionId: 's6', flushIntervalMs: -1 })

    ctx.emit('guard.decision', { guardId: 'x' })
    ctx.emit('guard.decision', { guardId: 'y' })

    const content = await readFile(join(dir, 's6.jsonl'), 'utf8')
    const lines = content.trim().split('\n')
    const id1 = JSON.parse(lines[0]!).eventId
    const id2 = JSON.parse(lines[1]!).eventId
    expect(id1).not.toBe(id2)
  })

  it('uses provided sessionId in envelopes', async () => {
    const ctx = createMockCtx() as any
    eventLogPlugin(ctx, { logDir: dir, sessionId: 'my-session', flushIntervalMs: -1 })

    ctx.emit('session.start', {})

    const content = await readFile(join(dir, 'my-session.jsonl'), 'utf8')
    const parsed = JSON.parse(content.trim())
    expect(parsed.sessionId).toBe('my-session')
  })
})
