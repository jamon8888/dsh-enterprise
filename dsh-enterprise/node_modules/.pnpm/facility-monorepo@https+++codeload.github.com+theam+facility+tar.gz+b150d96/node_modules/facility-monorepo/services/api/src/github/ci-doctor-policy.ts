import { createHash } from "node:crypto";

const FAILURE_CONCLUSIONS = new Set([
  "action_required",
  "cancelled",
  "failure",
  "stale",
  "startup_failure",
  "timed_out",
]);
const LOW_RISK_CATEGORIES = new Set(["build", "lint", "typecheck", "unit_test"]);
const CATEGORY_PRIORITY = [
  "secret_scan",
  "workflow_security",
  "auth_access",
  "dependency_supply_chain",
  "verify_guard",
  "unknown",
  "e2e",
  "flaky_infra",
  "typecheck",
  "lint",
  "unit_test",
  "build",
];
const SENSITIVE_PATHS = [
  /^\.github\//,
  /^\.claude\//,
  /^\.agents\//,
  /(^|\/)guards\//,
  /(^|\/)scripts\/ci\//,
  /(^|\/)\.env(?:\.|$)/,
  /(^|\/)migrations?\//,
  /(^|\/)(?:auth|authorization|rbac|access-control|permissions?|secrets?|crypto)(?:\/|[._-]|$)/i,
  /(^|\/)middleware\.[cm]?[jt]sx?$/,
  /(^|\/)(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|pyproject\.toml|poetry\.lock|Cargo\.toml|Cargo\.lock|go\.mod|go\.sum)$/,
];

const TOKEN_RE = /\b(?:gh[pousr]_|github_pat_|sk-|sb_)[A-Za-z0-9_=-]{8,}\b/g;
const URL_RE = /https?:\/\/\S+/g;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const SHA_RE = /\b[0-9a-f]{7,40}\b/gi;
const NUMBER_RE = /\b\d{2,}\b/g;
const GITHUB_SHA_RE = /^[0-9a-f]{40}$/i;

export type CiDoctorCheck = {
  id?: number;
  name?: string | null;
  status?: string | null;
  conclusion?: string | null;
  detailsUrl?: string | null;
  output?: { title?: string | null; summary?: string | null } | null;
  app?: { slug?: string | null } | null;
};

export type CiDoctorPullRequest = {
  number: number;
  state: string;
  draft: boolean;
  url: string;
  head: { ref: string; sha: string; repo: { fullName: string } };
  base: { ref: string; repo: { fullName: string } };
  changedFiles: string[];
};

export type CiDoctorFailure = {
  category: string;
  check: string;
  conclusion: string;
  fingerprint: string;
  risk: "low" | "high";
  verificationCommands: string[];
};

type DecisionBase = {
  attemptsForFingerprint: number;
  attemptsOnBranch: number;
  failure: CiDoctorFailure;
  pullRequest: CiDoctorPullRequest;
};

export type CiDoctorDecision =
  | { action: "none"; code: string; reason: string }
  | (DecisionBase & { action: "triage"; code: "triage"; reason: string })
  | (DecisionBase & { action: "repair"; code: "repair"; reason: string });

export function sanitizeCiFailureSignal(value: unknown, maxLength = 1_200) {
  return String(value ?? "")
    .replace(TOKEN_RE, "[redacted-token]")
    .replace(URL_RE, "[url]")
    .replace(UUID_RE, "[uuid]")
    .replace(SHA_RE, "[sha]")
    .replace(NUMBER_RE, "[n]")
    .slice(0, maxLength)
    .trim();
}

