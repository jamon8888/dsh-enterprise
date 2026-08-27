import { describe, expect, it } from "vitest";
import {
  nestedDockerEnabled,
  nestedDockerSettingIsValid,
  provisioningCommandsAreCoherent,
  provisioningDepth,
  provisioningSettingIsValid,
} from "../src/sandbox/capabilities.js";

describe("sandbox capabilities", () => {
  it.each([
    [{ nested_docker: false }, false],
    [{ nested_docker: true }, true],
    [{}, true],
    [null, true],
    [["not", "an", "object"], true],
    [{ nested_docker: "false" }, true],
  ] as const)("normalizes %j to the conservative nested-Docker boundary", (setup, expected) => {
    expect(nestedDockerEnabled(setup)).toBe(expected);
  });

  it("rejects non-boolean writes while preserving unrelated setup keys", () => {
    expect(nestedDockerSettingIsValid({ provision_cmd: "pnpm setup" })).toBe(true);
    expect(nestedDockerSettingIsValid({ nested_docker: false, deps: [] })).toBe(true);
    expect(nestedDockerSettingIsValid({ nested_docker: 0 })).toBe(false);
  });

  it.each([
    [{ provisioning: "full" }, "full"],
    [{ provisioning: "deps_only" }, "deps_only"],
    [{ provisioning: "none" }, "none"],
    [{}, "full"],
    [null, "full"],
    [["none"], "full"],
    [{ provisioning: "skip" }, "full"],
    [{ provisioning: false }, "full"],
  ] as const)("normalizes %j to provisioning depth %s", (setup, expected) => {
    expect(provisioningDepth(setup)).toBe(expected);
  });

  it("accepts only the closed provisioning-depth enum", () => {
    expect(provisioningSettingIsValid({ deps: [] })).toBe(true);
    expect(provisioningSettingIsValid({ provisioning: "full" })).toBe(true);
    expect(provisioningSettingIsValid({ provisioning: "deps_only" })).toBe(true);
    expect(provisioningSettingIsValid({ provisioning: "none" })).toBe(true);
    expect(provisioningSettingIsValid({ provisioning: "skip" })).toBe(false);
    expect(provisioningSettingIsValid({ provisioning: false })).toBe(false);
  });

  it("rejects command overrides for phases the profile disables", () => {
    expect(
      provisioningCommandsAreCoherent({
        provisioning: "full",
        provision_cmd: "pnpm setup",
        package_install_cmd: "pnpm install",
      }),
    ).toBe(true);
    expect(
      provisioningCommandsAreCoherent({
        provisioning: "deps_only",
        package_install_cmd: "pnpm install",
      }),
    ).toBe(true);
    expect(
      provisioningCommandsAreCoherent({
        provisioning: "deps_only",
        provisionCmd: "pnpm setup",
      }),
    ).toBe(false);
    expect(
      provisioningCommandsAreCoherent({
        provisioning: "none",
        packageInstallCmd: "pnpm install",
      }),
    ).toBe(false);
  });
});
