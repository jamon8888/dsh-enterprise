import { can } from "@facility/core";
import { orgMembers, previewSandboxes, repos, roles, runs, users } from "@facility/db";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { ApiError, notFound } from "../../errors.js";
import {
  assertPreviewProvisioningAvailable,
  assertPreviewSession,
  consumePreviewHandoff,
  createPreviewRecord,
  destroyPreview,
  mintPreviewHandoff,
  mintPreviewSession,
  previewAccessUrl,
  previewCookieName,
  previewCookieOptions,
  proxyPreviewRequest,
  readPreviewHandoff,
  readPreviewSession,
  rewritePreviewHtml,
} from "../../previews.js";
import type { AppConfig } from "../../types.js";
import type { V1RouteContext } from "./shared.js";

const PreviewParams = z.object({ projectId: z.string(), previewId: z.string().optional() });
const PublicPreviewParams = z.object({ previewId: z.string(), "*": z.string().optional() });
const PreviewHandoffQuery = z.object({ handoff: z.string().min(1) });
const PreviewCreate = z.object({
  repoId: z.string().optional(),
  runId: z.string().optional(),
  prNumber: z.number().int().positive().optional(),
  commitSha: z
    .string()
    .min(7)
    .max(128)
    .regex(/^[a-f0-9]+$/i)
    .optional(),
  image: z
    .string()
    .min(1)
    .max(300)
    .refine((value) => !/\s/.test(value)),
  command: z.array(z.string().min(1).max(500)).max(30).optional(),
  port: z.number().int().min(1).max(65_535).default(3000),
  readinessPath: z.string().min(1).max(200).startsWith("/").optional(),
  ttlHours: z.number().int().min(1).max(168).default(24),
});
const PreviewSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  projectId: z.string(),
  repoId: z.string().nullable(),
  runId: z.string().nullable(),
  prNumber: z.number().int().nullable(),
  commitSha: z.string().nullable(),
  driver: z.string(),
  status: z.string(),
  authMode: z.literal("facility_session"),
  config: z.record(z.string(), z.unknown()),
  error: z.string().nullable(),
  expiresAt: z.date(),
  lastHealthAt: z.date().nullable(),
  createdBy: z.unknown(),
  createdAt: z.date(),
  updatedAt: z.date(),
  url: z.string(),
});

