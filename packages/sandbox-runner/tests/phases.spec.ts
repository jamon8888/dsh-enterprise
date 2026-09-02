import { describe, it, expect, vi } from 'vitest'
import { RunPhaseRecorder } from '../src/phases.ts'
import { redactSecrets } from '../src/redaction.ts'
import type { RunEvent } from '../src/types.ts'

describe('RunPhaseRecorder measure emits succeeded with durationMs', () => {
  it('emits succeeded', async () => {
    const events: RunEvent[] = []
    let t = 100
    const recorder = new RunPhaseRecorder(async (evs) => { events.push(...evs) }, () => t)
    t = 100
    // start at 100, finish at 150 -> durationMs 50
    const origNow = recorder['now'] as () => number
    // we control via closure t
    t = 100
    const p = recorder.measure('bootstrap', async () => {
      t = 150
      return 'ok'
    })
    // ensure now returns 100 on start then 150 on finish: our t var does that
    // but measure calls start (now=100) then operation then finish (now=150)
    // operation sets t to 150 before finish reads it
    const res = await p
    expect(res).toBe('ok')
    expect(events).toHaveLength(1)
    const ev = events[0]!
    expect(ev.phase).toBe('bootstrap')
    // succeeded outcome
    expect(ev.status === 'succeeded' || ev.outcome === 'succeeded' || (ev as any).data?.outcome === 'succeeded').toBe(true)
    expect(typeof ev.durationMs === 'number' ? ev.durationMs : (ev as any).data?.duration_ms).toBeGreaterThanOrEqual(0)
    // durationMs should be 50 (rounded)
    const d = ev.durationMs ?? (ev as any).data?.duration_ms
    expect(d).toBe(50)
  })

  it('computes durationMs = max(0, round(now - startedAt))', async () => {
    const events: RunEvent[] = []
    let now = 1000
    const recorder = new RunPhaseRecorder(async (evs) => { events.push(...evs) }, () => now)
    recorder.start('workspace')
    now = 1000.4 // round 0
    await recorder.finish()
    expect(events[0]!.durationMs === 0 || (events[0] as any).data?.duration_ms === 0).toBe(true)
  })

  it('emitBestEffort swallows emit errors and does not throw', async () => {
    const recorder = new RunPhaseRecorder(async () => { throw new Error('ingest down') }, () => 0)
    recorder.start('workspace')
    await expect(recorder.finish()).resolves.toBeUndefined()
  })
})

describe('skip emits skipped', () => {
  it('emits skipped with reason', async () => {
    const events: RunEvent[] = []
    const recorder = new RunPhaseRecorder(async (evs) => { events.push(...evs) })
    await recorder.skip('provision', 'not_configured')
    expect(events).toHaveLength(1)
    expect(events[0]!.phase).toBe('provision')
    expect(events[0]!.status).toBe('skipped')
    expect(events[0]!.durationMs).toBe(0)
    expect(events[0]!.reason).toBe('not_configured')
  })

  it('throws if active phase exists', async () => {
    const recorder = new RunPhaseRecorder(async () => {})
    recorder.start('bootstrap')
    await expect(recorder.skip('workspace', 'not_configured')).rejects.toThrow(/already_active/)
  })
})

describe('fail emits failed', () => {
  it('emits failed', async () => {
    const events: RunEvent[] = []
    let now = 0
    const recorder = new RunPhaseRecorder(async (evs) => { events.push(...evs) }, () => now)
    recorder.start('agent')
    now = 42
    await recorder.fail()
    expect(events).toHaveLength(1)
    expect(events[0]!.phase).toBe('agent')
    expect(events[0]!.status).toBe('failed')
    const d = events[0]!.durationMs ?? (events[0] as any).data?.duration_ms
    expect(d).toBe(42)
  })

  it('measure failure emits failed and rethrows', async () => {
    const events: RunEvent[] = []
    const recorder = new RunPhaseRecorder(async (evs) => { events.push(...evs) })
    await expect(recorder.measure('agent', async () => { throw new Error('boom') })).rejects.toThrow('boom')
    expect(events).toHaveLength(1)
    expect(events[0]!.status).toBe('failed')
  })

  it('fail no-op when not active', async () => {
    const events: RunEvent[] = []
    const recorder = new RunPhaseRecorder(async (evs) => { events.push(...evs) })
    await recorder.fail()
    expect(events).toHaveLength(0)
  })
})

describe('redactSecrets', () => {
  it('replaces sk-... pattern', () => {
    const input = 'key is sk-abcDEF1234567890ABCDEFghijk and more'
    const out = redactSecrets(input, []) as string
    expect(out).not.toContain('sk-abcDEF')
    expect(out).toContain('[REDACTED]')
  })

  it('replaces ghp_ token', () => {
    const token = 'ghp_' + 'a'.repeat(36)
    const out = redactSecrets(`token ${token} end`, []) as string
    expect(out).toBe('token [REDACTED] end')
  })

  it('replaces xoxb slack token', () => {
    const token = 'xoxb-123-abc-xyz'
    const out = redactSecrets(`slack ${token}`, []) as string
    expect(out).toContain('[REDACTED]')
  })

  it('replaces explicit secrets list', () => {
    const out = redactSecrets({ msg: 'hello supersecret123 world', nested: ['keep', 'supersecret123'] }, ['supersecret123'])
    expect(JSON.stringify(out)).not.toContain('supersecret123')
    expect(JSON.stringify(out)).toContain('[REDACTED]')
  })

  it('recurses into objects and arrays', () => {
    const out: any = redactSecrets({ a: ['sk-ABCDEFGHIJ1234567890KLMNO', { b: 'ghp_' + 'b'.repeat(36) }] }, [])
    expect(out.a[0]).toBe('[REDACTED]')
    expect(out.a[1].b).toBe('[REDACTED]')
  })
})
