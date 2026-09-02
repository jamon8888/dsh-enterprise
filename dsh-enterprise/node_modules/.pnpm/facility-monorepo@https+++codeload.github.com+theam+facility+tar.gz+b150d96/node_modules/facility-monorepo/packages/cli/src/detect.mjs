// Stack detection: read the target repo and propose sensible defaults so
// `init` asks six short questions instead of twenty.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function git(cwd, args) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

export function detect(dir) {
  const pkg = readJson(join(dir, "package.json"));
  const scripts = pkg?.scripts ?? {};

  const packageManager = existsSync(join(dir, "pnpm-lock.yaml"))
    ? "pnpm"
    : existsSync(join(dir, "yarn.lock"))
      ? "yarn"
      : existsSync(join(dir, "package-lock.json"))
        ? "npm"
        : pkg
          ? "npm"
          : "none";

  const runner = packageManager === "none" ? null : packageManager === "npm" ? "npm run" : `${packageManager} run`;
  const checks = [];
  if (runner) {
    for (const name of ["typecheck", "lint", "test", "build"]) {
      if (scripts[name]) checks.push(`${runner} ${name}`);
    }
  }

  const provision = runner && scripts["setup"] ? `${runner} setup` : "";

  const isGitRepo = git(dir, ["rev-parse", "--is-inside-work-tree"]) === "true";
  let defaultBranch = "main";
  const originHead = git(dir, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
  if (originHead) defaultBranch = originHead.replace("refs/remotes/origin/", "");
  else {
    const current = git(dir, ["branch", "--show-current"]);
    if (current) defaultBranch = current;
  }

  let org = "";
  const remote = git(dir, ["remote", "get-url", "origin"]);
  const remoteMatch = remote.match(/[/:]([^/:]+)\/([^/]+?)(\.git)?$/);
  if (remoteMatch) org = remoteMatch[1];

  const migrationDirs = ["migrations", "supabase/migrations", "db/migrations", "prisma/migrations"].filter((d) =>
    existsSync(join(dir, d))
  );

  // Existing check workflows (by their `name:`), so the doctor knows what to
  // watch. Facility's own workflows are excluded — the watchtower covers them.
  const workflowNames = [];
  const deploymentProviders = new Set();
  try {
    for (const file of readdirSync(join(dir, ".github/workflows"))) {
      if (!/\.ya?ml$/.test(file) || file.startsWith("facility-")) continue;
      const workflow = readFileSync(join(dir, ".github/workflows", file), "utf8");
      const nameMatch = workflow.match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m);
      if (nameMatch) workflowNames.push(nameMatch[1].trim());
      detectDeploymentProvider(workflow, deploymentProviders);
    }
  } catch {}
  if (existsSync(join(dir, "vercel.json"))) deploymentProviders.add("vercel");
  if (existsSync(join(dir, "netlify.toml"))) deploymentProviders.add("netlify");
  if (existsSync(join(dir, "fly.toml"))) deploymentProviders.add("fly.io");
  if (existsSync(join(dir, "render.yaml"))) deploymentProviders.add("render");
  if (existsSync(join(dir, "Dockerfile"))) deploymentProviders.add("container-image");
  const board = detectBoard(dir, org);
  const facility = readJson(join(dir, ".facility.json"));

  return {
    isGitRepo,
    defaultBranch,
    packageManager,
    checks,
    provision,
    org,
    workflowNames,
    deploymentProviders: [...deploymentProviders].sort(),
    board,
    previewConfigured: facility?.preview?.enabled === true,
    suggestedModules: migrationDirs.length ? ["database"] : [],
    existing: {
      agentsMd: existsSync(join(dir, "AGENTS.md")),
      claudeMd: existsSync(join(dir, "CLAUDE.md")),
      claudeSettings: existsSync(join(dir, ".claude/settings.json")),
      standard: existsSync(join(dir, "STANDARD.md")),
    },
  };
}

function detectDeploymentProvider(content, providers) {
  const lower = content.toLowerCase();
  if (lower.includes("vercel")) providers.add("vercel");
  if (lower.includes("netlify")) providers.add("netlify");
  if (lower.includes("flyctl") || lower.includes("fly.io")) providers.add("fly.io");
  if (lower.includes("cloudflare") || lower.includes("wrangler")) providers.add("cloudflare");
  if (lower.includes("amazon-ecr") || lower.includes("amazon-ecs")) providers.add("aws");
  if (lower.includes("render.com")) providers.add("render");
}

function detectBoard(dir, fallbackOrg) {
  for (const path of ["AGENTS.md", "CLAUDE.md", "README.md"]) {
    try {
      const match = readFileSync(join(dir, path), "utf8").match(
        /github\.com\/orgs\/([^/\s]+)\/projects\/(\d+)/i,
      );
      if (match?.[2]) return { org: match[1] || fallbackOrg, project: Number(match[2]) };
    } catch {}
  }
  return null;
}