export function classifyCiDoctorFailure(check: CiDoctorCheck): CiDoctorFailure {
  const output = sanitizeCiFailureSignal(
    `${check.output?.title ?? ""}\n${check.output?.summary ?? ""}`,
  );
  // The repository owns check names. Output may contain contributor-controlled
  // text, so it can distinguish fingerprints but can never lower risk.
  const haystack = String(check.name ?? "").toLowerCase();
  const conclusion = String(check.conclusion ?? "failure").toLowerCase();
  let category = "unknown";

  if (/\b(gitleaks|secret scan|secret-scanning|credential leak)\b/.test(haystack)) {
    category = "secret_scan";
  } else if (
    /\b(codeql|security|trivy|scorecard|workflow security|github actions|pull_request_target)\b/.test(
      haystack,
    )
  ) {
    category = "workflow_security";
  } else if (
    /\b(auth|authorization|rbac|rls|jwt|service role|security definer|migration)\b/.test(haystack)
  ) {
    category = "auth_access";
  } else if (
    /\b(audit|dependabot|dependency|supply chain|lockfile|package lock)\b/.test(haystack)
  ) {
    category = "dependency_supply_chain";
  } else if (/\b(verify|guard|policy check|invariant)\b/.test(haystack)) {
    category = "verify_guard";
  } else if (/\b(playwright|e2e|browser|ui smoke|visual regression)\b/.test(haystack)) {
    category = "e2e";
  } else if (["cancelled", "stale", "startup_failure", "timed_out"].includes(conclusion)) {
    category = "flaky_infra";
  } else if (/\b(typecheck|tsc|typescript|type error)\b/.test(haystack)) {
    category = "typecheck";
  } else if (/\b(lint|eslint|biome)\b/.test(haystack)) {
    category = "lint";
  } else if (/\b(vitest|jest|unit test|test)\b/.test(haystack)) {
    category = "unit_test";
  } else if (/\b(build|compile)\b/.test(haystack)) {
    category = "build";
  }

  const normalizedSignal = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /error|failed|failure|exception|expected|received|cannot|timeout/i.test(line))
    .slice(0, 3)
    .join(" | ");
  const fingerprint = createHash("sha256")
    .update(
      [category, normalize(check.name), normalize(conclusion), normalize(normalizedSignal)].join(
        "|",
      ),
    )
    .digest("hex")
    .slice(0, 16);

  return {
    category,
    check: safeLabel(check.name),
    conclusion,
    fingerprint,
    risk: LOW_RISK_CATEGORIES.has(category) ? "low" : "high",
    verificationCommands: verificationCommands(category),
  };
}

export function decideCiDoctorAction(input: {
  eventHeadSha: string;
  eventBranch: string;
  pullRequest?: CiDoctorPullRequest | null;
  checks: CiDoctorCheck[];
  doctorRunIds?: Array<string | number>;
  attemptsForFingerprint: number;
  attemptsOnBranch: number;
  attemptedAtHead: boolean;
  triageSeen: boolean;
  maxAttemptsForFingerprint: number;
  maxAttemptsOnBranch: number;
}): CiDoctorDecision {
  const pullRequest = input.pullRequest;
  if (!pullRequest) return none("missing_pr", "no same-repository PR is associated with this run");
  if (!GITHUB_SHA_RE.test(input.eventHeadSha)) {
    return none("malformed_head", "workflow run head SHA is malformed");
  }
  if (pullRequest.state !== "open") return none("closed_pr", "PR is not open");
  if (pullRequest.head.sha !== input.eventHeadSha || pullRequest.head.ref !== input.eventBranch) {
    return none("stale_head", "workflow run is stale for the current PR head");
  }

  const relevantChecks = latestChecks(input.checks).filter(
    (check) => !isDoctorCheck(check, input.doctorRunIds ?? []),
  );
  if (relevantChecks.length === 0) {
    return none("missing_checks", "no current-head non-doctor checks were found");
  }
  if (relevantChecks.some((check) => check.status !== "completed")) {
    return none("pending_checks", "waiting for all non-doctor checks to reach a terminal state");
  }

  const failures = relevantChecks
    .filter((check) => FAILURE_CONCLUSIONS.has(String(check.conclusion ?? "").toLowerCase()))
    .map(classifyCiDoctorFailure)
    .sort(compareFailureRisk);
  if (failures.length === 0) {
    return none("checks_passed", "all terminal checks passed or were skipped");
  }

  const failure = failures[0] as CiDoctorFailure;
  const base: DecisionBase = {
    attemptsForFingerprint: input.attemptsForFingerprint,
    attemptsOnBranch: input.attemptsOnBranch,
    failure,
    pullRequest,
  };
  const crossRepository =
    !pullRequest.head.repo.fullName ||
    pullRequest.head.repo.fullName.toLowerCase() !== pullRequest.base.repo.fullName.toLowerCase();
  if (crossRepository) {
    return triageOnce(
      base,
      input.triageSeen,
      "fork or cross-repository PRs are never auto-repaired",
    );
  }
  if (hasSensitiveCiDoctorFiles(pullRequest.changedFiles)) {
    return triageOnce(base, input.triageSeen, "PR touches a privileged or sensitive boundary");
  }
  if (failure.risk === "high") {
    return triageOnce(
      base,
      input.triageSeen,
      `failure category ${failure.category} requires human review`,
    );
  }
  if (input.attemptedAtHead) {
    return none(
      "attempted_head",
      `repair already attempted at current head for ${failure.fingerprint}`,
    );
  }
  if (input.attemptsForFingerprint >= input.maxAttemptsForFingerprint) {
    return none(
      "fingerprint_limit",
      `repair attempt limit reached for fingerprint ${failure.fingerprint}`,
    );
  }
  if (input.attemptsOnBranch >= input.maxAttemptsOnBranch) {
    return none("branch_limit", "absolute repair attempt limit reached for this branch");
  }

  return {
    ...base,
    action: "repair",
    code: "repair",
    reason: "low-risk failure on a current, same-repository Facility delivery PR",
  };
}

