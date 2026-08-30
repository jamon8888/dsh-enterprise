/**
 * RunPhaseRecorder — port of facility/runner/src/phases.ts (3769 B @ b150d96).
 * Divergence: flat RunEvent {phase, status, durationMs, timestamp} plus
 * facility-compat {type,data} for timeline readers. Behavior identical.
 * @module @deepseek-ai/dsh-enterprise-sandbox-runner/phases
 */
// ponytail: in-memory emit, Postgres run_events when watchtower lands

import type { EmitRunEvents, PhaseDetails, RunEvent, RunPhaseName, RunPhaseSkipReason } from './types.js'

export const RUN_PHASE_NAMES = [
  'bootstrap',
  'workspace',
  'runner_runtime',
  'package_install',
  'provision',
  'agent',
  'result_capture',
  'acceptance',
  'delivery',
] as const

export class RunPhaseRecorder {
  private active: { name: RunPhaseName; startedAtMs: number } | null = null

  constructor(
    private readonly emit: EmitRunEvents,
    private readonly now: () => number = () => (globalThis.performance ? globalThis.performance.now() : Date.now()),
  ) {
    this.active = null
  }

  start(name: RunPhaseName): void {
    if (this.active) throw new Error(`run_phase_already_active:${this.active.name}`)
    this.active = { name, startedAtMs: this.now() }
  }

  async finish(details: PhaseDetails = {}): Promise<void> {
    const active = this.active
    if (!active) throw new Error('run_phase_not_active')
    this.active = null
    const durationMs = Math.max(0, Math.round(this.now() - active.startedAtMs))
    const outcome = details.outcome ?? 'succeeded'
    await this.emitBestEffort([
      {
        phase: active.name,
        status: outcome === 'succeeded' ? 'succeeded' : outcome,
        durationMs,
        timestamp: Date.now(),
        outcome,
        // facility compat
        type: 'phase',
        data: {
          name: active.name,
          status: outcome === 'succeeded' ? 'completed' : outcome,
          duration_ms: durationMs,
          outcome,
        },
        ts: new Date().toISOString(),
      } as unknown as RunEvent,
    ])
  }

  async fail(): Promise<void> {
    const active = this.active
    if (!active) return
    this.active = null
    const durationMs = Math.max(0, Math.round(this.now() - active.startedAtMs))
    await this.emitBestEffort([
      {
        phase: active.name,
        status: 'failed',
        durationMs,
        timestamp: Date.now(),
        outcome: 'failed' as const,
        type: 'phase',
        data: {
          name: active.name,
          status: 'failed',
          duration_ms: durationMs,
          outcome: 'failed',
        },
        ts: new Date().toISOString(),
      } as unknown as RunEvent,
    ])
  }

  async skip(name: RunPhaseName, reason: RunPhaseSkipReason): Promise<void> {
    if (this.active) throw new Error(`run_phase_already_active:${this.active.name}`)
    await this.emitBestEffort([
      {
        phase: name,
        status: 'skipped',
        durationMs: 0,
        timestamp: Date.now(),
        outcome: 'skipped' as const,
        reason,
        type: 'phase',
        data: { name, status: 'skipped', duration_ms: 0, outcome: 'skipped', reason },
        ts: new Date().toISOString(),
      } as unknown as RunEvent,
    ])
  }

  async measure<T>(
    name: RunPhaseName,
    operation: () => Promise<T>,
    details: (result: T) => PhaseDetails = () => ({}),
  ): Promise<T> {
    this.start(name)
    try {
      const result = await operation()
      await this.finish(details(result))
      return result
    } catch (error) {
      await this.fail().catch(() => undefined)
      throw error
    }
  }

  private async emitBestEffort(events: RunEvent[]): Promise<void> {
    await this.emit(events).catch(() => undefined)
  }
}
