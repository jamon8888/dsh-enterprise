import { and, eq, gt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

type Db = PostgresJsDatabase<typeof schema>;

export function withOrg(db: Db, orgId: string) {
  return {
    projects: {
      list: (filters: { status?: string } = {}) =>
        db
          .select()
          .from(schema.projects)
          .where(
            filters.status
              ? and(eq(schema.projects.orgId, orgId), eq(schema.projects.status, filters.status))
              : eq(schema.projects.orgId, orgId),
          ),
      byId: async (projectId: string) =>
        (
          await db
            .select()
            .from(schema.projects)
            .where(and(eq(schema.projects.orgId, orgId), eq(schema.projects.id, projectId)))
            .limit(1)
        )[0] ?? null,
    },
    repos: {
      listForProject: (projectId: string) =>
        db
          .select()
          .from(schema.repos)
          .where(and(eq(schema.repos.orgId, orgId), eq(schema.repos.projectId, projectId))),
      byId: async (repoId: string) =>
        (
          await db
            .select()
            .from(schema.repos)
            .where(and(eq(schema.repos.orgId, orgId), eq(schema.repos.id, repoId)))
            .limit(1)
        )[0] ?? null,
    },
    runs: {
      listForProject: (projectId: string, filters: { status?: string } = {}) =>
        db
          .select()
          .from(schema.runs)
          .where(
            filters.status
              ? and(
                  eq(schema.runs.orgId, orgId),
                  eq(schema.runs.projectId, projectId),
                  eq(schema.runs.status, filters.status),
                )
              : and(eq(schema.runs.orgId, orgId), eq(schema.runs.projectId, projectId)),
          ),
      byId: async (runId: string) =>
        (
          await db
            .select()
            .from(schema.runs)
            .where(and(eq(schema.runs.orgId, orgId), eq(schema.runs.id, runId)))
            .limit(1)
        )[0] ?? null,
    },
    runEvents: {
      listAfter: (runId: string, afterSeq = 0, limit = 100) =>
        db
          .select()
          .from(schema.runEvents)
          .where(
            and(
              eq(schema.runEvents.orgId, orgId),
              eq(schema.runEvents.runId, runId),
              gt(schema.runEvents.seq, afterSeq),
            ),
          )
          .orderBy(schema.runEvents.seq)
          .limit(limit),
    },
    llmRequests: {
      spendByDay: (from: Date, to: Date) =>
        db.execute(sql`
          SELECT date_trunc('day', created_at)::date AS bucket, floor(coalesce(sum(cost_cents), 0) + 0.5)::int AS cost_cents
          FROM llm_requests
          WHERE org_id = ${orgId} AND created_at >= ${from} AND created_at <= ${to}
          GROUP BY 1
          ORDER BY 1
        `),
    },
    auditEvents: {
      list: () =>
        db
          .select()
          .from(schema.auditEvents)
          .where(eq(schema.auditEvents.orgId, orgId))
          .orderBy(schema.auditEvents.seq),
    },
  };
}
