#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const apiTests = readdirSync(new URL("../services/api/test", import.meta.url))
  .filter((name) => name.endsWith(".test.ts") && name !== "sandbox.e2e.test.ts")
  .sort()
  .map((name) => `test/${name}`);

if (apiTests.length === 0) throw new Error("No API tests discovered");

run("pnpm", ["--filter", "@facility/db", "test"], "facility_test");
run("pnpm", ["--filter", "@theagilemonkeys/facility", "test"], "facility_test");
run(
  "pnpm",
  ["--filter", "@facility/api", "exec", "vitest", "run", "--fileParallelism=false", ...apiTests],
  "facility_test",
);
run("pnpm", ["--filter", "@facility/gateway", "test"], "facility_gw");

function run(command, args, database) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: `postgres://facility:facility@127.0.0.1:5461/${database}`,
    },
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const reportedSkip =
    /# SKIP\b/i.test(output) ||
    /\b(?:[1-9]\d*\s+skipped|skipped\s+[1-9]\d*)\b/i.test(output);
  if (reportedSkip) {
    console.error(
      `Critical integration suite for ${database} reported a skip. Critical tests must run, not degrade to green.`,
    );
    process.exit(1);
  }
}
