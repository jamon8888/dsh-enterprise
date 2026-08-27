import { type FacilityDb, runDeliveries } from "@facility/db";
import { and, asc, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import type { GithubClientFactory } from "../github/client.js";
import { nextAttempt } from "../integrations/outbound.js";
import type { AppConfig } from "../types.js";
import { raisePlatformIssue } from "../watchtower/issues.js";
import {
  publishRunDelivery,
  RunDeliveryBlockedError,
  RunDeliveryLeaseLostError,
} from "./orchestrator.js";
import { appendRunEvents } from "./state.js";

const CLAIM_LIMIT = 25;
const STALE_CLAIM_MS = 5 * 60_000;

type DeliveryOptions = {
  runId?: string;
  now?: Date;
  githubClientFactory?: GithubClientFactory;
  enqueue?: (queue: string, data: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Drain durable pull-request delivery intents. Pg-boss only wakes this drain;
 * run_deliveries remains the source of truth and stale claims are recoverable.
 */
export async function deliverPendingRunDeliveries(
  db: FacilityDb,
  config: AppConfig,
  options: DeliveryOptions = {},
) {
  const now = options.now ?? new Date();
  const staleClaim = new Date(now.getTime() - STALE_CLAIM_MS);
  const claimed = await db.transaction(async (tx) => {
    const eligible = or(
      and(eq(runDeliveries.status, "pending"), lte(runDeliveries.nextAttemptAt, now)),
      and(eq(runDeliveries.status, "delivering"), lt(runDeliveries.updatedAt, staleClaim)),
    );
    const rows = await tx
      .select()
      .from(runDeliveries)
      .where(and(eligible, options.runId ? eq(runDeliveries.runId, options.runId) : undefined))
      .orderBy(asc(runDeliveries.nextAttemptAt))
      .limit(CLAIM_LIMIT)
      .for("update", { skipLocked: true });
    if (!rows.length) return [];
    await tx
      .update(runDeliveries)
      .set({
        status: "delivering",
        attempts: sql`${runDeliveries.attempts} + 1`,
        updatedAt: now,
      })
      .where(
        inArray(
          runDeliveries.runId,
          rows.map((row) => row.runId),
        ),
      );
    return rows.map((row) => ({
      ...row,
      status: "delivering",
      attempts: row.attempts + 1,
      updatedAt: now,
    }));
  });

  const results: Array<{ runId: string; status: "delivered" | "pending" | "blocked" }> = [];
  for (const delivery of claimed) {
    try {
      await publishRunDelivery(db, delivery, {
        config,
        githubClientFactory: options.githubClientFactory,
        enqueue: options.enqueue,
      });
      results.push({ runId: delivery.runId, status: "delivered" });
    } catch (error) {
      const message = deliveryErrorMessage(error);
      if (error instanceof RunDeliveryLeaseLostError) {
        results.push({
          runId: delivery.runId,
          status: await deliveryStatusAfterLeaseLoss(db, delivery),
        });
        continue;
      }
      if (error instanceof RunDeliveryBlockedError) {
        const updated = await db
          .update(runDeliveries)
          .set({
            status: "blocked",
            blockedReason: error.reason,
            error: message,
            updatedAt: now,
          })
          .where(
            and(
              eq(runDeliveries.runId, delivery.runId),
              eq(runDeliveries.orgId, delivery.orgId),
              eq(runDeliveries.projectId, delivery.projectId),
              eq(runDeliveries.status, "delivering"),
              eq(runDeliveries.updatedAt, delivery.updatedAt),
            ),
          )
          .returning({ runId: runDeliveries.runId });
        if (!updated.length) {
          results.push({
            runId: delivery.runId,
            status: await deliveryStatusAfterLeaseLoss(db, delivery),
          });
          continue;
        }
        await appendRunEvents(db, delivery.orgId, delivery.runId, [
          {
            type: "artifact_error",
            data: { kind: "pr_delivery_blocked", reason: error.reason, error: message },
          },
        ]).catch(() => undefined);
        await raisePlatformIssue(
          db,
          {
            orgId: delivery.orgId,
            projectId: delivery.projectId,
            kind: "pr_delivery_blocked",
            severity: "error",
            fingerprint: `pr_delivery_pending:${delivery.runId}`,
            title: "Pull request delivery is blocked",
            bodyMd: `Run ${delivery.runId} remains safely bound to ${delivery.owner}/${delivery.repoName}@${delivery.expectedHeadSha}, but Facility refused to publish it because ${error.reason}.`,
          },
          { projectId: delivery.projectId },
        ).catch(() => undefined);
        results.push({ runId: delivery.runId, status: "blocked" });
        continue;
      }
      const updated = await db
        .update(runDeliveries)
        .set({
          status: "pending",
          error: message,
          nextAttemptAt: nextAttempt(now, delivery.attempts),
          updatedAt: now,
        })
        .where(
          and(
            eq(runDeliveries.runId, delivery.runId),
            eq(runDeliveries.orgId, delivery.orgId),
            eq(runDeliveries.projectId, delivery.projectId),
            eq(runDeliveries.status, "delivering"),
            eq(runDeliveries.updatedAt, delivery.updatedAt),
          ),
        )
        .returning({ runId: runDeliveries.runId });
      if (!updated.length) {
        results.push({
          runId: delivery.runId,
          status: await deliveryStatusAfterLeaseLoss(db, delivery),
        });
        continue;
      }
      if (delivery.attempts === 1) {
        await appendRunEvents(db, delivery.orgId, delivery.runId, [
          {
            type: "artifact_error",
            data: { kind: "pr_delivery_pending", attempt: delivery.attempts, error: message },
          },
        ]).catch(() => undefined);
      }
      await raisePlatformIssue(
        db,
        {
          orgId: delivery.orgId,
          projectId: delivery.projectId,
          kind: "pr_delivery_pending",
          severity: "error",
          fingerprint: `pr_delivery_pending:${delivery.runId}`,
          title: "Pull request delivery is retrying",
          bodyMd: `Run ${delivery.runId} safely pushed ${delivery.owner}/${delivery.repoName}@${delivery.expectedHeadSha}. Facility will keep retrying pull request publication.\n\nLatest error: ${message}`,
        },
        { projectId: delivery.projectId },
      ).catch(() => undefined);
      results.push({ runId: delivery.runId, status: "pending" });
    }
  }
  return results;
}

async function deliveryStatusAfterLeaseLoss(
  db: FacilityDb,
  delivery: Pick<typeof runDeliveries.$inferSelect, "runId" | "orgId" | "projectId">,
): Promise<"delivered" | "pending" | "blocked"> {
  const current = (
    await db
      .select({ status: runDeliveries.status })
      .from(runDeliveries)
      .where(
        and(
          eq(runDeliveries.runId, delivery.runId),
          eq(runDeliveries.orgId, delivery.orgId),
          eq(runDeliveries.projectId, delivery.projectId),
        ),
      )
      .limit(1)
  )[0];
  return current?.status === "delivered" || current?.status === "blocked"
    ? current.status
    : "pending";
}

function deliveryErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 2_000) : "Unknown delivery error";
}