export async function registerPreviewRoutes(
  app: FastifyRequest["server"],
  context: V1RouteContext,
) {
  const { db, config } = context;
  app.get(
    "/v1/projects/:projectId/previews",
    {
      config: { permission: "runs:read" },
      schema: { params: PreviewParams, response: { 200: z.array(PreviewSchema) } },
    },
    async (request) => {
      assertPreviewSession(config, request.principal);
      const { projectId } = request.params as z.infer<typeof PreviewParams>;
      const rows = await db
        .select()
        .from(previewSandboxes)
        .where(
          and(
            eq(previewSandboxes.orgId, request.principal?.orgId ?? ""),
            eq(previewSandboxes.projectId, projectId),
          ),
        )
        .orderBy(desc(previewSandboxes.createdAt));
      return rows.map((row) => present(row, config));
    },
  );

  app.post(
    "/v1/projects/:projectId/previews",
    {
      config: {
        permission: "runs:write",
        auditAction: "preview.requested",
        idempotent: true,
      },
      schema: {
        params: PreviewParams,
        body: PreviewCreate,
        response: { 202: PreviewSchema },
      },
    },
    async (request, reply) => {
      assertPreviewProvisioningAvailable(config);
      const principal = request.principal;
      if (!principal) throw new ApiError(401, "unauthorized", "Authentication required");
      const { projectId } = request.params as z.infer<typeof PreviewParams>;
      const body = request.body as z.infer<typeof PreviewCreate>;
      if (body.repoId) {
        const repo = (
          await db
            .select({ id: repos.id })
            .from(repos)
            .where(
              and(
                eq(repos.orgId, principal.orgId),
                eq(repos.projectId, projectId),
                eq(repos.id, body.repoId),
              ),
            )
            .limit(1)
        )[0];
        if (!repo) throw notFound("Repository");
      }
      if (body.runId) {
        const run = (
          await db
            .select({ id: runs.id })
            .from(runs)
            .where(
              and(
                eq(runs.orgId, principal.orgId),
                eq(runs.projectId, projectId),
                eq(runs.id, body.runId),
              ),
            )
            .limit(1)
        )[0];
        if (!run) throw notFound("Run");
      }
      const preview = await createPreviewRecord(db, {
        orgId: principal.orgId,
        projectId,
        repoId: body.repoId,
        runId: body.runId,
        prNumber: body.prNumber,
        commitSha: body.commitSha,
        image: body.image,
        command: body.command,
        port: body.port,
        readinessPath: body.readinessPath,
        ttlHours: body.ttlHours,
        driver: config.sandboxDriver,
        createdBy: { type: principal.type, id: principal.id },
      });
      if (!preview) throw new ApiError(500, "preview_create_failed", "Preview was not created");
      await app.enqueue("previews.provision", { previewId: preview.id });
      return reply.status(202).send(present(preview, config));
    },
  );

  app.delete(
    "/v1/projects/:projectId/previews/:previewId",
    {
      config: { permission: "runs:write", auditAction: "preview.destroyed", idempotent: true },
      schema: { params: PreviewParams, response: { 200: PreviewSchema } },
    },
    async (request) => {
      assertPreviewSession(config, request.principal);
      const principal = request.principal;
      const { projectId, previewId } = request.params as z.infer<typeof PreviewParams>;
      const preview = (
        await db
          .select()
          .from(previewSandboxes)
          .where(
            and(
              eq(previewSandboxes.orgId, principal?.orgId ?? ""),
              eq(previewSandboxes.projectId, projectId),
              eq(previewSandboxes.id, previewId ?? ""),
            ),
          )
          .limit(1)
      )[0];
      if (!preview) throw notFound("Preview");
      const destroyed = await destroyPreview(db, preview);
      if (!destroyed)
        throw new ApiError(500, "preview_destroy_failed", "Preview was not destroyed");
      return present(destroyed, config);
    },
  );

  app.get(
    "/v1/projects/:projectId/previews/:previewId/open",
    {
      config: { permission: "runs:read" },
      schema: { params: PreviewParams },
    },
    async (request, reply) => {
      assertPreviewSession(config, request.principal);
      const principal = request.principal;
      if (!principal?.userId) throw new ApiError(401, "unauthorized", "Authentication required");
      const { projectId, previewId } = request.params as z.infer<typeof PreviewParams>;
      const preview = (
        await db
          .select()
          .from(previewSandboxes)
          .where(
            and(
              eq(previewSandboxes.orgId, principal.orgId),
              eq(previewSandboxes.projectId, projectId),
              eq(previewSandboxes.id, previewId ?? ""),
            ),
          )
          .limit(1)
      )[0];
      if (!preview) throw notFound("Preview");
      if (preview.status !== "running") {
        throw new ApiError(409, "preview_not_running", "Preview environment is not running");
      }
      const handoff = await mintPreviewHandoff(db, config, {
        userId: principal.userId,
        orgId: principal.orgId,
        projectId,
        previewId: preview.id,
      });
      await request.audit("preview.opened", { type: "preview", id: preview.id });
      const previewUrl = new URL(config.previewUrl ?? config.publicUrl);
      previewUrl.pathname = `/preview-auth/${encodeURIComponent(preview.id)}`;
      previewUrl.search = new URLSearchParams({ handoff }).toString();
      reply.header("cache-control", "no-store");
      reply.header("referrer-policy", "no-referrer");
      return reply.redirect(previewUrl.toString());
    },
  );

  app.get(
    "/preview-auth/:previewId",
    {
      config: { public: true },
      schema: { params: PublicPreviewParams, querystring: PreviewHandoffQuery },
    },
    async (request, reply) => {
      const { previewId } = request.params as z.infer<typeof PublicPreviewParams>;
      const { handoff } = request.query as z.infer<typeof PreviewHandoffQuery>;
      const claims = await readPreviewHandoff(config, handoff, previewId);
      await loadAuthorizedPreview(db, claims, previewId, claims.projectId);
      await consumePreviewHandoff(db, claims);
      const previewSession = await mintPreviewSession(config, {
        userId: claims.userId,
        orgId: claims.orgId,
        previewId,
      });
      reply.setCookie(
        previewCookieName(previewId),
        previewSession,
        previewCookieOptions(config, previewId),
      );
      reply.header("cache-control", "no-store");
      reply.header("referrer-policy", "no-referrer");
      return reply.redirect(`/preview/${encodeURIComponent(previewId)}/`);
    },
  );

  const proxy = async (request: FastifyRequest, reply: FastifyReply) => {
    const { previewId } = request.params as { previewId: string; "*"?: string };
    const token = request.cookies[previewCookieName(previewId)] ?? "";
    const claims = await readPreviewSession(config, token, previewId);
    const preview = await loadAuthorizedPreview(db, claims, previewId);
    const upstream = await proxyPreviewRequest(
      preview,
      (request.params as { "*"?: string })["*"] ?? "",
      request.method as "GET" | "HEAD",
      request.headers,
    );
    reply.status(upstream.statusCode);
    reply.header("referrer-policy", "no-referrer");
    reply.header("x-content-type-options", "nosniff");
    for (const name of ["content-type", "cache-control", "etag", "last-modified"]) {
      const value = upstream.headers[name];
      if (value) reply.header(name, value);
    }
    const rawLocation = upstream.headers.location;
    const location = Array.isArray(rawLocation) ? rawLocation[0] : rawLocation;
    if (location) {
      const rewritten = rewritePreviewLocation(location, preview);
      reply.header("location", rewritten);
    }
    if (request.method === "HEAD") return reply.send();
    if (String(upstream.headers["content-type"] ?? "").includes("text/html")) {
      return reply.send(rewritePreviewHtml(await upstream.body.text(), preview.id));
    }
    return reply.send(upstream.body);
  };
  for (const [url, suffix] of [
    ["/preview/:previewId", "Root"],
    ["/preview/:previewId/*", "Path"],
  ] as const) {
    for (const method of ["GET", "HEAD"] as const) {
      app.route({
        method,
        url,
        exposeHeadRoute: false,
        config: { public: true },
        schema: {
          params: PublicPreviewParams,
          operationId: `${method.toLowerCase()}ProtectedPreview${suffix}`,
        },
        handler: proxy,
      });
    }
  }
}

