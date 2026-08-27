import type { RunEvent } from "./types.js";

const DOCKER_STORAGE_DRIVERS = new Set([
  "overlay2",
  // Docker's containerd image store reports the overlay snapshotter by this
  // name. Vercel Sandboxes use it even though the daemon's graph driver is the
  // same non-degraded overlay path.
  "overlayfs",
  "fuse-overlayfs",
  "vfs",
  "none",
]);

/** Fixed-shape CodeBuild runtime telemetry. Never copy arbitrary environment
 * values into run events: every runs:read principal in the org can see them. */
export function sandboxRuntimeEvent(env: NodeJS.ProcessEnv = process.env): RunEvent | null {
  const nested = env.FACILITY_SANDBOX_NESTED_DOCKER;
  if (nested !== "0" && nested !== "1") return null;
  const configuredDriver = env.FACILITY_DOCKER_STORAGE_DRIVER;
  const storageDriver =
    configuredDriver && DOCKER_STORAGE_DRIVERS.has(configuredDriver)
      ? configuredDriver
      : nested === "0"
        ? "none"
        : "unknown";
  return {
    type: "sandbox_runtime",
    data: {
      nested_docker: nested === "1",
      docker_storage_driver: storageDriver,
      degraded: storageDriver === "vfs",
    },
  };
}
