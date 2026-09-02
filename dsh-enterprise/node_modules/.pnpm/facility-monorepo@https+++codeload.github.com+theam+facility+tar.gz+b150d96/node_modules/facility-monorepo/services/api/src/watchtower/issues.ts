import { newId } from "@facility/core";
import { type FacilityDb, insertAuditEvent, platformIssues } from "@facility/db";
import { and, eq, inArray, sql } from "drizzle-orm";

// Canonical severity ladder. Producers historically emitted "high"/"medium",
// which the inbox and project-health filters (keyed on "error") silently
// dropped; normalize everything to this set so a run failure stays actionable
// wherever issues surface.
export type IssueSeverity = "info" | "warn" | "error" | "critical";

// Severities that demand operator attention — what the inbox shows and what
// turns project health red.
export const ACTIONABLE_SEVERITIES: IssueSeverity[] = ["error", "critical"];

export function normalizeSeverity(severity: string): IssueSeverity {
  switch (severity.trim().toLowerCase()) {
    case "critical":
    case "fatal":
      return "critical";
    case "error":
    case "high":
      return "error";
    case "warn":
    case "warning":
    case "medium":
      return "warn";
    default:
      return "info";
  }
}

export function isActionableSeverity(severity: string): boolean {
  return ACTIONABLE_SEVERITIES.includes(normalizeSeverity(severity));
}

export type IssueInput = {
  orgId: string;
  projectId?: string | null;
  kind: string;
  severity: IssueSeverity;
  fingerprint: string;
  title: string;
  bodyMd: string;
};

export type IssueProjectScope = { projectId: string };

export class PlatformIssueScopeMismatchError extends Error {
  constructor() {
    super("platform_issue_project_scope_mismatch");
    this.name = "PlatformIssueScopeMismatchError";
  }
}

export async function raisePlatformIssue(
  db: FacilityDb,
  input: IssueInput,
  scope?: IssueProjectScope,
) {
  const severity = normalizeSeverity(input.severity);
  const now = new Date();
  const projectId = input.projectId ?? null;
  if (scope && projectId !== scope.projectId) throw new PlatformIssueScopeMismatchError();
  // Read the prior state ONLY to decide whether this raise is a reopen (an audit
  // signal). Correctness and dedupe are handled atomically by the ON CONFLICT
  // upsert below, so a race here can at worst mislabel the audit event — it can
  // never corrupt state or throw on a concurrent first raise.
  const prior = (
    await db
      .select({ state: platformIssues.state })
      .from(platformIssues)
      .where(
        and(
          eq(platformIssues.orgId, input.orgId),
          eq(platformIssues.fingerprint, input.fingerprint),
          scope ? eq(platformIssues.projectId, scope.projectId) : undefined,
        ),
      )
      .limit(1)
  )[0];
  const updated = (
    await db
      .insert(platformIssues)
      .values({
        id: newId("iss"),
        orgId: input.orgId,
        projectId: projectId ?? undefined,
        kind: input.kind,
        severity,
        fingerprint: input.fingerprint,
        title: input.title,
        bodyMd: input.bodyMd,
        state: "open",
      })
      .onConflictDoUpdate({
        target: [platformIssues.orgId, platformIssues.fingerprint],
        // Project-scoped callers may update only an issue already owned by that
        // project. PostgreSQL evaluates this in the conflict update itself, so
        // a concurrent insert cannot turn a check-then-write race into a
        // cross-project mutation.
        setWhere: scope ? eq(platformIssues.projectId, scope.projectId) : sql`true`,
        set: {
          projectId: sql`coalesce(${projectId}, ${platformIssues.projectId})`,
          kind: input.kind,
          severity,
          title: input.title,
          bodyMd: input.bodyMd,
          // Recurrence reopens a resolved issue; an open/acked one stays as-is.
          state: sql`case when ${platformIssues.state} = 'resolved' then 'open' else ${platformIssues.state} end`,
          lastSeen: now,
          count: sql`${platformIssues.count} + 1`,
          updatedAt: now,
        },
      })
      .returning()
  )[0];
  if (!updated && scope) throw new PlatformIssueScopeMismatchError();
  if (prior?.state === "resolved") {
    await insertAuditEvent(db, {
      orgId: input.orgId,
      projectId: updated?.projectId ?? projectId,
      actor: { type: "system", name: "watchtower" },
      action: "issue.reopened",
      target: { type: "issue", id: updated?.id ?? "" },
      payload: { fingerprint: input.fingerprint, kind: input.kind },
    });
  }
  return updated;
}

export async function resolvePlatformIssue(
  db: FacilityDb,
  orgId: string,
  fingerprint: string,
  note: string,
  scope?: IssueProjectScope,
) {
  const existing = (
    await db
      .select()
      .from(platformIssues)
      .where(and(eq(platformIssues.orgId, orgId), eq(platformIssues.fingerprint, fingerprint)))
      .limit(1)
  )[0];
  if (existing && scope && existing.projectId !== scope.projectId) {
    throw new PlatformIssueScopeMismatchError();
  }
  if (!existing || existing.state === "resolved") return existing ?? null;
  const resolved = (
    await db
      .update(platformIssues)
      .set({
        state: "resolved",
        bodyMd: `${existing.bodyMd}\n\nRecovery: ${note}`,
        lastSeen: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(platformIssues.orgId, orgId),
          eq(platformIssues.id, existing.id),
          scope ? eq(platformIssues.projectId, scope.projectId) : undefined,
        ),
      )
      .returning()
  )[0];
  if (!resolved && scope) throw new PlatformIssueScopeMismatchError();
  return resolved;
}

export async function openIssuesForProject(db: FacilityDb, orgId: string, projectId: string) {
  return db
    .select()
    .from(platformIssues)
    .where(
      and(
        eq(platformIssues.orgId, orgId),
        eq(platformIssues.projectId, projectId),
        inArray(platformIssues.state, ["open", "acked"]),
      ),
    );
}
