import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export function defaultConfigPath() {
  return join(homedir(), ".facility", "config.json");
}

export function loadConfig(path = defaultConfigPath()) {
  if (!existsSync(path)) return { path, currentProfile: "default", profiles: {} };
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return {
    path,
    currentProfile: parsed.currentProfile || "default",
    profiles: parsed.profiles || {},
  };
}

export function saveConfig(config, path = config.path || defaultConfigPath()) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        currentProfile: config.currentProfile || "default",
        profiles: config.profiles || {},
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );
  chmodSync(path, 0o600);
}

export function getProfile(config, name) {
  const profile = name || config.currentProfile || "default";
  return { name: profile, value: config.profiles?.[profile] };
}
