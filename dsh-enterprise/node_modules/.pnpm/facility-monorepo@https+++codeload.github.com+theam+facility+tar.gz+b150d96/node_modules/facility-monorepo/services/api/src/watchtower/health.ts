import { createDb, type FacilityDb } from "@facility/db";
import type { AppConfig } from "../types.js";
import { createGitHubClient, type GitHubClient } from "./github.js";
import { collectGitHubHealth } from "./github-health.js";
import { isActionableSeverity, openIssuesForProject } from "./issues.js";
import { collectPlatformHealth } from "./platform-health.js";

export async function runWatchtowerHealth(
  config: AppConfig,
  github: GitHubClient = createGitHubClient(),
) {
  const { db, client } = createDb(config.databaseUrl);
  try {
    await collectHealth(db, github);
  } finally {
    await client.end();
  }
}

export async function collectHealth(db: FacilityDb, github: GitHubClient) {
  await collectGitHubHealth(db, github);
  await collectPlatformHealth(db);
}

export async function projectHealth(db: FacilityDb, orgId: string, projectId: string) {
  const issues = await openIssuesForProject(db, orgId, projectId);
  const status = issues.some((issue) => isActionableSeverity(issue.severity))
    ? "red"
    : issues.length > 0
      ? "warn"
      : "ok";
  return {
    status,
    classification: status === "red" ? "unhealthy" : status === "warn" ? "degraded" : "healthy",
    signals: issues.map((issue) => ({
      kind: issue.kind,
      failureClass: failureClass(issue.kind),
      severity: issue.severity,
      fingerprint: issue.fingerprint,
      title: issue.title,
      state: issue.state,
      lastSeen: issue.lastSeen,
    })),
  };
}

function failureClass(kind: string) {
  if (kind.includes("budget")) return "budget";
  if (kind.includes("security")) return "security";
  if (
    kind.includes("platform") ||
    kind.includes("integration") ||
    kind.includes("preview") ||
    kind.includes("sandbox")
  ) {
    return "infrastructure";
  }
  if (kind.includes("agent") || kind.includes("run") || kind.includes("check")) return "agent";
  return "unknown";
}
