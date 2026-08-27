import { performance } from "node:perf_hooks";
import type { RunEvent } from "./types.js";

export const RUN_PHASE_NAMES = [
  "bootstrap",
  "workspace",
  "runner_runtime",
  "package_install",
  "provision",
  "agent",
  "result_capture",
  "acceptance",
  "delivery",
] as const;

export type RunPhaseName = (typeof RUN_PHASE_NAMES)[number];
export type RunPhaseOutcome = "succeeded" | "failed" | "skipped" | "canceled";
export type RunPhaseSkipReason = "not_configured" | "agent_canceled" | "run_preconditions_failed";

type PhaseDetails = {
  outcome?: RunPhaseOutcome;
};

type EmitRunEvents = (events: RunEvent[]) => Promise<unknown>;

/**
 * Emits a small, fixed-shape timeline for the runner's sequential lifecycle.
 * Phase payloads deliberately contain no command, output, repository, or model
 * data because run events are visible to every runs:read principal in the org.
 * When a run has no terminal result, the first missing phase event bounds an
 * out-of-process death to during or before that phase. Clean early failures do
 * have a terminal result and legitimately leave later phases absent.
 */
export class RunPhaseRecorder {
  private active: { name: RunPhaseName; startedAtMs: number } | null = null;

  constructor(
    private readonly emit: EmitRunEvents,
    private readonly now: () => number = () => performance.now(),
  ) {}

  start(name: RunPhaseName) {
    if (this.active) throw new Error(`run_phase_already_active:${this.active.name}`);
    this.active = { name, startedAtMs: this.now() };
  }

  async finish(details: PhaseDetails = {}) {
    const active = this.active;
    if (!active) throw new Error("run_phase_not_active");
    this.active = null;
    const durationMs = Math.max(0, Math.round(this.now() - active.startedAtMs));
    await this.emitBestEffort([
      {
        type: "phase",
        data: {
          name: active.name,
          status: "completed",
          duration_ms: durationMs,
          ...details,
        },
      },
    ]);
  }

  async fail() {
    const active = this.active;
    if (!active) return;
    this.active = null;
    const durationMs = Math.max(0, Math.round(this.now() - active.startedAtMs));
    await this.emitBestEffort([
      {
        type: "phase",
        data: {
          name: active.name,
          status: "failed",
          duration_ms: durationMs,
          outcome: "failed",
        },
      },
    ]);
  }

  async skip(name: RunPhaseName, reason: RunPhaseSkipReason) {
    if (this.active) throw new Error(`run_phase_already_active:${this.active.name}`);
    await this.emitBestEffort([
      {
        type: "phase",
        data: { name, status: "skipped", duration_ms: 0, outcome: "skipped", reason },
      },
    ]);
  }

  async measure<T>(
    name: RunPhaseName,
    operation: () => Promise<T>,
    details: (result: T) => PhaseDetails = () => ({}),
  ): Promise<T> {
    this.start(name);
    try {
      const result = await operation();
      // Detail callbacks are deliberately pure mappings over trusted runner
      // results. A callback error is treated as a phase failure and fails closed.
      await this.finish(details(result));
      return result;
    } catch (error) {
      // Preserve the operation error when the best-effort terminal timing event
      // cannot be delivered; it is the more useful root cause for the run.
      await this.fail().catch(() => undefined);
      throw error;
    }
  }

  private async emitBestEffort(events: RunEvent[]) {
    // Timings are diagnostic data, never run state. A transient event-ingestion
    // failure must not turn successful work (including completed delivery) into
    // a failed run or replace the operation's real error.
    await this.emit(events).catch(() => undefined);
  }
}
