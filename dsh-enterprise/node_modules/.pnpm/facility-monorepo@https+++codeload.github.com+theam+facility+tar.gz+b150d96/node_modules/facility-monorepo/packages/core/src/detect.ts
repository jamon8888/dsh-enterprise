export type DetectionInput = {
  files: Map<string, string> | Record<string, string>;
  defaultBranch?: string;
  org?: string;
};

export type RepoDetection = {
  isGitRepo: boolean;
  defaultBranch: string;
  packageManager: "pnpm" | "yarn" | "npm" | "none";
  checks: string[];
  provision: string;
  org: string;
  workflowNames: string[];
  deploymentProviders: string[];
  board: { org: string; project: number } | null;
  previewConfigured: boolean;
  suggestedModules: string[];
  existing: {
    agentsMd: boolean;
    claudeMd: boolean;
    claudeSettings: boolean;
    standard: boolean;
  };
};

function lookup(files: Map<string, string> | Record<string, string>) {
  return files instanceof Map ? files : new Map(Object.entries(files));
}

function readJson<T>(content: string | undefined): T | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function detectFromFiles(input: DetectionInput): RepoDetection {
  const files = lookup(input.files);
  const pkg = readJson<{ scripts?: Record<string, string> }>(files.get("package.json"));
  const scripts = pkg?.scripts ?? {};
  const packageManager = files.has("pnpm-lock.yaml")
    ? "pnpm"
    : files.has("yarn.lock")
      ? "yarn"
      : files.has("package-lock.json")
        ? "npm"
        : pkg
          ? "npm"
          : "none";
  const runner =
    packageManager === "none"
      ? null
      : packageManager === "npm"
        ? "npm run"
        : `${packageManager} run`;
  const checks: string[] = [];
  if (runner) {
    for (const name of ["typecheck", "lint", "test", "build"]) {
      if (scripts[name]) checks.push(`${runner} ${name}`);
    }
  }
  const workflowNames: string[] = [];
  const deploymentProviders = new Set<string>();
  for (const [path, content] of files) {
    const match = path.match(/^\.github\/workflows\/([^/]+\.ya?ml)$/);
    if (!match || match[1]?.startsWith("facility-")) continue;
    const nameMatch = content.match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m);
    if (nameMatch?.[1]) workflowNames.push(nameMatch[1].trim());
    detectDeploymentProvider(content, deploymentProviders);
  }
  if (files.has("vercel.json")) deploymentProviders.add("vercel");
  if (files.has("netlify.toml")) deploymentProviders.add("netlify");
  if (files.has("fly.toml")) deploymentProviders.add("fly.io");
  if (files.has("render.yaml")) deploymentProviders.add("render");
  if (files.has("Dockerfile")) deploymentProviders.add("container-image");
  const facility = readJson<{ preview?: { enabled?: boolean } }>(files.get(".facility.json"));
  const board = detectBoard(files, input.org ?? "");
  const migrationDirs = [
    "migrations",
    "supabase/migrations",
    "db/migrations",
    "prisma/migrations",
  ].filter((dir) => [...files.keys()].some((path) => path.startsWith(`${dir}/`)));
  return {
    isGitRepo: true,
    defaultBranch: input.defaultBranch ?? "main",
    packageManager,
    checks,
    provision: runner && scripts.setup ? `${runner} setup` : "",
    org: input.org ?? "",
    workflowNames,
    deploymentProviders: [...deploymentProviders].sort(),
    board,
    previewConfigured: facility?.preview?.enabled === true,
    suggestedModules: migrationDirs.length ? ["database"] : [],
    existing: {
      agentsMd: files.has("AGENTS.md"),
      claudeMd: files.has("CLAUDE.md"),
      claudeSettings: files.has(".claude/settings.json"),
      standard: files.has("STANDARD.md"),
    },
  };
}

function detectDeploymentProvider(content: string, providers: Set<string>) {
  const lower = content.toLowerCase();
  if (lower.includes("vercel")) providers.add("vercel");
  if (lower.includes("netlify")) providers.add("netlify");
  if (lower.includes("flyctl") || lower.includes("fly.io")) providers.add("fly.io");
  if (lower.includes("cloudflare") || lower.includes("wrangler")) providers.add("cloudflare");
  if (lower.includes("amazon-ecr") || lower.includes("amazon-ecs")) providers.add("aws");
  if (lower.includes("render.com")) providers.add("render");
}

function detectBoard(files: Map<string, string>, fallbackOrg: string) {
  for (const path of ["AGENTS.md", "CLAUDE.md", "README.md"]) {
    const match = files.get(path)?.match(/github\.com\/orgs\/([^/\s]+)\/projects\/(\d+)/i);
    if (match?.[2]) {
      return { org: match[1] ?? fallbackOrg, project: Number(match[2]) };
    }
  }
  return null;
}
