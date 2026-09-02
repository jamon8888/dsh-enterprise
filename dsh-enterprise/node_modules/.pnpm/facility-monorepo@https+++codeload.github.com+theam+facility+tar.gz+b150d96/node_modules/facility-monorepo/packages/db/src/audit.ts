import { hashChain, newId } from "@facility/core";
import { desc, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

type Db = PostgresJsDatabase<typeof schema>;

export type AuditInsert = {
  orgId: string;
  projectId?: string | null;
  actor: { type: "user" | "key" | "agent" | "system"; id?: string; name?: string };
  action: string;
  target: { type: string; id?: string };
  payload?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
};

export async function insertAuditEvent(db: Db, input: AuditInsert) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.orgId}))`);
    const last = (
      await tx
        .select()
        .from(schema.auditEvents)
        .where(eq(schema.auditEvents.orgId, input.orgId))
        .orderBy(desc(schema.auditEvents.seq))
        .limit(1)
    )[0];
    const eventBody = {
      actor: input.actor,
      action: input.action,
      target: input.target,
      payload: input.payload ?? {},
    };
    const hash = hashChain(last?.hash ?? null, eventBody);
    const row = (
      await tx
        .insert(schema.auditEvents)
        .values({
          id: newId("evt"),
          orgId: input.orgId,
          projectId: input.projectId ?? null,
          actor: input.actor,
          action: input.action,
          target: input.target,
          payload: input.payload ?? {},
          ip: input.ip,
          userAgent: input.userAgent,
          prevHash: last?.hash ?? null,
          hash,
        })
        .returning()
    )[0];
    return row;
  });
}

export async function verifyAuditChain(db: Db, orgId: string) {
  const rows = await db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.orgId, orgId))
    .orderBy(schema.auditEvents.seq);
  let prev: string | null = null;
  for (const row of rows) {
    const expected = hashChain(prev, {
      actor: row.actor,
      action: row.action,
      target: row.target,
      payload: row.payload,
    });
    if (row.prevHash !== prev || row.hash !== expected) {
      return { ok: false, firstBreakSeq: row.seq };
    }
    prev = row.hash;
  }
  return { ok: true, firstBreakSeq: null };
}
