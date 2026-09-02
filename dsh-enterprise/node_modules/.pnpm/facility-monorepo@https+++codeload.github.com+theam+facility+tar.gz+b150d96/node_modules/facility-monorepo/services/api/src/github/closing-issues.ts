import type { FacilityDb, repos } from "@facility/db";
import { ApiError } from "../errors.js";
import type { FacilityGithubClient, GithubPullRequestSnapshot } from "./client.js";
import { upsertPullRequestSnapshot } from "./pull-requests-sync.js";

export type ClosingIssueMutation = {
  snapshot: GithubPullRequestSnapshot;
  changed: boolean;
  confirmed: boolean;
};

export async function attachPullRequestClosingIssue(input: {
  db: FacilityDb;
  client: FacilityGithubClient;
  repo: typeof repos.$inferSelect;
  pullNumber: number;
  issueNumber: number;
}): Promise<ClosingIssueMutation> {
  const before = await requirePullRequestSnapshot(input.client, input.pullNumber);
  await upsertPullRequestSnapshot(input.db, input.repo, before);

  if (before.closingIssues.includes(input.issueNumber)) {
    return { snapshot: before, changed: false, confirmed: true };
  }
  assertAttachablePullRequest(before, input.repo.defaultBranch);

  const body = pullRequestBodyForIssue(
    before.body ?? "",
    input.issueNumber,
    input.repo.owner,
    input.repo.name,
  );
  const changed = body !== (before.body ?? "");
  if (changed) await input.client.updatePullRequestBody(input.pullNumber, body);

  // The refreshed GitHub snapshot is the only authority for the local link.
  // Never infer closingIssues from the body we just wrote.
  const after = await requirePullRequestSnapshot(input.client, input.pullNumber);
  await upsertPullRequestSnapshot(input.db, input.repo, after);
  return {
    snapshot: after,
    changed,
    confirmed: after.closingIssues.includes(input.issueNumber),
  };
}

export async function detachPullRequestClosingIssue(input: {
  db: FacilityDb;
  client: FacilityGithubClient;
  repo: typeof repos.$inferSelect;
  pullNumber: number;
  issueNumber: number;
}): Promise<ClosingIssueMutation> {
  const before = await requirePullRequestSnapshot(input.client, input.pullNumber);
  await upsertPullRequestSnapshot(input.db, input.repo, before);

  if (!before.closingIssues.includes(input.issueNumber)) {
    return { snapshot: before, changed: false, confirmed: true };
  }
  if (before.state !== "open") {
    throw new ApiError(
      409,
      "pull_request_not_open",
      "Only an open pull request can be detached from a story",
    );
  }

  const body = pullRequestBodyWithoutFacilityClosingIssue(before.body ?? "", input.issueNumber);
  if (body === null) {
    throw new ApiError(
      409,
      "closing_issue_not_detachable",
      "Facility can only detach the exact Closes line it adds; remove this link on GitHub",
    );
  }
  await input.client.updatePullRequestBody(input.pullNumber, body);

  const after = await requirePullRequestSnapshot(input.client, input.pullNumber);
  await upsertPullRequestSnapshot(input.db, input.repo, after);
  return {
    snapshot: after,
    changed: true,
    confirmed: !after.closingIssues.includes(input.issueNumber),
  };
}

export function pullRequestBodyForIssue(
  body: string,
  issueNumber: number,
  owner: string,
  repo: string,
) {
  const escapedOwner = escapeRegExp(owner);
  const escapedRepo = escapeRegExp(repo);
  const reference = new RegExp(
    `\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s*:?[\\t ]+(?:#${issueNumber}\\b|${escapedOwner}/${escapedRepo}#${issueNumber}\\b|https://github\\.com/${escapedOwner}/${escapedRepo}/issues/${issueNumber}\\b)`,
    "i",
  );
  const prose = body
    .replace(/```[^\n]*\n[\s\S]*?```/g, "")
    .replace(/~~~[^\n]*\n[\s\S]*?~~~/g, "")
    .replace(/`[^`\n]*`/g, "");
  if (reference.test(prose)) return body;
  return body.trim() ? `Closes #${issueNumber}\n\n${body}` : `Closes #${issueNumber}`;
}

/** Reverse only the exact standalone marker Facility writes. */
export function pullRequestBodyWithoutFacilityClosingIssue(
  body: string,
  issueNumber: number,
): string | null {
  const marker = `Closes #${issueNumber}`;
  const match = new RegExp(`(^|\\r?\\n)${escapeRegExp(marker)}(?=\\r?\\n|$)`).exec(body);
  if (!match || match.index === undefined) return null;

  const linePrefix = match[1] ?? "";
  const markerStart = match.index + linePrefix.length;
  const markerEnd = markerStart + marker.length;
  const before = body.slice(0, markerStart);
  let after = body.slice(markerEnd);
  if (markerStart === 0) {
    after = after.replace(/^\r?\n(?:\r?\n)?/, "");
    return after;
  }
  if (!after) return before.replace(/\r?\n$/, "");
  after = after.replace(/^(?:\r?\n)+/, "");
  return `${before}${after}`;
}

function assertAttachablePullRequest(snapshot: GithubPullRequestSnapshot, defaultBranch: string) {
  if (snapshot.state !== "open") {
    throw new ApiError(
      409,
      "pull_request_not_open",
      "Only an open pull request can be attached to a story",
    );
  }
  if (snapshot.baseRef !== defaultBranch) {
    throw new ApiError(
      409,
      "pull_request_not_on_default_branch",
      `GitHub closing keywords only link issues when the pull request targets ${defaultBranch}`,
    );
  }
}

async function requirePullRequestSnapshot(client: FacilityGithubClient, pullNumber: number) {
  const snapshot = await client.getPullRequestSnapshot(pullNumber);
  if (!snapshot) {
    throw new ApiError(404, "pull_request_not_found", "Pull request not found on GitHub");
  }
  return snapshot;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
