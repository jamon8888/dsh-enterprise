import { describe, expect, it } from "vitest";
import { derivePhases, phaseForEvent } from "@/components/run/cockpit";
import type { RunEvent } from "@/lib/api";

describe("run phase presentation", () => {
  it.each([
    ["bootstrap", "provisioning"],
    ["workspace", "provisioning"],
    ["runner_runtime", "provisioning"],
    ["package_install", "provisioning"],
    ["provision", "provisioning"],
    ["agent", "running"],
    ["result_capture", "running"],
    ["acceptance", "checks"],
    ["delivery", "running"],
  ] as const)("maps the %s timing event without treating its outcome as the run result", (name, phase) => {
    expect(
      phaseForEvent({
        orgId: "org_test",
        runId: "run_test",
        seq: 1,
        ts: "2026-08-06T00:00:00.000Z",
        type: "phase",
        data: { name, status: "completed", duration_ms: 1, outcome: "succeeded" },
      } satisfies RunEvent),
    ).toBe(phase);
  });

  it("does not turn a completed acceptance timing with a failed outcome into a failed check", () => {
    const event = {
      orgId: "org_test",
      runId: "run_test",
      seq: 1,
      ts: "2026-08-06T00:00:00.000Z",
      type: "phase",
      data: {
        name: "acceptance",
        status: "completed",
        duration_ms: 1,
        outcome: "failed",
      },
    } satisfies RunEvent;

    const checks = derivePhases([event], {
      queuedAt: "2026-08-06T00:00:00.000Z",
      startedAt: "2026-08-06T00:00:00.000Z",
      status: "running",
    }).find((phase) => phase.key === "checks");

    expect(checks).toMatchObject({ status: "ok", count: 1, latest: event });
  });
});
