export const NESTED_DOCKER_SETUP_KEY = "nested_docker";
export const PROVISIONING_SETUP_KEY = "provisioning";
export const PROVISIONING_DEPTHS = ["full", "deps_only", "none"] as const;

export type ProvisioningDepth = (typeof PROVISIONING_DEPTHS)[number];

/**
 * Existing profiles predate capability flags and ran with nested Docker on AWS.
 * Preserve that behavior unless a trusted profile explicitly disables it.
 * Invalid persisted JSON also stays on the legacy, fully exercised boundary
 * instead of silently selecting the new fast path; API writes reject invalid
 * values before they reach storage.
 */
export function nestedDockerEnabled(setup: unknown): boolean {
  if (!setup || typeof setup !== "object" || Array.isArray(setup)) return true;
  const value = (setup as Record<string, unknown>)[NESTED_DOCKER_SETUP_KEY];
  return typeof value === "boolean" ? value : true;
}

export function nestedDockerSettingIsValid(setup: Record<string, unknown>): boolean {
  return (
    !Object.hasOwn(setup, NESTED_DOCKER_SETUP_KEY) ||
    typeof setup[NESTED_DOCKER_SETUP_KEY] === "boolean"
  );
}

/**
 * Provisioning depth is ordered: none skips all repository setup, deps_only
 * keeps dependency installation but skips service/database provisioning, and
 * full preserves the legacy lifecycle. Invalid persisted values retain full
 * setup; trusted writes reject them.
 */
export function provisioningDepth(setup: unknown): ProvisioningDepth {
  if (!setup || typeof setup !== "object" || Array.isArray(setup)) return "full";
  const value = (setup as Record<string, unknown>)[PROVISIONING_SETUP_KEY];
  return typeof value === "string" && PROVISIONING_DEPTHS.includes(value as ProvisioningDepth)
    ? (value as ProvisioningDepth)
    : "full";
}

export function provisioningSettingIsValid(setup: Record<string, unknown>): boolean {
  return (
    !Object.hasOwn(setup, PROVISIONING_SETUP_KEY) ||
    PROVISIONING_DEPTHS.includes(setup[PROVISIONING_SETUP_KEY] as ProvisioningDepth)
  );
}

export function provisioningCommandsAreCoherent(setup: Record<string, unknown>): boolean {
  const depth = provisioningDepth(setup);
  const provisionOverride = commandConfigured(setup, ["provision_cmd", "provisionCmd"]);
  const installOverride = commandConfigured(setup, ["package_install_cmd", "packageInstallCmd"]);
  if (depth !== "full" && provisionOverride) return false;
  return depth !== "none" || !installOverride;
}

function commandConfigured(setup: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => typeof setup[key] === "string" && setup[key].trim().length > 0);
}
