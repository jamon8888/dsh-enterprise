import { describe, expect, it } from "vitest";
import { sandboxRuntimeEvent } from "../src/runtime.js";

describe("sandbox runtime telemetry", () => {
  it.each([
    ["overlay2", false],
    ["overlayfs", false],
    ["fuse-overlayfs", false],
    ["vfs", true],
  ] as const)("reports the allowlisted %s storage driver", (driver, degraded) => {
    expect(
      sandboxRuntimeEvent({
        FACILITY_SANDBOX_NESTED_DOCKER: "1",
        FACILITY_DOCKER_STORAGE_DRIVER: driver,
        FACILITY_SECRET: "must-not-leak",
      }),
    ).toEqual({
      type: "sandbox_runtime",
      data: {
        nested_docker: true,
        docker_storage_driver: driver,
        degraded,
      },
    });
  });

  it("reports the no-Docker fast path without copying arbitrary environment data", () => {
    const event = sandboxRuntimeEvent({
      FACILITY_SANDBOX_NESTED_DOCKER: "0",
      FACILITY_DOCKER_STORAGE_DRIVER: "attacker-controlled",
      RUNNER_TOKEN: "must-not-leak",
    });
    expect(event).toEqual({
      type: "sandbox_runtime",
      data: {
        nested_docker: false,
        docker_storage_driver: "none",
        degraded: false,
      },
    });
    expect(JSON.stringify(event)).not.toContain("must-not-leak");
    expect(JSON.stringify(event)).not.toContain("attacker-controlled");
  });

  it("emits nothing outside the trusted CodeBuild wrapper", () => {
    expect(sandboxRuntimeEvent({})).toBeNull();
    expect(sandboxRuntimeEvent({ FACILITY_SANDBOX_NESTED_DOCKER: "false" })).toBeNull();
  });
});
