import { describe, expect, it, vi } from "vitest";
import { RUN_PHASE_NAMES, RunPhaseRecorder } from "../src/phases.js";
import type { RunEvent } from "../src/types.js";

describe("runner phase recorder", () => {
  it("keeps the complete lifecycle in execution order", () => {
    expect(RUN_PHASE_NAMES).toEqual([
      "bootstrap",
      "workspace",
      "runner_runtime",
      "package_install",
      "provision",
      "agent",
      "result_capture",
      "acceptance",
      "delivery",
    ]);
  });

  it("emits a fixed-shape start and completion using non-negative elapsed time", async () => {
    const events: RunEvent[] = [];
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(94);
    const phases = new RunPhaseRecorder(async (batch) => events.push(...batch), now);

    await expect(phases.measure("workspace", async () => "ready")).resolves.toBe("ready");

    expect(events).toEqual([
      {
        type: "phase",
        data: { name: "workspace", status: "completed", duration_ms: 0 },
      },
    ]);
  });

  it("records controlled outcomes without copying operation data into events", async () => {
    const events: RunEvent[] = [];
    const secret = "not-for-run-events";
    const phases = new RunPhaseRecorder(
      async (batch) => events.push(...batch),
      () => 20,
    );

    const result = await phases.measure(
      "package_install",
      async () => ({ code: 1, output: secret }),
      ({ code }) => ({ outcome: code === 0 ? "succeeded" : "failed" }),
    );

    expect(result.output).toBe(secret);
    expect(events.at(-1)).toEqual({
      type: "phase",
      data: {
        name: "package_install",
        status: "completed",
        duration_ms: 0,
        outcome: "failed",
      },
    });
    expect(JSON.stringify(events)).not.toContain(secret);
  });

  it("emits a failed terminal event and preserves the operation error", async () => {
    const events: RunEvent[] = [];
    const phases = new RunPhaseRecorder(
      async (batch) => events.push(...batch),
      () => 50,
    );
    const failure = new Error("workspace failed");

    await expect(
      phases.measure("workspace", async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(events.at(-1)).toEqual({
      type: "phase",
      data: {
        name: "workspace",
        status: "failed",
        duration_ms: 0,
        outcome: "failed",
      },
    });
  });

  it("does not let timing ingestion failure replace successful work or operation errors", async () => {
    const success = new RunPhaseRecorder(
      async () => {
        throw new Error("events unavailable");
      },
      () => 50,
    );

    await expect(success.measure("workspace", async () => "ready")).resolves.toBe("ready");
    await expect(success.skip("provision", "not_configured")).resolves.toBeUndefined();

    const failure = new Error("workspace failed");
    const failed = new RunPhaseRecorder(
      async () => {
        throw new Error("events unavailable");
      },
      () => 50,
    );
    await expect(
      failed.measure("workspace", async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });

  it("makes skipped work explicit and rejects overlapping phases", async () => {
    const events: RunEvent[] = [];
    const phases = new RunPhaseRecorder(
      async (batch) => events.push(...batch),
      () => 10,
    );

    await phases.skip("provision", "not_configured");
    phases.start("agent");

    expect(() => phases.start("acceptance")).toThrow("run_phase_already_active:agent");
    await phases.finish({ outcome: "succeeded" });

    expect(events[0]).toEqual({
      type: "phase",
      data: {
        name: "provision",
        status: "skipped",
        duration_ms: 0,
        outcome: "skipped",
        reason: "not_configured",
      },
    });
  });
});
