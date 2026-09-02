import { createHash } from "node:crypto";
import { newId } from "@facility/core";
import { type FacilityDb, registryItems, registryVersions } from "@facility/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { ApiError } from "./errors.js";

/**
 * Allocate the next version number for an item and insert a draft, atomically.
 * A per-item advisory lock serializes concurrent draft creation so two callers
 * (an author + the learning executor, say) can't both read the same max(version)
 * and collide on UNIQUE(item_id, version) with a raw duplicate-key error.
 */
export async function createNextDraftVersion(
  db: FacilityDb,
  input: { orgId: string; itemId: string; content: string; changelog?: string; createdBy: string },
) {
  const { orgId, itemId, content, changelog, createdBy } = input;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${itemId}))`);
    const max =
      (
        await tx
          .select({ version: registryVersions.version })
          .from(registryVersions)
          .where(and(eq(registryVersions.orgId, orgId), eq(registryVersions.itemId, itemId)))
          .orderBy(desc(registryVersions.version))
          .limit(1)
      )[0]?.version ?? 0;
    return (
      await tx
        .insert(registryVersions)
        .values({
          id: newId("ver"),
          orgId,
          itemId,
          version: max + 1,
          content,
          contentHash: createHash("sha256").update(content).digest("hex"),
          changelog,
          status: "draft",
          createdBy,
        })
        .returning()
    )[0];
  });
}

/**
 * Publish a draft registry version as the single active version of its item,
 * atomically. Within one transaction the item's current active version(s) are
 * deprecated FIRST (the one-active-per-item partial unique index forbids two at
 * once), then the draft is activated and the item's latestVersion advanced.
 *
 * Shared by the HTTP publish route and the HITL proposal executor so BOTH publish
 * surfaces keep the "exactly one active version per item" invariant — run bundle
 * assembly and the runner key skills/contracts by name and assume it.
 */
export async function publishRegistryVersion(db: FacilityDb, orgId: string, versionId: string) {
  return db.transaction(async (tx) => {
    const target = (
      await tx
        .select()
        .from(registryVersions)
        .where(and(eq(registryVersions.orgId, orgId), eq(registryVersions.id, versionId)))
        .limit(1)
    )[0];
    if (target?.status !== "draft") {
      throw new ApiError(400, "invalid_state", "Only draft versions can be published");
    }
    // Serialize concurrent publishes of the SAME item so two drafts can't both
    // try to activate and collide on the one-active partial unique index (which
    // would surface as a raw 23505 instead of a clean sequential publish).
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${target.itemId}))`);
    // Deprecate the item's current active version(s) before activating the new one
    // (ordering matters: the partial unique index allows only one active per item).
    await tx
      .update(registryVersions)
      .set({ status: "deprecated", updatedAt: new Date() })
      .where(
        and(
          eq(registryVersions.orgId, orgId),
          eq(registryVersions.itemId, target.itemId),
          eq(registryVersions.status, "active"),
        ),
      );
    const version = (
      await tx
        .update(registryVersions)
        .set({ status: "active", updatedAt: new Date() })
        .where(
          and(
            eq(registryVersions.orgId, orgId),
            eq(registryVersions.id, versionId),
            eq(registryVersions.status, "draft"),
          ),
        )
        .returning()
    )[0];
    if (!version) {
      // Lost a race to another publisher between the read and the activate.
      throw new ApiError(400, "invalid_state", "Only draft versions can be published");
    }
    await tx
      .update(registryItems)
      .set({ latestVersion: version.version, updatedAt: new Date() })
      .where(and(eq(registryItems.orgId, orgId), eq(registryItems.id, version.itemId)));
    return version;
  });
}
