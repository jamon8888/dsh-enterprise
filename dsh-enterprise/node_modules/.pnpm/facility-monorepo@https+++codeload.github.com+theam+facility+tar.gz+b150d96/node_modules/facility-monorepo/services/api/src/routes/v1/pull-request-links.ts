import { ghIssues, ghPullRequests, githubInstallations, repos } from "@facility/db";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ApiError, notFound } from "../../errors.js";
import {
  createGithubClientFactory,
  FacilityGithubClient,
  type GithubClientFactory,
} from "../../github/client.js";
import {
  attachPullRequestClosingIssue,
  type ClosingIssueMutation,
  detachPullRequestClosingIssue,
} from "../../github/closing-issues.js";
import { assertProjectScope, principal, type V1RouteContext } from "./shared.js";

const GithubNumber = z.coerce.number().int().positive().max(2_147_483_647);
const Params = z.object({ projectId: z.string(), number: GithubNumber });
const RepoQuery = z.object({ repoId: z.string().optional() });
const Response = z.object({
  repoId: z.string(),
  pullNumber: z.number().int(),
  issueNumber: z.number().int(),
  closingIssues: z.array(z.number().int()),
  changed: z.boolean(),
});

export async function registerPullRequestLinkRoutes(app: FastifyInstance, context: V1RouteContext) {
  const { db } = context;

  app.post(
    "/v1/projects/:projectId/pulls/:number/closing-issues",
    {
      config: { permission: "repos:write", idempotent: true },
      schema: {
        params: Params,
        querystring: RepoQuery,
        body: z.object({ issueNumber: GithubNumber }),
        response: { 200: Response },
      },
    },
    async (request) => {
      const p = principal(request);
      const { projectId, number } = request.params as { projectId: string; number: number };
      const { repoId } = request.query as { repoId?: string };
      const { issueNumber } = request.body as { issueNumber: number };
      assertProjectScope(p, projectId);
      const target = await loadLinkTarget(app, context, {
        orgId: p.orgId,
        projectId,
        pullNumber: number,
        issueNumber,
        repoId,
      });
      const result = await attachPullRequestClosingIssue({
        db,
        client: target.client,
        repo: target.repo,
        pullNumber: number,
        issueNumber,
      });
      await requireConfirmedMutation(
        request,
        "attached",
        target.repo.id,
        number,
        issueNumber,
        result,
      );
      return mutationResponse(target.repo.id, number, issueNumber, result);
    },
  );

  app.delete(
    "/v1/projects/:projectId/pulls/:number/closing-issues/:issueNumber",
    {
      config: { permission: "repos:write" },
      schema: {
        params: Params.extend({ issueNumber: GithubNumber }),
        querystring: RepoQuery,
        response: { 200: Response },
      },
    },
    async (request) => {
      const p = principal(request);
      const { projectId, number, issueNumber } = request.params as {
        projectId: string;
        number: number;
        issueNumber: number;
      };
      const { repoId } = request.query as { repoId?: string };
      assertProjectScope(p, projectId);
      const target = await loadLinkTarget(app, context, {
        orgId: p.orgId,
        projectId,
        pullNumber: number,
        issueNumber,
        repoId,
      });
      const result = await detachPullRequestClosingIssue({
        db,
        client: target.client,
        repo: target.repo,
        pullNumber: number,
        issueNumber,
      });
      await requireConfirmedMutation(
        request,
        "detached",
        target.repo.id,
        number,
        issueNumber,
        result,
      );
      return mutationResponse(target.repo.id, number, issueNumber, result);
    },
  );
}

async function loadLinkTarget(
  app: FastifyInstance,
  context: V1RouteContext,
  input: {
    orgId: string;
    projectId: string;
    pullNumber: number;
    issueNumber: number;
    repoId?: string;
  },
) {
  const pulls = await context.db
    .select()
    .from(ghPullRequests)
    .where(
      and(
        eq(ghPullRequests.orgId, input.orgId),
        eq(ghPullRequests.projectId, input.projectId),
        eq(ghPullRequests.number, input.pullNumber),
        ...(input.repoId ? [eq(ghPullRequests.repoId, input.repoId)] : []),
      ),
    );
  if (pulls.length === 0) throw notFound("Pull request not found");
  if (pulls.length > 1) {
    throw new ApiError(
      409,
      "ambiguous_pull_request_number",
      "Pull request number exists in more than one project repository; provide repoId",
    );
  }
  const pull = pulls[0] as (typeof pulls)[number];
  const repo = (
    await context.db
      .select()
      .from(repos)
      .where(
        and(
          eq(repos.orgId, input.orgId),
          eq(repos.projectId, input.projectId),
          eq(repos.id, pull.repoId),
        ),
      )
      .limit(1)
  )[0];
  if (!repo) throw notFound("Repository not found");
  const issue = (
    await context.db
      .select({ id: ghIssues.id })
      .from(ghIssues)
      .where(
        and(
          eq(ghIssues.orgId, input.orgId),
          eq(ghIssues.projectId, input.projectId),
          eq(ghIssues.repoId, repo.id),
          eq(ghIssues.number, input.issueNumber),
        ),
      )
      .limit(1)
  )[0];
  if (!issue) {
    throw new ApiError(
      404,
      "same_repository_issue_not_found",
      "Issue is not mirrored in the pull request repository",
    );
  }
  const installation = repo.installationId
    ? (
        await context.db
          .select()
          .from(githubInstallations)
          .where(
            and(
              eq(githubInstallations.orgId, input.orgId),
              eq(githubInstallations.id, repo.installationId),
            ),
          )
          .limit(1)
      )[0]
    : null;
  if (!installation) {
    throw new ApiError(
      409,
      "github_installation_required",
      "Repository has no active GitHub App installation",
    );
  }
  if (installation.suspendedAt) {
    throw new ApiError(409, "installation_suspended", "GitHub installation is suspended");
  }
  const factory: GithubClientFactory | undefined =
    app.githubClientFactory ??
    (context.config.githubAppId && context.config.githubAppPrivateKey
      ? createGithubClientFactory(context.config)
      : undefined);
  if (!factory) {
    throw new ApiError(503, "github_app_unconfigured", "GitHub App credentials are not configured");
  }
  const client = new FacilityGithubClient(await factory(installation.installationId), {
    owner: repo.owner,
    repo: repo.name,
    defaultBranch: repo.defaultBranch,
  });
  return { repo, client };
}

async function requireConfirmedMutation(
  request: FastifyRequest,
  action: "attached" | "detached",
  repoId: string,
  pullNumber: number,
  issueNumber: number,
  result: ClosingIssueMutation,
) {
  if (!result.confirmed) {
    if (result.changed) {
      await request.audit(
        `github.closing_issue.${action}_unconfirmed`,
        {
          type: "project",
          id: (request.params as { projectId: string }).projectId,
        },
        { repoId, pullNumber, issueNumber },
      );
    }
    throw new ApiError(
      409,
      "closing_issue_not_confirmed",
      action === "attached"
        ? "GitHub did not confirm the closing issue after the pull request body was updated"
        : "GitHub still reports the closing issue; remove its other link on GitHub",
    );
  }
  await request.audit(
    `github.closing_issue.${action}`,
    {
      type: "project",
      id: (request.params as { projectId: string }).projectId,
    },
    { repoId, pullNumber, issueNumber, changed: result.changed },
  );
}

function mutationResponse(
  repoId: string,
  pullNumber: number,
  issueNumber: number,
  result: ClosingIssueMutation,
) {
  return {
    repoId,
    pullNumber,
    issueNumber,
    closingIssues: result.snapshot.closingIssues,
    changed: result.changed,
  };
}