export function hasSensitiveCiDoctorFiles(files: string[]) {
  return files.some((file) => SENSITIVE_PATHS.some((pattern) => pattern.test(file)));
}

function latestChecks(checks: CiDoctorCheck[]) {
  const latest = new Map<string, CiDoctorCheck>();
  for (const check of [...checks].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))) {
    const key = `${check.app?.slug ?? "unknown"}:${check.name ?? "unknown"}`;
    if (!latest.has(key)) latest.set(key, check);
  }
  return [...latest.values()];
}

function isDoctorCheck(check: CiDoctorCheck, doctorRunIds: Array<string | number>) {
  const name = String(check.name ?? "").toLowerCase();
  const detailsUrl = String(check.detailsUrl ?? "");
  return (
    name.includes("facility-doctor") ||
    name.includes("ci-doctor") ||
    doctorRunIds.some((runId) => detailsUrl.includes(`/actions/runs/${String(runId)}/`))
  );
}

function triageOnce(base: DecisionBase, triageSeen: boolean, reason: string): CiDoctorDecision {
  if (triageSeen)
    return none("triage_seen", `triage already posted for ${base.failure.fingerprint}`);
  return { ...base, action: "triage", code: "triage", reason };
}

function none(code: string, reason: string): CiDoctorDecision {
  return { action: "none", code, reason };
}

function compareFailureRisk(a: CiDoctorFailure, b: CiDoctorFailure) {
  if (a.risk !== b.risk) return a.risk === "high" ? -1 : 1;
  return CATEGORY_PRIORITY.indexOf(a.category) - CATEGORY_PRIORITY.indexOf(b.category);
}

function verificationCommands(category: string) {
  if (category === "lint") return ["lint"];
  if (category === "typecheck") return ["typecheck"];
  if (category === "unit_test") return ["test"];
  if (category === "build") return ["typecheck", "build"];
  return [];
}

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeLabel(value: unknown) {
  return String(value ?? "unknown")
    .replace(/[\r\n\t]+/g, " ")
    .replaceAll("@", "＠")
    .replaceAll("<", "‹")
    .replaceAll(">", "›")
    .replaceAll("`", "'")
    .replace(/\s+/g, " ")
    .slice(0, 160)
    .trim();
}
