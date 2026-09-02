import { createHash } from "node:crypto";
import { open, seal } from "@facility/core";
import { type FacilityDb, oauthArtifacts } from "@facility/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";

type ArtifactPayload = Record<string, unknown> & {
  grantId?: string;
  userCode?: string;
  uid?: string;
};

export function oauthAdapterFactory(db: FacilityDb, secret: string) {
  return class PostgresOauthAdapter {
    readonly model: string;
    constructor(model: string) {
      this.model = model;
    }

    async upsert(id: string, payload: ArtifactPayload, expiresIn: number) {
      const now = new Date();
      await db
        .insert(oauthArtifacts)
        .values({
          model: this.model,
          idHash: hash(id),
          payload: await seal(JSON.stringify(payload), secret),
          grantIdHash: payload.grantId ? hash(payload.grantId) : null,
          userCodeHash: payload.userCode ? hash(payload.userCode) : null,
          uidHash: payload.uid ? hash(payload.uid) : null,
          expiresAt: Number.isFinite(expiresIn) ? new Date(now.getTime() + expiresIn * 1000) : null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [oauthArtifacts.model, oauthArtifacts.idHash],
          set: {
            payload: await seal(JSON.stringify(payload), secret),
            grantIdHash: payload.grantId ? hash(payload.grantId) : null,
            userCodeHash: payload.userCode ? hash(payload.userCode) : null,
            uidHash: payload.uid ? hash(payload.uid) : null,
            expiresAt: Number.isFinite(expiresIn)
              ? new Date(now.getTime() + expiresIn * 1000)
              : null,
            consumedAt: null,
            updatedAt: now,
          },
        });
    }

    async find(id: string) {
      return this.findWhere(eq(oauthArtifacts.idHash, hash(id)));
    }
    async findByUid(uid: string) {
      return this.findWhere(eq(oauthArtifacts.uidHash, hash(uid)));
    }
    async findByUserCode(userCode: string) {
      return this.findWhere(eq(oauthArtifacts.userCodeHash, hash(userCode)));
    }

    async destroy(id: string) {
      await db
        .delete(oauthArtifacts)
        .where(and(eq(oauthArtifacts.model, this.model), eq(oauthArtifacts.idHash, hash(id))));
    }

    async consume(id: string) {
      await db
        .update(oauthArtifacts)
        .set({ consumedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(oauthArtifacts.model, this.model), eq(oauthArtifacts.idHash, hash(id))));
    }

    async revokeByGrantId(grantId: string) {
      await db.delete(oauthArtifacts).where(eq(oauthArtifacts.grantIdHash, hash(grantId)));
    }

    async findWhere(predicate: ReturnType<typeof eq>) {
      const row = (
        await db
          .select()
          .from(oauthArtifacts)
          .where(
            and(
              eq(oauthArtifacts.model, this.model),
              predicate,
              or(isNull(oauthArtifacts.expiresAt), gt(oauthArtifacts.expiresAt, new Date())),
            ),
          )
          .limit(1)
      )[0];
      if (!row) return undefined;
      const payload = JSON.parse(await open(row.payload, secret)) as ArtifactPayload & {
        consumed?: number;
      };
      if (row.consumedAt) payload.consumed = Math.floor(row.consumedAt.getTime() / 1000);
      return payload;
    }
  };
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}