function rewritePreviewLocation(location: string, preview: typeof previewSandboxes.$inferSelect) {
  const prefix = `/preview/${encodeURIComponent(preview.id)}`;
  if (location.startsWith("/")) return `${prefix}${location}`;
  try {
    const target = new URL(location);
    if (preview.originUrl && target.origin === new URL(preview.originUrl).origin) {
      return `${prefix}${target.pathname}${target.search}${target.hash}`;
    }
  } catch {
    // Preserve relative and malformed upstream locations; the browser resolves
    // them beneath the already authenticated proxy URL.
  }
  return location;
}

async function loadAuthorizedPreview(
  db: V1RouteContext["db"],
  claims: { userId: string; orgId: string },
  previewId: string,
  projectId?: string,
) {
  const preview = (
    await db
      .select()
      .from(previewSandboxes)
      .where(
        and(
          eq(previewSandboxes.id, previewId),
          eq(previewSandboxes.orgId, claims.orgId),
          ...(projectId ? [eq(previewSandboxes.projectId, projectId)] : []),
        ),
      )
      .limit(1)
  )[0];
  if (!preview) throw notFound("Preview");
  const membership = (
    await db
      .select({ permissions: roles.permissions })
      .from(orgMembers)
      .innerJoin(roles, eq(orgMembers.roleId, roles.id))
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(
        and(
          eq(orgMembers.orgId, claims.orgId),
          eq(orgMembers.userId, claims.userId),
          eq(users.status, "active"),
        ),
      )
      .limit(1)
  )[0];
  if (!membership || !can(membership.permissions, "runs:read")) {
    throw new ApiError(403, "preview_access_revoked", "Preview access has been revoked");
  }
  if (preview.status !== "running") {
    throw new ApiError(409, "preview_not_running", "Preview environment is not running");
  }
  return preview;
}

function present(preview: typeof previewSandboxes.$inferSelect, config: AppConfig) {
  return {
    ...preview,
    originUrl: undefined,
    authMode: "facility_session" as const,
    config: (preview.config ?? {}) as Record<string, unknown>,
    url: previewAccessUrl(config, preview.projectId, preview.id),
  };
}
